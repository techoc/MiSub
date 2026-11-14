/**
 * MiSub Operator Runner
 * Implements Sub-Store like operators for node transformation.
 */

import * as NodeUtils from './node-transformer.ts';
import { extractNodeRegion, getRegionEmoji } from '../modules/utils/geo-utils.ts';
import { matchesDslCondition, renderDslTemplate } from './expression-dsl.ts';

import type { KvRecord } from '../../types/models.ts';

/** 重命名/过滤规则（字符串或 { pattern, flags, replacement } 对象） */
type OperatorRule = { pattern: string; flags?: string; replacement?: string };
type NormalizedRule = string | OperatorRule;

/** 规则组（include/exclude/protocols/regions 共用） */
interface RuleGroup {
    enabled?: boolean;
    rules?: unknown;
    values?: unknown;
}

/** filter 算子参数 */
interface OperatorFilterParams {
    include?: RuleGroup;
    exclude?: RuleGroup;
    protocols?: RuleGroup;
    regions?: RuleGroup;
}

/** rename 算子参数 */
interface OperatorRenameParams {
    regex?: RuleGroup;
    template?: {
        enabled?: boolean;
        template?: string;
        indexScope?: string;
        scope?: string;
        offset?: number;
        indexStart?: number;
    };
}

/** sort 算子参数 */
interface OperatorSortParams {
    keys?: Array<{ key?: unknown }>;
}

/** 算子定义（operators 数组元素） */
interface OperatorDefinition {
    type?: string;
    params?: unknown;
    enabled?: boolean;
}

/** script 算子单步 DSL */
type ScriptStep = { action?: unknown; template?: unknown; expression?: unknown };

/**
 * 辅助函数：将规则模式规范化为正则表达式数组
 */
function normalizeRules(rules: unknown): NormalizedRule[] {
    if (!rules) return [];
    if (!Array.isArray(rules)) {
        if (typeof rules === 'string')
            return rules
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
        return [];
    }

    const normalized: NormalizedRule[] = [];
    for (const rule of rules) {
        if (typeof rule === 'string') {
            // 支持在单个算子输入中通过 | 或 换行符 传递多个子规则
            const parts = rule
                .split(/\r?\n/)
                .map((p) => p.trim())
                .filter(Boolean);
            normalized.push(...parts);
        } else if (rule && typeof rule === 'object') {
            const candidate = rule as { pattern?: unknown };
            if (candidate.pattern) normalized.push(rule as OperatorRule);
        }
    }
    return normalized;
}

/**
 * Filter Operator
 */
function opFilter(nodes: KvRecord[], params: OperatorFilterParams | null | undefined) {
    if (!params) return nodes;
    const { include, exclude, protocols, regions } = params;
    let result: KvRecord[] = [...nodes];

    if (include?.enabled) {
        const rules = normalizeRules(include.rules);
        if (rules.length > 0) {
            result = result.filter((r) => {
                const enriched = NodeUtils.ensureRegionInfo(r, true); // 强制获取元数据
                const matchRaw = NodeUtils.matchesRegexRules(r.name, rules);
                const matchClean = r.metadata?.cleanName
                    ? NodeUtils.matchesRegexRules(r.metadata.cleanName, rules)
                    : false;
                const matchRegion =
                    NodeUtils.matchesRegexRules(enriched.regionZh, rules) ||
                    NodeUtils.matchesRegexRules(enriched.region, rules) ||
                    NodeUtils.matchesRegexRules(enriched.regionCode, rules); // [新增] ISO 代码匹配

                return matchRaw || matchClean || matchRegion;
            });
        }
    }
    if (exclude?.enabled) {
        const rules = normalizeRules(exclude.rules);
        if (rules.length > 0) {
            result = result.filter((r) => {
                const enriched = NodeUtils.ensureRegionInfo(r, true); // 强制获取元数据
                const matchRaw = NodeUtils.matchesRegexRules(r.name, rules);
                const matchClean = r.metadata?.cleanName
                    ? NodeUtils.matchesRegexRules(r.metadata.cleanName, rules)
                    : false;
                const matchRegion =
                    NodeUtils.matchesRegexRules(enriched.regionZh, rules) ||
                    NodeUtils.matchesRegexRules(enriched.region, rules) ||
                    NodeUtils.matchesRegexRules(enriched.regionCode, rules); // [新增] ISO 代码匹配

                return !(matchRaw || matchClean || matchRegion);
            });
        }
    }
    if (protocols?.enabled && Array.isArray(protocols.values)) {
        const allowed = new Set(protocols.values.map((p) => String(p).toLowerCase()));
        result = result.filter((r) => allowed.has(r.protocol.toLowerCase()));
    }
    if (regions?.enabled && Array.isArray(regions.values)) {
        // Ensure region info is present
        result = result.map((r) => NodeUtils.ensureRegionInfo(r, true));
        const allowed = new Set(regions.values);
        result = result.filter((r) => allowed.has(r.regionZh) || allowed.has(r.region));
    }
    return result;
}

