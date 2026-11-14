/**
 * 节点列表刷新：组装生成参数（前缀/转换/算子/URL 覆盖）并调用
 * generateCombinedNodeList，随后按来源健康度写缓存。
 * 从 main-handler.js 的 handleMisubRequest 拆分而来；编排器的包装函数
 * 保持可接受多余参数（后台刷新调用），本实现不依赖该标记。
 */

import { generateCombinedNodeList } from '../../../services/subscription-service.ts';

import type { KvRecord } from '../../../../types/models.ts';
import {
    isLikelyPartialAggregateNodeList,
    isSuspiciousNodeCountDrop,
    setCache,
} from '../../../services/node-cache-service.ts';

/** refreshSubscriptionNodes 入参 */
interface RefreshSubscriptionNodesInput {
    context: KvRecord;
    request: Request;
    url: URL;
    config: KvRecord;
    allProfiles: KvRecord[];
    userAgentHeader: string;
    targetFormat: string;
    profileIdentifier: unknown;
    token: unknown;
    subName: string;
    targetMisubs: KvRecord[];
    prependedContentForSubconverter: string;
    ruleLevel: string;
    urlInclude?: string | null;
    urlExclude?: string | null;
    urlRename?: string | null;
    urlEmoji?: string | null;
    cacheKey: string;
    storageAdapter: Parameters<typeof setCache>[0];
}

