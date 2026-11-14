import { StorageFactory } from '../../storage-adapter.ts';
import { createJsonResponse } from '../utils.ts';
import { parseNodeInfo } from '../utils/geo-utils.ts';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.ts';
import { applyNodeTransformPipeline } from '../../utils/node-transformer.ts';
import { runOperatorChain } from '../../utils/operator-runner.ts';
import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS, DEFAULT_SETTINGS } from '../config.ts';
import { fetchSubscriptionNodes } from './node-fetcher.ts';
import { applyManualNodeName } from '../utils/node-cleaner.ts';
import type { KvRecord, SubscriptionItem } from '../../../types/models.ts';

/** profile-handler 用到的存储适配器最小面 */
interface ProfileStorageAdapter {
    get(key: string): Promise<unknown>;
    getProfileById?(id: string): Promise<unknown>;
    getSubscriptionsByIds?(ids: string[]): Promise<unknown[]>;
}

/** 订阅组记录（KV misub_profiles_v1 元素） */
interface ProfileRecord {
    id?: string;
    customId?: string;
    name?: string;
    enabled?: boolean;
    subscriptions?: Array<string | { id?: string }>;
    manualNodes?: Array<string | SubscriptionItem>;
    subProfiles?: string[];
    nodeTransformPresetId?: string;
    nodeTransform?: {
        enabled?: boolean;
        operators?: unknown;
        rename?: { template?: { template?: string } };
        [key: string]: unknown;
    };
    operators?: unknown;
    [key: string]: unknown;
}

/** 旧版转换配置 */
interface LegacyTransformConfig {
    enabled?: boolean;
    filter?: {
        include?: { enabled?: boolean };
        exclude?: { enabled?: boolean };
        protocols?: { enabled?: boolean };
        regions?: { enabled?: boolean };
        script?: { enabled?: boolean };
        useless?: { enabled?: boolean };
        [key: string]: unknown;
    };
    rename?: {
        regex?: { enabled?: boolean; rules?: unknown[] };
        template?: {
            enabled?: boolean;
            template?: string;
            indexStart?: number;
            indexScope?: string;
        };
        script?: { enabled?: boolean; expression?: string };
        [key: string]: unknown;
    };
    dedup?: { enabled?: boolean; [key: string]: unknown };
    sort?: { enabled?: boolean; keys?: unknown[]; [key: string]: unknown };
    [key: string]: unknown;
}

/** 转换算子 */
interface TransformOp {
    id: string;
    type: string;
    enabled: boolean;
    params: Record<string, unknown>;
}

function ensureArray(data: unknown): unknown[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function adaptLegacyTransform(config: LegacyTransformConfig | null | undefined): TransformOp[] {
    if (!config || !config.enabled) return [];

    const ops: TransformOp[] = [];
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
        ops.push({ id: 'legacy-filter', type: 'filter', enabled: true, params: { ...filter } });
    }

    const regex = config.rename?.regex;
    if (regex?.enabled && (regex.rules?.length ?? 0) > 0) {
        ops.push({
            id: 'legacy-rename-regex',
            type: 'rename',
            enabled: true,
            params: { regex: { ...regex } },
        });
    }

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

    const renameScript = config.rename?.script;
    if (renameScript?.enabled && renameScript.expression) {
        ops.push({
            id: 'legacy-rename-script',
            type: 'script',
            enabled: true,
            params: { dsl: [{ action: 'rename', template: renameScript.expression }] },
        });
    }

    const dedup = config.dedup;
    if (dedup?.enabled) {
        ops.push({ id: 'legacy-dedup', type: 'dedup', enabled: true, params: { ...dedup } });
    }

    const sort = config.sort;
    if (sort?.enabled && (sort.keys?.length ?? 0) > 0) {
        ops.push({ id: 'legacy-sort', type: 'sort', enabled: true, params: { ...sort } });
    }

    return ops;
}

/**
 * 处理订阅组模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} profileId - 订阅组ID
 * @param {string} userAgent - 用户代理
 * @param {boolean} applyTransform - 是否应用节点转换规则（智能重命名、前缀等）
 * @returns {Promise<Object>} 处理结果
 */
