/**
 * MiSub 订阅聚合服务（核心编排）
 *
 * 协作模块拆分在 ./subscription-service/ 子目录：
 *   source-identity（源识别）、runtime-cache（节点缓存/运行时信息）、
 *   upstream-fetch（上游拉取）、filter-rules（过滤与转换）。
 * 本文件保留 generateCombinedNodeList 编排管线与全部历史导出面。
 */

import { parseNodeList } from '../modules/utils/node-parser.ts';
import {
    addFlagEmoji,
    fixNodeUrlEncoding,
    prependNodeName,
    removeFlagEmoji,
    sanitizeNodeForYaml,
} from '../utils/node-utils.ts';
import { getProcessedUserAgent } from '../utils/format-utils.ts';
import { buildFetchProxyUrl } from '../utils/fetch-proxy-utils.ts';
import { runOperatorChain } from '../utils/operator-runner.ts';
import { assertPublicNetworkUrl } from '../modules/security-utils.ts';
import { isSuspiciousNodeCountDrop } from './node-cache-service.ts';

import {
    isRealProxyNode,
    parseSubscriptionProfileTitle,
} from './subscription-service/source-identity.ts';
import {
    buildSubscriptionFilterFingerprint,
    parseSubscriptionUserInfoHeader,
    readSubscriptionNodeCache,
    recordCurrentRequestRuntimeInfo,
    scheduleSubscriptionRuntimeInfoUpdate,
    writeSubscriptionNodeCache,
} from './subscription-service/runtime-cache.ts';
import {
    createConcurrencyLimiter,
    ensureArray,
    fetchWithRetry,
    FETCH_CONFIG,
} from './subscription-service/upstream-fetch.ts';
import {
    adaptLegacyTransform,
    applyFilterRules,
    applyManualNodeName,
    decodeBase64Content,
    encodeArrayBufferToBase64,
} from './subscription-service/filter-rules.ts';

// —— 兼容导出：测试与外部模块历史上直接从本路径引用这些 helper ——
export {
    fetchAirportSiteTitle,
    inferAirportRootDomain,
    isRealProxyNode,
    parseSubscriptionProfileTitle,
} from './subscription-service/source-identity.ts';
export {
    buildSubscriptionFilterFingerprint,
    buildSubscriptionNodeCacheKey,
    parseSubscriptionUserInfoHeader,
    readSubscriptionNodeCache,
} from './subscription-service/runtime-cache.ts';
export { applyFilterRules } from './subscription-service/filter-rules.ts';

/**
 * 生成组合节点列表
 * @param {Object} context - 请求上下文
 * @param {Object} config - 配置对象
 * @param {string} userAgent - 用户代理
 * @param {Array} misubs - 订阅列表
 * @param {string} prependedContent - 预置内容
 * @param {Object} profilePrefixSettings - 配置文件前缀设置
 * @param {boolean} debug - 是否启用调试日志
 * @returns {Promise<string>} - 组合后的节点列表
 */
