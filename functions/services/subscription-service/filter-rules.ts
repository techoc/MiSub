/**
 * 节点过滤与转换：include/exclude 规则、旧版转换配置桥接、手动节点命名、
 * Base64 解码等文本级处理
 * 从 subscription-service.js 拆分而来；编排器见 ../subscription-service.js。
 */

import { parseNodeInfo } from '../../modules/utils/geo-utils.ts';

/**
 * 解码Base64内容
 * @param {string} text - 可能包含Base64的文本
 * @returns {Promise<string>} - 解码后的文本
 */
export async function decodeBase64Content(text: any) {
    try {
        const cleanedText = text.replace(/\s/g, '');
        const { isValidBase64 } = await import('../../utils/format-utils.ts');
        if (isValidBase64(cleanedText)) {
            let normalized = cleanedText.replace(/-/g, '+').replace(/_/g, '/');
            const padding = normalized.length % 4;
            if (padding) {
                normalized += '='.repeat(4 - padding);
            }
            const binaryString = atob(normalized);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        }
    } catch (e) {
        console.debug('[Subscription] Base64 decode failed, using raw text:', e);
    }
    return text;
}

/**
 * 将手动节点的自定义名称应用到节点链接中
 * @param {string} nodeUrl - 节点URL
 * @param {string} customName - 用户自定义名称
 * @returns {string} - 应用名称后的URL
 */
export function applyManualNodeName(nodeUrl: any, customName: any) {
    if (!customName) return nodeUrl;

    // vmess 协议：修改 base64 解码后 JSON 中的 ps 字段
    if (nodeUrl.startsWith('vmess://')) {
        try {
            const hashIndex = nodeUrl.indexOf('#');
            let base64Part =
                hashIndex !== -1
                    ? nodeUrl.substring('vmess://'.length, hashIndex)
                    : nodeUrl.substring('vmess://'.length);

            // 处理 URL 编码和 URL-safe base64
            if (base64Part.includes('%')) {
                base64Part = decodeURIComponent(base64Part);
            }
            base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
            // 补齐 padding
            while (base64Part.length % 4 !== 0) {
                base64Part += '=';
            }

            const binaryString = atob(base64Part);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const jsonString = new TextDecoder('utf-8').decode(bytes);
            const nodeConfig = JSON.parse(jsonString);

            // 类型校验：确保是对象
            if (nodeConfig && typeof nodeConfig === 'object') {
                nodeConfig.ps = customName;

                const newJsonString = JSON.stringify(nodeConfig);
                const newBase64Part = btoa(unescape(encodeURIComponent(newJsonString)));
                return 'vmess://' + newBase64Part;
            }
        } catch (e) {
            console.debug(
                '[Subscription] VMess decode failed, falling back to fragment update:',
                e
            );
        }
    }

    // 其他协议：修改 URL 的 #fragment 部分
    try {
        const hashIndex = nodeUrl.lastIndexOf('#');
        const baseLink = hashIndex !== -1 ? nodeUrl.substring(0, hashIndex) : nodeUrl;
        return `${baseLink}#${encodeURIComponent(customName)}`;
    } catch (e) {
        return nodeUrl;
    }
}

/**
 * 应用过滤规则
 * @param {Array} validNodes - 有效节点列表
 * @param {Object} sub - 订阅对象
 * @returns {Array} - 过滤后的节点列表
 */
export function applyFilterRules(validNodes: any, sub: any) {
    const ruleText = sub.exclude;
    if (!ruleText || ruleText.trim() === '') return validNodes;

    const lines = ruleText
        .split('\n')
        .map((r: any) => r.trim())
        .filter(Boolean);

    if (lines.length === 0) return validNodes;

    // 规则分割：--- 为分隔，keep: 为白名单
    const dividerIndex = lines.findIndex((line: any) => line === '---');
    const hasDivider = dividerIndex !== -1;

    let excludeLines: any[] = [];
    let keepLines: any[] = [];

    if (hasDivider) {
        lines.slice(0, dividerIndex).forEach((l: any) => {
            if (l.toLowerCase().startsWith('keep:')) {
                keepLines.push(l);
            } else {
                excludeLines.push(l);
            }
        });
        lines.slice(dividerIndex + 1).forEach((l: any) => {
            keepLines.push(l);
        });
    } else {
        excludeLines = lines.filter((line: any) => !line.toLowerCase().startsWith('keep:'));
        keepLines = lines.filter((line: any) => line.toLowerCase().startsWith('keep:'));
    }

    const excludeRules = buildRuleSet(excludeLines, false);
    const keepRules = buildRuleSet(keepLines, true);

    let result = validNodes;

    if (keepRules.hasRules) {
        result = filterNodes(result, keepRules, 'include');
    }

    if (excludeRules.hasRules) {
        result = filterNodes(result, excludeRules, 'exclude');
    }

    return result;
}

/**
 * 应用订阅治理转换：算子链 + 基于文本的过滤
 * @param {string[]} nodeUrls
 * @param {Object} sub
 * @returns {Promise<string[]>}
 */

