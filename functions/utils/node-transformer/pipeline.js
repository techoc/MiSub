/**
 * 节点统一转换主管道（facade 拆分：nodeUrlsToRecords/recordsToNodeUrls/applyNodeTransformPipeline）。
 */

import { parseNodeInfo } from '../../modules/utils/geo-utils.js';
import { extractNodeMetadata } from '../../modules/utils/metadata-extractor.js';
import { normalizeConfig, normalizeProtocol, stripLeadingEmoji, toRegionZh } from './shared.js';
import {
    matchesRegexRules,
    ensureRegionInfo,
    isUselessNode,
    setNodeName,
    applyRegexRename,
    evaluateScriptExpression,
    applyScriptRename,
} from './rename.js';
import {
    makeDedupKey,
    choosePreferred,
    renderTemplate,
    padIndex,
    getIndexGroupKey,
} from './render.js';
import { makeComparator } from './sort.js';

// ============ 主管道函数 ============

/**
 * 对节点 URL 列表应用统一转换管道
 * @param {string[]} nodeUrls - 节点 URL 数组
 * @param {Object} transformConfig - 转换配置
 * @returns {string[]} 处理后的节点 URL 数组
 */
/**
 * 将 URL 列表转换为结构化 Record 列表
 */
export function nodeUrlsToRecords(nodeUrls, options = {}) {
    const input = Array.isArray(nodeUrls)
        ? nodeUrls.map((s) => String(s || '').trim()).filter(Boolean)
        : [];

    return input.map((url) => {
        // 使用统一的解析引擎
        const nodeInfo = parseNodeInfo(url);
        const metadata = extractNodeMetadata(nodeInfo.name);

        const record = {
            url,
            protocol: nodeInfo.protocol,
            name: nodeInfo.name,
            originalName: nodeInfo.name,
            region: '',
            emoji: '',
            server: nodeInfo.server || '',
            port: nodeInfo.port || '',
            metadata: metadata, // 注入完整元数据
        };

        return options.ensureRegion ? ensureRegionInfo(record, options.enableEmoji) : record;
    });
}

/**
 * 将 Record 列表写回 URL 列表
 */
export function recordsToNodeUrls(records) {
    if (!Array.isArray(records)) return [];
    return records.map((r) => {
        // 如果名称发生变化（例如被正则重命名或脚本重命名），同步更新 URL
        if (r.name && r.name !== r.originalName) {
            return setNodeName(r.url, r.protocol, r.name);
        }
        return r.url;
    });
}