export async function generateCombinedNodeList(
    context,
    config,
    userAgent,
    misubs,
    prependedContent = '',
    profilePrefixSettings: KvRecord | null = null,
    debug = false,
    skipCertVerify = false
) {
    // 判断是否启用手动节点前缀
    const shouldPrependManualNodes = profilePrefixSettings?.enableManualNodes ?? true;

    // 判断是否在节点名称前添加分组名称
    const prependGroupName = profilePrefixSettings?.prependGroupName ?? false;

    // [修复] 多级 Emoji 开关控制逻辑
    const nodeTransformConfig = profilePrefixSettings?.nodeTransform;
    const templateEnabled =
        nodeTransformConfig?.enabled && nodeTransformConfig?.rename?.template?.enabled;
    const defaultTemplate = '{emoji}{region}-{protocol}-{index}';
    const effectiveTemplate = nodeTransformConfig?.rename?.template?.template || defaultTemplate;
    const templateContainsEmoji = templateEnabled && effectiveTemplate.includes('{emoji}');

    // 确定最终是否保留/添加 Emoji
    // 优先级：nodeTransform.addFlagEmoji (来自 URL 或组件设置) > config.enableFlagEmoji (全局设置)
    const emojiEnabledByConfig = config.enableFlagEmoji !== false;
    const emojiExplicitlyDisabled = nodeTransformConfig?.addFlagEmoji === false;
    const emojiExplicitlyEnabled = nodeTransformConfig?.addFlagEmoji === true;

    let shouldKeepEmoji = emojiEnabledByConfig;
    if (emojiExplicitlyDisabled) shouldKeepEmoji = false;
    if (emojiExplicitlyEnabled) shouldKeepEmoji = true;

    // 强制约束：如果启用了模板命名且模板不含 {emoji}，则必须移除
    if (templateEnabled && !templateContainsEmoji) {
        shouldKeepEmoji = false;
    }

    // 手动节点前缀文本
    const manualNodePrefix = profilePrefixSettings?.manualNodePrefix ?? '\u624b\u52a8\u8282\u70b9';

    // [重要] 当智能重命名模板启用时，跳过前缀添加，因为智能重命名会完全覆盖节点名称
    // 用户可以在模板中使用 {name} 变量来保留原始信息
    const skipPrefixDueToRenaming =
        nodeTransformConfig?.enabled && nodeTransformConfig?.rename?.template?.enabled;

    // --- 阶段 1: 数据准备与手动节点处理 ---

    // [增强修复] 定义统一的订阅源级转换中枢
    const applySubscriptionTransforms = async (nodes, subSource) => {
        if (!nodes || nodes.length === 0) return [];

        let currentNodes = [...nodes];

        // 1. [配置水合] 执行 Workflow 算子 (操作符)
        let subOperators = ensureArray(subSource?.operators);
        if (
            !subOperators.length &&
            subSource?.nodeTransform?.enabled &&
            subSource.nodeTransform.operators
        ) {
            subOperators = ensureArray(subSource.nodeTransform.operators);
        }

        if (subOperators.length > 0) {
            currentNodes = await runOperatorChain(currentNodes, subOperators, {
                subName: subSource?.name,
                userAgent,
                config,
            });
        }

        // 2. 应用传统的文本过滤规则 (exclude/include)
        currentNodes = applyFilterRules(currentNodes, subSource);

        return currentNodes;
    };

    // 重构后的手动节点处理逻辑
    const manualSubSourceGroups = misubs.filter((sub) => {
        if (sub?.isFromSubProfile) return true;
        const url = typeof sub?.url === 'string' ? sub.url.trim() : '';
        return Boolean(url) && !/^https?:\/\//i.test(url);
    });

    let manualProcessedLines: any[] = [];
    for (const sub of manualSubSourceGroups) {
        try {
            const rawUrl = typeof sub?.url === 'string' ? sub.url.trim() : '';
            if (!rawUrl) continue;

            let processedUrl = fixNodeUrlEncoding(rawUrl, {
                plusAsSpace: Boolean(sub?.plusAsSpace),
            });
            const customNodeName = typeof sub.name === 'string' ? sub.name.trim() : '';
            if (customNodeName && !sub?.isFromSubProfile)
                processedUrl = applyManualNodeName(processedUrl, customNodeName);

            const nodeGroup = typeof sub.group === 'string' ? sub.group.trim() : '';
            if (prependGroupName && nodeGroup && !skipPrefixDueToRenaming)
                processedUrl = prependNodeName(processedUrl, nodeGroup);

            const shouldAddPrefix =
                shouldPrependManualNodes && !skipPrefixDueToRenaming && !sub?.isFromSubProfile;
            const finalRawUrl = shouldAddPrefix
                ? prependNodeName(processedUrl, manualNodePrefix)
                : processedUrl;

            // [核心对齐] 对手动节点应用订阅源级转换（算子+过滤 + 组级诊断）
            const transformed = await applySubscriptionTransforms([finalRawUrl], sub);
            if (transformed.length > 0) {
                manualProcessedLines.push(...transformed);
            }
        } catch (e) {
            // Ignore
        }
    }

    const processedManualNodeList = manualProcessedLines.join('\n');

    const httpSubs = misubs.filter(
        (sub) =>
            !sub?.isFromSubProfile &&
            sub &&
            sub.url &&
            /^https?:\/\//i.test(sub.url) &&
            !/^https?:\/\/[^/?#]+:\d+\/?#/i.test(sub.url)
    );
    const limiter = createConcurrencyLimiter(FETCH_CONFIG.CONCURRENCY);
    let upstreamSuccessCount = 0; // 追踪真正从远程拉取成功的订阅数（不含 per-sub 缓存回退）

    /**
     * 获取单个订阅内容
     * @param {Object} sub - 订阅对象
     * @returns {Promise<string>} - 处理后的节点列表
     */
    const fetchSingleSubscription = async (sub) => {
        const cacheEnabled = sub?.enableNodeCache === true;
        const storage = context?.storage;
        const recordEmptyRuntimeInfo = () => {
            if (cacheEnabled) return;
            const runtimeInfo = {
                nodeCount: 0,
                userInfo: null,
            };
            recordCurrentRequestRuntimeInfo(context, sub, runtimeInfo);
            scheduleSubscriptionRuntimeInfoUpdate(context, storage, sub, runtimeInfo);
        };
        const readCachedNodes = async () => {
            if (!cacheEnabled) return [];
            const cached = await readSubscriptionNodeCache(storage, sub);
            return cached?.nodes || [];
        };
        const readCacheEntry = async () => {
            if (!cacheEnabled) return null;
            return readSubscriptionNodeCache(storage, sub);
        };
        // 旧缓存没有指纹时视为"配置未变化"，保持原有的截断保护行为
        const hasFilterConfigChanged = (cached) =>
            Boolean(cached) &&
            typeof cached.filterFingerprint === 'string' &&
            cached.filterFingerprint !== buildSubscriptionFilterFingerprint(sub);

        try {
            const customUserAgent =
                typeof sub.customUserAgent === 'string' ? sub.customUserAgent.trim() : '';
            const processedUserAgent = customUserAgent || getProcessedUserAgent(userAgent, sub.url);
            const requestHeaders = { 'User-Agent': processedUserAgent };

            // [Fetch Proxy] 获取单点订阅专属拉取代理前缀
            assertPublicNetworkUrl(sub.url);
            let requestUrl = sub.url;

            // 只有开启保护性缓存节点时才加时间戳绕过强缓存 (如 Cloudflare Edge Cache)
            if (cacheEnabled) {
                try {
                    const parsedUrl = new URL(requestUrl);
                    parsedUrl.searchParams.set('_t', Date.now().toString());
                    requestUrl = parsedUrl.toString();
                } catch (e) {
                    requestUrl += (requestUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
                }
            }

            if (sub.fetchProxy && typeof sub.fetchProxy === 'string' && sub.fetchProxy.trim()) {
                requestUrl = buildFetchProxyUrl(sub.fetchProxy, sub.url, processedUserAgent);
            }
            requestUrl = assertPublicNetworkUrl(requestUrl).toString();

            const response = await fetchWithRetry(requestUrl, {
                headers: requestHeaders,
                redirect: 'follow',
                ...(skipCertVerify
                    ? {
                          cf: {
                              insecureSkipVerify: true,
                              allowUntrusted: true,
                              validateCertificate: false,
                          },
                      }
                    : {}),
            });

            if (!response.ok) {
                recordEmptyRuntimeInfo();
                return (await readCachedNodes()).join('\n');
            }
            const buffer = await response.arrayBuffer();
            let text = new TextDecoder('utf-8').decode(buffer);

            text = await decodeBase64Content(text);

            // 使用统一的 node-parser 解析，确保与预览一致的过滤规则 (UUID校验, Hysteria1过滤, SS加密校验等)
            const parsedObjects = parseNodeList(text);

            let fallbackParsedObjects = parsedObjects;
            if (parsedObjects.length === 0) {
                const fallbackText = await decodeBase64Content(encodeArrayBufferToBase64(buffer));
                const fallbackNodes = parseNodeList(fallbackText);
                if (fallbackNodes.length > 0) {
                    fallbackParsedObjects = fallbackNodes;
                }
            }

            let validNodes = fallbackParsedObjects.map((node) => node.url);

            // [截断检测基线] 骤降保护必须基于"过滤前"的上游真实节点数：
            // 用户配置的 include/exclude 过滤与算子链造成的缩减是预期行为，
            // 若基于过滤后的数量比较，开启仅包含过滤会导致输出被整体清空。
            const upstreamRealNodeCount = validNodes.filter(isRealProxyNode).length;

            // --- 统一转换治理 (算子 + 过滤 + 组级诊断) ---
            validNodes = await applySubscriptionTransforms(validNodes, sub);

            const realNodes = validNodes.filter(isRealProxyNode);
            const knownNodeCount = Math.max(
                Number(sub?.lastGoodNodeCount) || 0,
                Number(sub?.nodeCount) || 0
            );
            if (
                Number.isFinite(knownNodeCount) &&
                isSuspiciousNodeCountDrop(knownNodeCount, upstreamRealNodeCount)
            ) {
                const cachedNodes = await readCachedNodes();
                console.warn(
                    `[Subscription] Rejecting suspicious node-count drop for ${sub.id || sub.url} (${knownNodeCount} known -> ${upstreamRealNodeCount} fetched)`
                );
                if (cachedNodes.length > 0) return cachedNodes.join('\n');
                // Do not write nodeCount=0 here: this response is suspicious,
                // not evidence that the subscription has no usable nodes.
                return '';
            }
            if (cacheEnabled && realNodes.length === 0) {
                // 过滤条件变化后命中 0 节点是配置的预期结果，不能回退旧配置的缓存节点
                const cached = await readCacheEntry();
                if (!hasFilterConfigChanged(cached)) return (cached?.nodes || []).join('\n');
            } else if (cacheEnabled) {
                const cached = await readCacheEntry();
                if (
                    !hasFilterConfigChanged(cached) &&
                    isSuspiciousNodeCountDrop(cached?.nodes?.length || 0, realNodes.length)
                ) {
                    console.warn(
                        `[SubscriptionCache] Refusing suspicious node-count drop for ${sub.id || sub.url} (${cached.nodes.length} -> ${realNodes.length})`
                    );
                    return cached.nodes.join('\n');
                }
            }
            if (!cacheEnabled && realNodes.length === 0) {
                recordEmptyRuntimeInfo();
            }

            if (cacheEnabled) {
                await writeSubscriptionNodeCache(storage, sub, realNodes);
            }

            if (realNodes.length > 0) {
                upstreamSuccessCount++;
                const userInfo = parseSubscriptionUserInfoHeader(
                    response.headers.get('subscription-userinfo')
                );
                // 机场识别：仅使用响应头自报名称（零额外请求）。
                // 官网标题兜底改为「按需触发」——见 /api/detect_airport_name，
                // 避免每次刷新订阅都多发一次外部请求（拖慢整体、增加失败面）。
                const detectedName = parseSubscriptionProfileTitle(response.headers);
                const runtimeInfo = {
                    nodeCount: realNodes.length,
                    userInfo,
                    ...(detectedName ? { detectedName } : {}),
                    ...(realNodes.length >= 10 ? { lastGoodNodeCount: realNodes.length } : {}),
                };
                recordCurrentRequestRuntimeInfo(context, sub, runtimeInfo);
                scheduleSubscriptionRuntimeInfoUpdate(context, storage, sub, runtimeInfo);
            }

            // 判断是否启用订阅前缀（智能重命名启用时跳过）
            const shouldPrependSubscriptions = profilePrefixSettings?.enableSubscriptions ?? true;
            const shouldAddSubPrefix = shouldPrependSubscriptions && !skipPrefixDueToRenaming;

            return shouldAddSubPrefix && sub.name
                ? validNodes.map((node) => prependNodeName(node, sub.name)).join('\n')
                : validNodes.join('\n');
        } catch (e) {
            recordEmptyRuntimeInfo();
            return (await readCachedNodes()).join('\n');
        }
    };

    // 使用并发控制器限制同时请求数量，避免网络拥塞
    const subPromises = httpSubs.map((sub) => limiter(() => fetchSingleSubscription(sub)));
    const processedSubContents = await Promise.all(subPromises);

    // --- 阶段 1: 原始数据汇聚 (Raw Data Aggregation) ---
    const rawCombinedLines = (processedManualNodeList + '\n' + processedSubContents.join('\n'))
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    // 去重，保留原始顺序中的第一次出现
    let currentLines = [...new Set(rawCombinedLines)];

    if (!shouldKeepEmoji) {
        currentLines = currentLines.map((line) => removeFlagEmoji(line));
    }

    // --- 阶段 2: 核心转换引擎 (Logic Transformation Engine) ---
    // 优先级: 订阅组 Operator Chain > 全局默认 Operator Chain > 旧版 Node Pipeline (桥接模式)

    let activeOperators = [];

    // 获取工作流配置（支持字符串自动解析）
    if (profilePrefixSettings?.operators) {
        activeOperators = ensureArray(profilePrefixSettings.operators);
    }

    if (!activeOperators.length && config.defaultOperators) {
        activeOperators = ensureArray(config.defaultOperators);
    }

    if (!activeOperators.length) {
        const legacyConfig = nodeTransformConfig?.enabled
            ? nodeTransformConfig
            : config.defaultNodeTransform;
        activeOperators = adaptLegacyTransform(legacyConfig);
    }

    // 2.1 执行 Workflow 链式处理 (算子操作)
    if (activeOperators.length > 0) {
        currentLines = await runOperatorChain(currentLines, activeOperators, {
            subName: profilePrefixSettings?.name,
            userAgent,
            config,
        });
    }

    // 2.2 [安全保险] 再次应用订阅组级别的全局过滤逻辑 (Profile-level)
    if (profilePrefixSettings && (profilePrefixSettings.exclude || profilePrefixSettings.include)) {
        currentLines = applyFilterRules(currentLines, profilePrefixSettings);
    }

    // 2.3 [兜底] 应用 Worker 级别的全局过滤逻辑 (Global-level)
    if (config && (config.exclude || config.include)) {
        currentLines = applyFilterRules(currentLines, config);
    }

    // --- 阶段 3: 后置格式化与增强 (Post-Formatting & Enhancement) ---

    // 3.1 YAML 兼容性净化
    currentLines = currentLines.map((line) => sanitizeNodeForYaml(line));

    // 3.2 最终智能化补齐 (Flag Emoji)
    const finalLines = shouldKeepEmoji
        ? currentLines.map((line) => addFlagEmoji(line))
        : currentLines;

    // --- 阶段 4: 结果拼装与返回 ---
    const finalNodeList = finalLines.join('\n');
    let result =
        finalNodeList.length > 0
            ? finalNodeList.endsWith('\n')
                ? finalNodeList
                : finalNodeList + '\n'
            : '';

    // 将虚假节点（如果存在）插入到列表最前面
    if (prependedContent) {
        result = `${prependedContent}\n${result}`;
    }

    // --- 日志记录 ---
    try {
        const endTime = Date.now();
        const totalNodes = finalLines.length;
        const successCount = processedSubContents.filter((c) => c.length > 0).length;
        const failCount = httpSubs.length - successCount;

        // [Stats Export] Populate generation stats to context for use by handler (deferred logging)
        if (context) {
            context.generationStats = {
                totalNodes,
                sourceCount: httpSubs.length,
                successCount,
                failCount,
                upstreamSuccessCount,
                duration: endTime - (context.startTime || Date.now()),
            };
        }

        const isInternalRequest =
            userAgent.includes('MiSub-Backend') || userAgent.includes('TelegramBot');
        if (!debug && config.enableAccessLog && !isInternalRequest) {
            // 避免递归调试日志，并遵循全局日志设置
            const { LogService } = await import('./log-service.ts');

            // 提取客户信息
            let clientIp = 'Unknown';
            let geoInfo = {};
            if (context && context.logMetadata) {
                // Use metadata passed from handler if available
                clientIp = context.logMetadata.clientIp || clientIp;
                geoInfo = context.logMetadata.geoInfo || geoInfo;
            } else if (context && context.request) {
                const cf = context.request.cf;
                clientIp =
                    context.request.headers.get('CF-Connecting-IP') ||
                    context.request.headers.get('X-Real-IP') ||
                    context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                    'Unknown';
                if (cf) {
                    geoInfo = {
                        country: cf.country,
                        city: cf.city,
                        isp: cf.asOrganization,
                        asn: cf.asn,
                    };
                }
            }

            await LogService.addLog(context.env, {
                profileName: profilePrefixSettings?.name || 'Unknown Profile',
                clientIp,
                geoInfo,
                userAgent: userAgent || 'Unknown',
                status: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'error',
                // Include metadata from handler (format, token, type, etc.)
                ...(context && context.logMetadata
                    ? {
                          format: context.logMetadata.format,
                          token: context.logMetadata.token,
                          type: context.logMetadata.type,
                          domain: context.logMetadata.domain,
                      }
                    : {}),
                details: {
                    totalNodes,
                    sourceCount: httpSubs.length,
                    successCount,
                    failCount,
                    duration: endTime - (context.startTime || Date.now()), // 需要在上层记录 startTime
                },
                summary: `生成 ${totalNodes} 个节点 (成功: ${successCount}, 失败: ${failCount})`,
            });
        }
    } catch (e) {
        console.error('Failed to save access log:', e);
    }

    return result;
}