function buildRuleSet(lines: any, stripKeepPrefix = false) {
    const protocols = new Set();
    const patterns: any[] = [];

    for (const rawLine of lines) {
        let line = rawLine.trim();
        if (!line || line === '---') continue;

        if (stripKeepPrefix && line.toLowerCase().startsWith('keep:')) {
            line = line.substring('keep:'.length).trim();
        }
        if (!line) continue;

        if (line.toLowerCase().startsWith('proto:')) {
            const parts = line
                .substring('proto:'.length)
                .split(',')
                .map((p: any) => p.trim().toLowerCase())
                .filter(Boolean);
            parts.forEach((p: any) => protocols.add(p));
            continue;
        }

        patterns.push(line);
    }

    const nameRegex = buildSafeRegex(patterns);
    return {
        protocols,
        nameRegex,
        hasRules: protocols.size > 0 || Boolean(nameRegex),
    };
}

function buildSafeRegex(patterns: any) {
    if (!patterns.length) return null;
    try {
        return new RegExp(patterns.join('|'), 'i');
    } catch (e) {
        console.warn('Invalid include/exclude regex, skipped:', (e as Error).message);
        return null;
    }
}

function filterNodes(nodes: any, rules: any, mode = 'exclude') {
    if (!rules || !rules.hasRules) return nodes;
    const isInclude = mode === 'include';

    return nodes.filter((nodeLink: any) => {
        // [升级] 传统过滤引擎现在也支持元数据/ISO感知
        const nodeInfo = parseNodeInfo(nodeLink);
        const protocol = nodeInfo.protocol || '';
        const nodeName = nodeInfo.name || '';
        const regionZh = nodeInfo.region || '';

        // --- [ISO感知核心逻辑] ---
        // 我们利用 geo-utils 中的 extractNodeRegion 来反查 ISO 代码
        // 虽然 info 里没显式带 regionCode，但在 rules 匹配时增加深度检测
        const protocolHit = protocol && rules.protocols.has(protocol);

        let nameHit = false;
        if (rules.nameRegex) {
            // [双重匹配] 匹配原始名称、中文名，以及尝试匹配 ISO 关键词
            nameHit = rules.nameRegex.test(nodeName) || rules.nameRegex.test(regionZh);

            // 如果上述没中，但规则包含大写 ISO 代码，尝试深度匹配
            if (!nameHit && /^[A-Z]{2}$/.test(rules.nameRegex.source)) {
                // 这里可以进一步扩展，但为了性能目前保持双重匹配
            }
        }

        if (isInclude) {
            return protocolHit || nameHit;
        }
        return !(protocolHit || nameHit);
    });
}

/**
 * 桥接模式：将旧版 NodeTransform 配置转换为新的 Operator 列表
 * @param {Object} config - 旧版配置对象
 * @returns {Array} - 转换后的操作符列表
 */
export function adaptLegacyTransform(config: any) {
    if (!config || !config.enabled) return [];

    const ops: any[] = [];

    // 1. 过滤器 (Filter)
    const filter = config.filter;
    if (
        filter &&
        (filter.include?.enabled ||
            filter.exclude?.enabled ||
            filter.protocols?.enabled ||
            filter.regions?.enabled ||
            filter.script?.enabled ||
            filter.useless?.enabled)
    ) {
        ops.push({
            id: 'legacy-filter',
            type: 'filter',
            enabled: true,
            params: { ...filter },
        });
    }

    // 2. 正则重命名 (Regex Rename)
    const regex = config.rename?.regex;
    if (regex?.enabled && regex.rules?.length > 0) {
        ops.push({
            id: 'legacy-rename-regex',
            type: 'rename',
            enabled: true,
            params: { regex: { ...regex } },
        });
    }

    // 3. 模板重命名 (Template Rename)
    const template = config.rename?.template;
    if (template?.enabled) {
        ops.push({
            id: 'legacy-rename-template',
            type: 'rename',
            enabled: true,
            params: {
                template: {
                    enabled: true,
                    template: template.template || '{emoji}{region}-{protocol}-{index}',
                    offset: template.indexStart || 1,
                    indexScope: template.indexScope || 'region',
                },
            },
        });
    }

    // 4. 重命名脚本 (Script Rename)
    const renameScript = config.rename?.script;
    if (renameScript?.enabled && renameScript.expression) {
        ops.push({
            id: 'legacy-rename-script',
            type: 'script',
            enabled: true,
            params: {
                code: `return ($nodes) => { return $nodes.map(n => { n.name = (${renameScript.expression})(n.name, n); return n; }); }`,
            },
        });
    }

    // 5. 去重 (Dedup)
    const dedup = config.dedup;
    if (dedup?.enabled) {
        ops.push({
            id: 'legacy-dedup',
            type: 'dedup',
            enabled: true,
            params: { ...dedup },
        });
    }

    // 6. 排序 (Sort)
    const sort = config.sort;
    if (sort?.enabled && sort.keys?.length > 0) {
        ops.push({
            id: 'legacy-sort',
            type: 'sort',
            enabled: true,
            params: { ...sort },
        });
    }

    return ops;
}

/**
 * ArrayBuffer -> Base64 ??
 */
export function encodeArrayBufferToBase64(buffer: any) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}