/**
 * Rename Operator
 */
function opRename(nodes: KvRecord[], params: OperatorRenameParams | null | undefined) {
    if (!params) return nodes;
    const { regex, template } = params;
    let result = [...nodes];

    if (regex?.enabled) {
        const rules = normalizeRules(regex.rules);
        if (rules.length > 0) {
            result = result.map((r) => {
                const enriched = NodeUtils.ensureRegionInfo(r, true);
                const vars = {
                    name: r.name,
                    protocol: r.protocol,
                    region: enriched.region,
                    regionZh: enriched.regionZh,
                    emoji: enriched.emoji,
                    server: r.server,
                    port: r.port,
                };

                // 核心增强：允许在正则替换中使用 {regionZh} 等变量
                const processedRules = rules.map((rule) => {
                    if (
                        typeof rule === 'object' &&
                        rule.replacement &&
                        rule.replacement.includes('{')
                    ) {
                        return {
                            ...rule,
                            replacement: NodeUtils.renderTemplate(rule.replacement, vars, r),
                        };
                    }
                    return rule;
                });

                const newName = NodeUtils.applyRegexRename(r.name, processedRules, r);
                if (newName !== r.name) {
                    return {
                        ...r,
                        name: newName,
                        url: NodeUtils.setNodeName(r.url, r.protocol, newName),
                    };
                }
                return r;
            });
        }
    }

    if (template?.enabled && template.template) {
        const counters = new Map<string, number>();
        const scope = template.indexScope || template.scope || 'region'; // 默认按地区分组计数，符合用户直觉

        result = result.map((r, index) => {
            const enriched = NodeUtils.ensureRegionInfo(r, true);

            // 确定索引分组键
            let groupKey = 'global';
            if (scope === 'region') groupKey = `r:${enriched.regionZh || 'Other'}`;
            else if (scope === 'protocol') groupKey = `p:${r.protocol}`;
            else if (scope === 'regionProtocol')
                groupKey = `rp:${enriched.regionZh || 'Other'}|${r.protocol}`;

            const groupIndex = (counters.get(groupKey) || 0) + 1;
            counters.set(groupKey, groupIndex);

            const vars = {
                name: r.name,
                protocol: r.protocol,
                region: enriched.region,
                regionZh: enriched.regionZh,
                emoji: enriched.emoji,
                server: r.server,
                port: r.port,
                index: groupIndex + (Number(template.offset || template.indexStart) || 1) - 1,
                globalIndex: index + (Number(template.offset || template.indexStart) || 1),
            };
            const newName = NodeUtils.renderTemplate(template.template, vars, r);

            if (newName !== r.name) {
                return {
                    ...r,
                    name: newName,
                    url: NodeUtils.setNodeName(r.url, r.protocol, newName),
                };
            }
            return r;
        });
    }

    return result;
}

/**
 * Script Operator (The heart of Sub-Store)
 */