export function applyNodeTransformPipeline(nodeUrls, transformConfig = {}) {
    const cfg = normalizeConfig(transformConfig);
    if (!cfg.enabled) return nodeUrls;

    const sortKeys = cfg.sort.enabled ? cfg.sort.keys || [] : [];
    const sortKeySet = new Set(sortKeys.map((k) => String(k?.key || '')));
    const needServerPort =
        (cfg.dedup.enabled && cfg.dedup.mode !== 'url') ||
        cfg.rename.template.enabled ||
        (cfg.sort.enabled && (sortKeySet.has('server') || sortKeySet.has('port')));

    let records = nodeUrlsToRecords(nodeUrls, {
        needServerPort,
        ensureRegion: false,
    });

    const needRegionEmoji =
        cfg.rename.template.enabled ||
        (cfg.filter.regions.enabled && cfg.filter.regions.values.length > 0) ||
        (cfg.sort.enabled && sortKeySet.has('region')) ||
        (cfg.filter.script.enabled && cfg.filter.script.expression);

    // Stage 1: 正则过滤
    if (cfg.filter.include.enabled && cfg.filter.include.rules.length > 0) {
        records = records.filter((r) => matchesRegexRules(r.name, cfg.filter.include.rules));
    }
    // ... (rest of the pipe remains similar but simplified)

    if (cfg.filter.exclude.enabled && cfg.filter.exclude.rules.length > 0) {
        records = records.filter((r) => !matchesRegexRules(r.name, cfg.filter.exclude.rules));
    }

    if (cfg.filter.protocols.enabled && cfg.filter.protocols.values.length > 0) {
        const allowedProtocols = new Set(
            cfg.filter.protocols.values.map((value) => normalizeProtocol(value))
        );
        records = records.filter((r) => allowedProtocols.has(r.protocol));
    }

    if (cfg.filter.regions.enabled && cfg.filter.regions.values.length > 0) {
        const allowedRegions = new Set(cfg.filter.regions.values.map((value) => toRegionZh(value)));
        records = records
            .map((r) => ensureRegionInfo(r, cfg.enableEmoji))
            .filter((r) => allowedRegions.has(r.regionZh));
    }

    if (cfg.filter.script.enabled && cfg.filter.script.expression) {
        records = records
            .map((r, index) => ({
                ...(needRegionEmoji ? r : ensureRegionInfo(r, cfg.enableEmoji)),
                index: index + 1,
            }))
            .filter((r) => Boolean(evaluateScriptExpression(r, cfg.filter.script.expression)));
    }

    if (cfg.filter.useless.enabled) {
        records = records.filter((r) => !isUselessNode(r));
    }

    // Stage 2: 正则重命名
    if (cfg.rename.regex.enabled && cfg.rename.regex.rules.length > 0) {
        records = records.map((r) => {
            const newName = applyRegexRename(r.name, cfg.rename.regex.rules, r);
            return {
                ...r,
                name: newName,
            };
        });
    }

    // Stage 3: 智能去重
    if (cfg.dedup.enabled) {
        if (cfg.dedup.mode === 'url') {
            const seen = new Set();
            records = records.filter((r) => {
                if (seen.has(r.url)) return false;
                seen.add(r.url);
                return true;
            });
        } else {
            const map = new Map();
            for (const r of records) {
                const key = makeDedupKey(r, cfg);
                if (!key) {
                    map.set(`__raw__:${r.url}`, r);
                    continue;
                }
                map.set(key, choosePreferred(map.get(key), r, cfg.dedup.prefer.protocolOrder));
            }
            records = Array.from(map.values());
        }
    }

    // 去重后再计算 region/emoji：修复"正则改名后 region 未更新"问题，并减少大列表开销
    // 注意：extractNodeRegion 返回中文地区名，我们需要同时保存中文名和代码
    if (needRegionEmoji) {
        records = records.map((r) => ensureRegionInfo(r, cfg.enableEmoji));
    }

    // Stage 4: 受限表达式改写
    if (cfg.rename.script.enabled && cfg.rename.script.expression) {
        records = records.map((r, index) => {
            const enriched = needRegionEmoji ? r : ensureRegionInfo(r, cfg.enableEmoji);
            const newName = applyScriptRename(
                { ...enriched, index: index + 1 },
                cfg.rename.script.expression
            );
            return {
                ...enriched,
                name: newName,
                url: newName ? setNodeName(enriched.url, enriched.protocol, newName) : enriched.url,
            };
        });
    }

    // Stage 5: 模板重命名
    if (cfg.rename.template.enabled) {
        const templateHasEmoji = cfg.rename.template.template.includes('{emoji}');
        const groupBuckets = new Map();
        for (const r of records) {
            const gk = getIndexGroupKey(r, cfg.rename.template.indexScope);
            const arr = groupBuckets.get(gk) || [];
            arr.push(r);
            groupBuckets.set(gk, arr);
        }

        // [Modified] Remove forced sorting to preserve original node order
        // Users can enable explicit sorting if they want deterministic ordering
        // arr.sort((a, b) => { ... });

        const nextIndex = new Map();
        for (const [gk, arr] of groupBuckets.entries()) {
            nextIndex.set(gk, cfg.rename.template.indexStart);
            for (const r of arr) {
                const regionText = cfg.rename.template.regionAlias[r.region] || r.region;
                const protocolText = cfg.rename.template.protocolAlias[r.protocol] || r.protocol;
                const currentIndex = nextIndex.get(gk);
                nextIndex.set(gk, currentIndex + 1);

                const vars = {
                    emoji: r.emoji,
                    region: regionText,
                    protocol: protocolText,
                    index: padIndex(currentIndex, cfg.rename.template.indexPad),
                    name: templateHasEmoji ? stripLeadingEmoji(r.name) : r.name,
                    server: r.server,
                    port: r.port,
                };
                const newName = renderTemplate(cfg.rename.template.template, vars, r);
                r.name = newName;
                r.url = setNodeName(r.url, r.protocol, newName);
            }
        }
    } else if (cfg.rename.regex.enabled && cfg.rename.regex.rules.length > 0) {
        // 仅正则时也要写回 URL
        records = records.map((r) => ({
            ...r,
            url: r.name ? setNodeName(r.url, r.protocol, r.name) : r.url,
        }));
    }

    // Stage 6: 排序
    if (cfg.sort.enabled && cfg.sort.keys.length > 0) {
        records.sort(makeComparator(cfg.sort));
    }

    return records.map((r) => r.url);
}