export async function handleProfileMode(
    request: Request,
    env: Env,
    profileId: string,
    userAgent: string,
    applyTransform = false,
    skipCertVerify = false,
    depth = 0,
    visited = new Set<string>()
): Promise<Record<string, unknown> | Response> {
    if (depth > 3 || (profileId && visited.has(profileId))) {
        console.warn(
            `[Profile Nesting] 触发深度超限或循环引用保护: profileId=${profileId}, depth=${depth}`
        );
        return {
            success: false,
            subscriptions: [],
            nodes: [],
            totalCount: 0,
            stats: { protocols: {}, regions: {} },
            error: '循环引用或嵌套层级过深',
        };
    }

    const storageAdapter = StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );

    const adapter = storageAdapter as unknown as ProfileStorageAdapter;
    let profile: ProfileRecord | null = null;
    if (typeof adapter.getProfileById === 'function') {
        profile = (await adapter.getProfileById(profileId)) as ProfileRecord | null;
    } else {
        const rawProfiles = await adapter.get(KV_KEY_PROFILES);
        const profileList = Array.isArray(rawProfiles) ? (rawProfiles as ProfileRecord[]) : [];
        profile =
            profileList.find(
                (p) => (p.customId && p.customId === profileId) || p.id === profileId
            ) ?? null;
    }
    const settings =
        ((await adapter.get(KV_KEY_SETTINGS)) as Record<string, unknown> | null) ||
        (DEFAULT_SETTINGS as unknown as Record<string, unknown>);

    if (!profile || !profile.enabled) {
        return createJsonResponse({ error: '订阅组不存在或已禁用' }, 404);
    }

    const relatedIds: string[] = [
        ...(Array.isArray(profile.subscriptions)
            ? profile.subscriptions.map((item) => (typeof item === 'object' ? item.id || '' : item))
            : []),
        ...(Array.isArray(profile.manualNodes)
            ? profile.manualNodes.map((item) => (typeof item === 'object' ? item.id || '' : item))
            : []),
    ].filter((id): id is string => Boolean(id));
    let relatedSubs: SubscriptionItem[];
    if (typeof adapter.getSubscriptionsByIds === 'function') {
        relatedSubs = (await adapter.getSubscriptionsByIds(
            Array.from(new Set(relatedIds))
        )) as SubscriptionItem[];
    } else {
        const rawSubs = await adapter.get(KV_KEY_SUBS);
        relatedSubs = Array.isArray(rawSubs) ? (rawSubs as SubscriptionItem[]) : [];
    }
    const misubMap = new Map<string, SubscriptionItem>(
        relatedSubs.map((item): [string, SubscriptionItem] => [item.id, item])
    );

    const targetMisubs: SubscriptionItem[] = [];
    const profileSubIds = (profile.subscriptions || [])
        .map((item) => (typeof item === 'object' ? item.id || '' : item))
        .filter((id): id is string => Boolean(id));
    profileSubIds.forEach((id) => {
        const sub = misubMap.get(id);
        if (sub && sub.enabled && /^https?:\/\//i.test(String(sub.url || ''))) {
            targetMisubs.push(sub);
        }
    });

    const targetManualNodes: SubscriptionItem[] = [];
    const profileNodeIds = profile.manualNodes || [];
    if (Array.isArray(profileNodeIds)) {
        profileNodeIds.forEach((entry) => {
            const id = typeof entry === 'object' ? entry.id || '' : entry;
            const node = misubMap.get(id);
            if (node && node.enabled) targetManualNodes.push(node);
        });
    }

    const httpProxyPattern = /^https?:\/\/[^/?#]+:\d+(?:[/?#]|$)/i;
    const targetSubscriptions = targetMisubs.filter(
        (sub) => !httpProxyPattern.test(String(sub.url || ''))
    );
    const httpProxyNodes = targetMisubs.filter((sub) =>
        httpProxyPattern.test(String(sub.url || ''))
    );
    const seenManualIds = new Set<string>();
    const allManualNodes: SubscriptionItem[] = [];
    for (const node of [...httpProxyNodes, ...targetManualNodes]) {
        const key = node?.id || node?.url;
        if (!node || (key && seenManualIds.has(key))) continue;
        if (key) seenManualIds.add(key);
        allManualNodes.push(node);
    }
    // 处理手工节点（直接解析节点URL），并将用户自定义名称写入 URL。
    const manualNodeResults = allManualNodes.map((node) => {
        const customName = typeof node.name === 'string' ? node.name.trim() : '';
        const effectiveUrl = customName
            ? applyManualNodeName(String(node.url || ''), customName)
            : String(node.url || '');

        const nodeInfo = parseNodeInfo(effectiveUrl);
        return {
            subscriptionName: node.name || '手工节点',
            group: node.group || '',
            url: effectiveUrl,
            success: true,
            nodes: [
                {
                    ...nodeInfo,
                    url: effectiveUrl,
                    subscriptionName: node.name || '手工节点',
                    group: node.group || '',
                },
            ],
            error: null,
            isManualNode: true,
        };
    });

    // 并行获取HTTP订阅节点（开启保护性缓存时，上游失败回退缓存节点，与输出链路一致）
    const subscriptionResults = await Promise.all(
        targetSubscriptions.map((sub) =>
            fetchSubscriptionNodes(
                String(sub.url || ''),
                sub.name,
                userAgent,
                sub.customUserAgent,
                false,
                sub.exclude,
                sub.fetchProxy,
                skipCertVerify,
                Boolean(sub?.plusAsSpace),
                sub?.enableNodeCache === true,
                storageAdapter,
                sub
            )
        )
    );

    // 3. 处理嵌套的组合订阅 (Sub-Profiles)
    const profileSubProfileIds = profile.subProfiles || [];
    const nestedSubProfileResults: Array<Record<string, unknown>> = [];
    if (Array.isArray(profileSubProfileIds) && profileSubProfileIds.length > 0 && depth < 3) {
        const nextVisited = new Set(visited);
        if (profile.id) nextVisited.add(profile.id);
        if (profile.customId) nextVisited.add(profile.customId);

        for (const subProfileId of profileSubProfileIds) {
            if (!subProfileId || nextVisited.has(subProfileId)) {
                console.warn(`[Profile Nesting] 跳过循环引用或空子订阅组: ${subProfileId}`);
                continue;
            }
            try {
                const subResult = await handleProfileMode(
                    request,
                    env,
                    subProfileId,
                    userAgent,
                    true, // 应用子订阅自身的算子与清洗规则
                    skipCertVerify,
                    depth + 1,
                    nextVisited
                );
                if (
                    !(subResult instanceof Response) &&
                    subResult.success &&
                    Array.isArray(subResult.nodes)
                ) {
                    nestedSubProfileResults.push({
                        subscriptionName: subResult.profileName || '组合订阅',
                        group: subResult.profileName || '组合订阅',
                        url: `profile://${subProfileId}`,
                        success: true,
                        nodes: subResult.nodes,
                        error: null,
                        isSubProfile: true,
                    });
                }
            } catch (err) {
                console.error(`[Profile Nesting] 拉取子订阅组异常 ${subProfileId}:`, err);
            }
        }
    }

    // 合并所有结果
    const allResults = [...subscriptionResults, ...manualNodeResults, ...nestedSubProfileResults];

    // 统计所有节点
    const allNodes: KvRecord[] = [];
    allResults.forEach((result) => {
        if (result.success) {
            const nodes = Array.isArray(result.nodes) ? result.nodes : [];
            allNodes.push(...nodes);
        }
    });

    // 如果需要应用转换规则，则处理节点名称
    let processedNodes: KvRecord[] = allNodes;
    const presetNodeTransform: LegacyTransformConfig | null = profile.nodeTransformPresetId
        ? Array.isArray(settings.nodeTransformPresets)
            ? ((
                  settings.nodeTransformPresets as Array<{
                      id?: string;
                      config?: LegacyTransformConfig;
                  }>
              ).find((item) => item?.id === profile.nodeTransformPresetId)?.config ?? null)
            : null
        : null;
    const effectiveNodeTransform = profile.nodeTransform?.enabled
        ? (profile.nodeTransform as LegacyTransformConfig)
        : presetNodeTransform;

    if (applyTransform) {
        const nodeUrls = allNodes.map((node) => String(node.url || ''));
        const nodeMetadataByUrl = new Map<string, { group: string }>(
            allNodes.map((node): [string, { group: string }] => [
                String(node.url || ''),
                { group: String(node.group || '') },
            ])
        );

        let activeOperators = ensureArray(profile?.operators);
        if (
            !activeOperators.length &&
            profile?.nodeTransform?.enabled &&
            profile.nodeTransform?.operators
        ) {
            activeOperators = ensureArray(profile.nodeTransform.operators);
        }
        if (!activeOperators.length && settings?.defaultOperators) {
            activeOperators = ensureArray(settings.defaultOperators);
        }
        if (!activeOperators.length && effectiveNodeTransform?.enabled) {
            activeOperators = adaptLegacyTransform({
                ...effectiveNodeTransform,
                enableEmoji: settings.enableFlagEmoji !== false,
            });
        }

        let transformedUrls: string[] = nodeUrls;
        if (activeOperators.length > 0) {
            transformedUrls = await runOperatorChain(nodeUrls, activeOperators, {
                subName: profile?.name,
                userAgent,
                config: settings,
                nodeMetadataByUrl,
            });
        } else if (effectiveNodeTransform?.enabled) {
            const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
            const effectiveTemplate =
                effectiveNodeTransform.rename?.template?.template || defaultTemplate;
            transformedUrls = applyNodeTransformPipeline(nodeUrls, {
                ...effectiveNodeTransform,
                enableEmoji:
                    settings.enableFlagEmoji !== false && effectiveTemplate.includes('{emoji}'),
            });
        }

        processedNodes = transformedUrls.map((transformedUrl) => {
            const nodeInfo = parseNodeInfo(transformedUrl);
            const originalNode = allNodes.find((n) => {
                try {
                    const origUrl = new URL(String(n.url || ''));
                    const transUrl = new URL(transformedUrl);
                    return origUrl.hostname === transUrl.hostname && origUrl.port === transUrl.port;
                } catch {
                    return false;
                }
            });
            return {
                ...nodeInfo,
                subscriptionName:
                    originalNode?.subscriptionName ||
                    String(nodeInfo.subscriptionName || '') ||
                    '未知',
            };
        });
    }

    // 生成统计信息（使用处理后的节点）
    const protocolStats = calculateProtocolStats(processedNodes);
    const regionStats = calculateRegionStats(processedNodes);

    return {
        success: true,
        profileName: profile.name || '',
        subscriptions: allResults,
        nodes: processedNodes,
        totalCount: processedNodes.length,
        stats: {
            protocols: protocolStats,
            regions: regionStats,
        },
    };
}