async function opScript(
    nodes: KvRecord[],
    params: Record<string, unknown> = {},
    context: Record<string, unknown> = {}
): Promise<KvRecord[]> {
    const dsl = Array.isArray(params.dsl) ? params.dsl : params.action ? [params] : [];

    if (!dsl.length) {
        if (params.code || params.url) {
            console.warn('[Operator] Legacy script code is disabled; use params.dsl instead.');
        }
        return nodes;
    }

    let result = nodes.map((r) => NodeUtils.ensureRegionInfo(r, true));

    for (const step of dsl) {
        const stepParams = step as ScriptStep;
        const action = String(stepParams.action || '').toLowerCase();
        if (action === 'filter') {
            result = result.filter((node, index) =>
                matchesDslCondition({ ...node, index: index + 1 }, stepParams)
            );
            continue;
        }
        if (action === 'rename') {
            const template = stepParams.template || stepParams.expression;
            if (!template) continue;
            result = result.map((node, index) => {
                const nextName =
                    renderDslTemplate(template, {
                        ...node,
                        index: index + 1,
                        target: context?.target || '',
                    }) || node.name;
                if (nextName === node.name) return node;
                return {
                    ...node,
                    name: nextName,
                    url: NodeUtils.setNodeName(node.url, node.protocol, nextName),
                    metadata: node.metadata
                        ? { ...node.metadata, cleanName: nextName }
                        : node.metadata,
                };
            });
        }
    }

    return result;
}

/**
 * Main Entry Point for Operator Chain
 */
export async function runOperatorChain(
    nodeUrls: string[],
    operators: unknown,
    context: Record<string, unknown> = {}
): Promise<string[]> {
    if (!Array.isArray(operators) || operators.length === 0) {
        return nodeUrls;
    }

    // 1. Convert URLs to Records
    let records: KvRecord[] = NodeUtils.nodeUrlsToRecords(nodeUrls, {
        needServerPort: true,
        ensureRegion: false,
    });
    const rawMetadata = context.nodeMetadataByUrl;
    const metadataByUrl: Map<string, Record<string, unknown>> = rawMetadata instanceof Map
        ? (rawMetadata as Map<string, Record<string, unknown>>)
        : new Map(
              Object.entries((rawMetadata as Record<string, unknown>) || {}) as Array<
                  [string, Record<string, unknown>]
              >
          );
    if (metadataByUrl.size > 0) {
        records = records.map((record) => ({
            ...record,
            ...(metadataByUrl.get(record.url) || {}),
        }));
    }

    const ua = String(context.userAgent || '').toLowerCase();
    const platform = {
        isClash: /clash|mihomo|stash|meta|verge/i.test(ua),
        isSurge: /surge/i.test(ua),
        isQuanX: /quantumult/i.test(ua),
        isLoon: /loon/i.test(ua),
        isShadowrocket: /shadowrocket/i.test(ua),
        isSingBox: /sing-box|singbox/i.test(ua),
        userAgent: context.userAgent,
        target: context.target || 'base64',
    };

    const enrichedContext = { ...context, ...platform };

    // 2. Run Operators sequentially
    for (const operator of operators as OperatorDefinition[]) {
        const { type, params, enabled } = operator;
        if (enabled === false) continue;

        switch (type) {
            case 'filter':
                records = opFilter(records, params as OperatorFilterParams | null | undefined);
                break;
            case 'rename':
                records = opRename(records, params as OperatorRenameParams | null | undefined);
                break;
            case 'script':
                records = await opScript(
                    records,
                    (params as Record<string, unknown>) || {},
                    enrichedContext
                );
                break;
            case 'sort': {
                const sortParams = params as OperatorSortParams | null | undefined;
                if (sortParams && Array.isArray(sortParams.keys)) {
                    const needsRegion = sortParams.keys.some(
                        (k) => k.key === 'region' || k.key === 'regionZh'
                    );
                    if (needsRegion) {
                        records = records.map((r) => NodeUtils.ensureRegionInfo(r, true));
                    }
                    records.sort(NodeUtils.makeComparator({ keys: sortParams.keys }));
                }
                break;
            }
            case 'dedup': {
                const includeProtocol =
                    (params as { includeProtocol?: boolean } | null | undefined)
                        ?.includeProtocol !== false;
                const seenNodes = new Map<string, KvRecord>();
                for (const r of records) {
                    const hostPort = `${r.server}:${r.port}`;
                    const key = includeProtocol ? `${r.protocol}|${hostPort}` : hostPort;
                    if (!seenNodes.has(key)) {
                        seenNodes.set(key, r);
                    } else {
                        const existing = seenNodes.get(key);
                        if (!existing || (r.name || '').length > (existing.name || '').length) {
                            seenNodes.set(key, r);
                        }
                    }
                }
                records = Array.from(seenNodes.values());
                break;
            } // end case 'dedup'
        }
    }

    // 3. Convert Records back to URLs
    return NodeUtils.recordsToNodeUrls(records);
}
