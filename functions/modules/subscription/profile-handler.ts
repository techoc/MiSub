import { StorageFactory } from '../../storage-adapter.ts';
import { createJsonResponse } from '../utils.ts';
import { parseNodeInfo } from '../utils/geo-utils.ts';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.ts';
import { applyNodeTransformPipeline } from '../../utils/node-transformer.ts';
import { runOperatorChain } from '../../utils/operator-runner.ts';
import { KV_KEY_SUBS, KV_KEY_PROFILES, KV_KEY_SETTINGS, DEFAULT_SETTINGS } from '../config.ts';
import { fetchSubscriptionNodes } from './node-fetcher.ts';
import { applyManualNodeName } from '../utils/node-cleaner.ts';

function ensureArray(data: any) {
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

function adaptLegacyTransform(config: any) {
    if (!config || !config.enabled) return [];

    const ops: any[] = [];
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
    if (regex?.enabled && regex.rules?.length > 0) {
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
    if (sort?.enabled && sort.keys?.length > 0) {
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
    request: any,
    env: any,
    profileId: any,
    userAgent: any,
    applyTransform = false,
    skipCertVerify = false,
    depth = 0,
    visited = new Set()
): Promise<Record<string, any>> {
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

    const profile =
        typeof (storageAdapter as Record<string, any>).getProfileById === 'function'
            ? await (storageAdapter as Record<string, any>).getProfileById(profileId)
            : ((await storageAdapter.get(KV_KEY_PROFILES)) || []).find(
                  (p: any) => (p.customId && p.customId === profileId) || p.id === profileId
              );
    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || DEFAULT_SETTINGS;

    if (!profile || !profile.enabled) {
        return createJsonResponse({ error: '订阅组不存在或已禁用' }, 404);
    }

    const relatedIds = [
        ...(Array.isArray(profile.subscriptions)
            ? profile.subscriptions.map((item: any) => (typeof item === 'object' ? item.id : item))
            : []),
        ...(Array.isArray(profile.manualNodes) ? profile.manualNodes : []),
    ].filter(Boolean);
    const relatedSubs =
        typeof (storageAdapter as Record<string, any>).getSubscriptionsByIds === 'function'
            ? await (storageAdapter as Record<string, any>).getSubscriptionsByIds(
                  Array.from(new Set(relatedIds))
              )
            : (await storageAdapter.get(KV_KEY_SUBS)) || [];
    const misubMap = new Map(relatedSubs.map((item: any) => [item.id, item]));

    const targetMisubs: any[] = [];
    const profileSubIds = (profile.subscriptions || []).map((item: any) =>
        typeof item === 'object' ? item.id : item
    );
    profileSubIds.forEach((id: any) => {
        const sub = misubMap.get(id);
        if (
            sub &&
            (sub as Record<string, any>).enabled &&
            /^https?:\/\//i.test((sub as Record<string, any>).url)
        ) {
            targetMisubs.push(sub);
        }
    });

    const targetManualNodes: any[] = [];
    const profileNodeIds = profile.manualNodes || [];
    if (Array.isArray(profileNodeIds)) {
        profileNodeIds.forEach((id) => {
            const node = misubMap.get(id);
            if (node && (node as Record<string, any>).enabled) targetManualNodes.push(node);
        });
    }

    const httpProxyPattern = /^https?:\/\/[^/?#]+:\d+(?:[/?#]|$)/i;
    const targetSubscriptions = targetMisubs.filter((sub) => !httpProxyPattern.test(sub.url));
    const httpProxyNodes = targetMisubs.filter((sub) => httpProxyPattern.test(sub.url));
    const seenManualIds = new Set();
    const allManualNodes: any[] = [];
    for (const node of [...httpProxyNodes, ...targetManualNodes]) {
        const key = node?.id || node?.url;
        if (!node || (key && seenManualIds.has(key))) continue;
        if (key) seenManualIds.add(key);
        allManualNodes.push(node);
    }
    // 处理手工节点（直接解析节点URL），并将用户自定义名称写入 URL。
    const manualNodeResults = allManualNodes.map((node) => {
        const customName =
            typeof (node as Record<string, any>).name === 'string'
                ? ((node as Record<string, any>).name as string).trim()
                : '';
        const effectiveUrl = customName
            ? applyManualNodeName((node as Record<string, any>).url, customName)
            : (node as Record<string, any>).url;

        const nodeInfo = parseNodeInfo(effectiveUrl);
        return {
            subscriptionName: (node as Error).name || '手工节点',
            group: (node as Record<string, any>).group || '',
            url: effectiveUrl,
            success: true,
            nodes: [
                {
                    ...nodeInfo,
                    url: effectiveUrl,
                    subscriptionName: (node as Error).name || '手工节点',
                    group: (node as Record<string, any>).group || '',
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
                sub.url,
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
    const nestedSubProfileResults: any[] = [];
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
                if (subResult.success && Array.isArray(subResult.nodes)) {
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
    const allNodes: any[] = [];
    allResults.forEach((result) => {
        if (result.success) {
            allNodes.push(...result.nodes);
        }
    });

    // 如果需要应用转换规则，则处理节点名称
    let processedNodes = allNodes;
    const presetNodeTransform = profile.nodeTransformPresetId
        ? Array.isArray(settings.nodeTransformPresets)
            ? settings.nodeTransformPresets.find(
                  (item: any) => item?.id === profile.nodeTransformPresetId
              )?.config
            : null
        : null;
    const effectiveNodeTransform = profile.nodeTransform?.enabled
        ? profile.nodeTransform
        : presetNodeTransform;

    if (applyTransform) {
        const nodeUrls = allNodes.map((node) => node.url);
        const nodeMetadataByUrl = new Map(
            allNodes.map((node) => [node.url, { group: node.group || '' }])
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

        let transformedUrls = nodeUrls;
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
                    const origUrl = new URL(n.url);
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
                    (nodeInfo as Record<string, any>).subscriptionName ||
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