export async function refreshSubscriptionNodes({
    context,
    request,
    url,
    config,
    allProfiles,
    userAgentHeader,
    targetFormat,
    profileIdentifier,
    token,
    subName,
    targetMisubs,
    prependedContentForSubconverter,
    ruleLevel,
    urlInclude,
    urlExclude,
    urlRename,
    urlEmoji,
    cacheKey,
    storageAdapter,
}: RefreshSubscriptionNodesInput) {
    // 组合节点列表
    // 传递 context 对象以获取请求信息用于日志记录
    context.startTime = Date.now();

    // Prepare log metadata to pass down
    const clientIp =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Real-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'N/A';
    const country = request.headers.get('CF-IPCountry') || 'N/A';
    const domain = url.hostname;

    context.logMetadata = {
        clientIp,
        geoInfo: {
            country,
            city: request.cf?.city,
            isp: request.cf?.asOrganization,
            asn: request.cf?.asn,
        },
        format: targetFormat,
        token: profileIdentifier ? profileIdentifier : token,
        type: profileIdentifier ? 'profile' : 'token',
        domain,
    };

    const activeProfile = profileIdentifier
        ? allProfiles.find(
              (p) => (p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier
          )
        : null;

    // 设置优先级：订阅组设置 > 全局设置 > 内置默认值
    // prefixSettings 回退逻辑
    const globalPrefixSettings = config.defaultPrefixSettings || {};
    const profilePrefixSettings = activeProfile?.prefixSettings || null;
    const effectivePrefixSettings = { ...globalPrefixSettings };

    if (profilePrefixSettings && typeof profilePrefixSettings === 'object') {
        if (
            profilePrefixSettings.enableManualNodes !== null &&
            profilePrefixSettings.enableManualNodes !== undefined
        ) {
            effectivePrefixSettings.enableManualNodes = profilePrefixSettings.enableManualNodes;
        }
        if (
            profilePrefixSettings.enableSubscriptions !== null &&
            profilePrefixSettings.enableSubscriptions !== undefined
        ) {
            effectivePrefixSettings.enableSubscriptions = profilePrefixSettings.enableSubscriptions;
        }
        if (
            profilePrefixSettings.manualNodePrefix &&
            profilePrefixSettings.manualNodePrefix.trim() !== ''
        ) {
            effectivePrefixSettings.manualNodePrefix = profilePrefixSettings.manualNodePrefix;
        }
    }

    // nodeTransform 回退逻辑
    const globalNodeTransform = config.defaultNodeTransform || {};
    const globalNodeTransformPresets = Array.isArray(config.nodeTransformPresets)
        ? config.nodeTransformPresets
        : [];
    const profileNodeTransform = activeProfile?.nodeTransform ?? null;
    const profileNodeTransformPresetId = activeProfile?.nodeTransformPresetId || '';
    const profilePresetNodeTransform = profileNodeTransformPresetId
        ? globalNodeTransformPresets.find((item) => item?.id === profileNodeTransformPresetId)
              ?.config || null
        : null;
    const hasProfileNodeTransform =
        profileNodeTransform && Object.keys(profileNodeTransform).length > 0;

    // nodeTransform 使用整体覆盖逻辑
    const effectiveNodeTransform = hasProfileNodeTransform
        ? profileNodeTransform
        : profilePresetNodeTransform || globalNodeTransform;

    const generationSettings = {
        ...effectivePrefixSettings,
        nodeTransform: { ...effectiveNodeTransform },
        name: subName,
        operators: Array.isArray(activeProfile?.operators) ? [...activeProfile.operators] : [],
        exclude: urlExclude || activeProfile?.exclude,
        include: urlInclude || activeProfile?.include,
        // [Issue #345] 透传 emoji 开关到内置生成器
        addFlagEmoji: effectiveNodeTransform.addFlagEmoji,
    };

    // [Subconverter API] 动态注入更名算子 (rename=old@new|A@B)
    if (urlRename) {
        const renameGroups = urlRename.split('|');
        renameGroups.forEach((group: string) => {
            const [regex, replace] = group.split('@');
            if (regex) {
                generationSettings.operators.push({
                    type: 'rename',
                    enabled: true,
                    params: {
                        regex: {
                            enabled: true,
                            rules: [
                                {
                                    pattern: regex,
                                    replacement: replace || '',
                                    flags: 'gi',
                                },
                            ],
                        },
                    },
                });
            }
        });
    }

    // [Subconverter API] 控制 Emoji 注入
    if (urlEmoji === 'false') {
        generationSettings.nodeTransform.addFlagEmoji = false;
        generationSettings.nodeTransform.removeFlagEmoji = true;
    } else if (urlEmoji === 'true') {
        generationSettings.nodeTransform.addFlagEmoji = true;
    }

    const freshNodes = await generateCombinedNodeList(
        context, // 传入完整 context
        { ...config, enableAccessLog: false }, // [Deferred Logging] Disable service-side logging, we will log manually in handler
        userAgentHeader,
        targetMisubs,
        prependedContentForSubconverter,
        {
            ...generationSettings,
            // [强制透传] 确保 ruleLevel 在订阅组内能够生效
            ruleLevel: ruleLevel || generationSettings.ruleLevel,
        }
    );
    const sourceNames = targetMisubs
        .filter((s) => typeof s?.url === 'string' && s.url.startsWith('http'))
        .map((s) => s.name || s.url);
    // 仅在至少一个订阅源真正从远程拉取成功时才刷新缓存时间
    // 如果没有 HTTP 订阅源（纯手动节点/过期订阅组），则始终写入缓存
    const stats = context.generationStats;
    if (!stats?.sourceCount || stats.upstreamSuccessCount > 0) {
        const cacheSaved = await setCache(storageAdapter, cacheKey, freshNodes, sourceNames);
        const freshNodeCount = freshNodes.split('\n').filter((line) => line.trim()).length;
        const existingCache = (cacheSaved ? null : await storageAdapter.get(cacheKey)) as {
            nodeCount?: number;
            nodes?: string;
        } | null;
        const existingNodeCount =
            existingCache?.nodeCount ||
            String(existingCache?.nodes || '')
                .split('\n')
                .filter((line) => line.trim()).length;
        if (
            !cacheSaved &&
            (isSuspiciousNodeCountDrop(existingNodeCount, freshNodeCount) ||
                isLikelyPartialAggregateNodeList(freshNodes))
        ) {
            if (
                existingCache?.nodes &&
                String(existingCache.nodes).trim() &&
                !isLikelyPartialAggregateNodeList(existingCache.nodes)
            ) {
                console.warn(
                    '[MiSub Cache] Serving preserved aggregate cache after rejecting a suspicious refresh'
                );
                return existingCache.nodes;
            }
        }
    }
    return freshNodes;
}
