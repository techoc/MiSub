/**
 * MiSub 订阅请求编排器
 *
 * handleMisubRequest 的各阶段拆分在 ./main-handler/ 子模块：
 *   request-helpers（基础工具）、user-info（流量/到期合并）、
 *   template-url（模板与外部后端地址）、engine-flags（引擎选择）、
 *   target-resolver（目标解析）、virtual-info（虚拟信息节点）、
 *   node-refresh（节点刷新与缓存写入）。
 * 本文件保留历史导出面（部分 helper 被测试直接从本路径引用）；
 * 新增逻辑请放进对应子模块，编排器只负责串接阶段与输出分支。
 */

import { StorageFactory } from '../../storage-adapter.js';
import { migrateConfigSettings, migrateProfileIds, base64EncodeUtf8 } from '../utils.js';
import { sendEnhancedTgNotification, tgEscape } from '../notifications.js';
import {
    KV_KEY_PROFILES,
    KV_KEY_SETTINGS,
    DEFAULT_SETTINGS as defaultSettings,
} from '../config.js';
import { createDisguiseResponse } from '../disguise-page.js';
import { generateCacheKey } from '../../services/node-cache-service.js';
import { resolveRequestContext } from './request-context.js';
import { resolveNodeListWithCache } from './cache-manager.js';
import { ProcessorService } from '../../services/processor-service.js';
import { logAccessSuccess, shouldSkipLogging as shouldSkipAccessLog } from './access-logger.js';
import { isBrowserAgent, determineTargetFormat, isMetaCore } from './user-agent-utils.js';
import { authMiddleware } from '../auth-middleware.js';

// —— 阶段子模块 ——
import {
    buildManagedConfigUrl,
    extractProxySectionFromBuiltin,
    maskSensitiveLogValue,
} from './main-handler/request-helpers.js';
import {
    buildUserInfoHeaderFromSubscriptions,
    countSubscriptionNodes,
    formatNotificationExpireStatus,
    formatNotificationExpireTime,
    mergeSubscriptionUserInfo,
} from './main-handler/user-info.js';
import {
    buildExternalSubconverterUrl,
    resolveTemplateSource,
    resolveTemplateUrl,
} from './main-handler/template-url.js';
import {
    resolveBuiltinRequestOptions,
    resolveInjectionToggle,
    shouldRenderClashYamlProfileTemplateLocally,
} from './main-handler/engine-flags.js';
import {
    DEFAULT_EXPIRED_NODE,
    resolveSubscriptionTargets,
} from './main-handler/target-resolver.js';
import { buildPrependedVirtualNodes } from './main-handler/virtual-info.js';
import { refreshSubscriptionNodes } from './main-handler/node-refresh.js';

// —— 兼容导出：测试与外部模块历史上直接从本路径引用这些 helper ——
export {
    buildManagedConfigUrl,
    extractProxySectionFromBuiltin,
} from './main-handler/request-helpers.js';
export {
    formatNotificationExpireTime,
    formatNotificationExpireStatus,
} from './main-handler/user-info.js';
export {
    buildExternalSubconverterUrl,
    normalizeExternalTemplateConfigUrl,
    normalizeSubconverterBackend,
    resolveExternalTemplateConfigUrl,
    resolveTemplateSource,
    resolveTemplateUrl,
} from './main-handler/template-url.js';
export {
    resolveBuiltinEngineFlags,
    resolveBuiltinRequestOptions,
    resolveEffectiveEngine,
    resolveInjectionToggle,
    shouldRenderClashYamlProfileTemplateLocally,
} from './main-handler/engine-flags.js';

/**
 * 处理MiSub订阅请求
 * @param {Object} context - Cloudflare上下文
 * @returns {Promise<Response>} HTTP响应
 */ export async function handleMisubRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userAgentHeader = request.headers.get('User-Agent') || 'Unknown';

    console.log(
        `\n[MiSub Request] ${request.method} ${maskSensitiveLogValue(url.pathname)}${url.search ? ' ?…' : ''}`
    );
    console.log(`[MiSub UA] ${userAgentHeader}`);

    const storageAdapter = StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );
    context.storage = storageAdapter;
    const [settingsData, allMisubs, allProfiles] = await Promise.all([
        storageAdapter.get(KV_KEY_SETTINGS),
        storageAdapter.getAllSubscriptions(),
        storageAdapter.getAllProfiles(),
    ]);
    const settings = settingsData || {};

    // 自动迁移旧版 profile ID（去除 'profile_' 前缀）
    if (migrateProfileIds(allProfiles)) {
        storageAdapter
            .put(KV_KEY_PROFILES, allProfiles)
            .catch((err) =>
                console.error('[Migration] Failed to persist migrated profile IDs:', err)
            );
    }
    // 关键：我们在这里定义了 `config`，后续都应该使用它
    const config = migrateConfigSettings({ ...defaultSettings, ...settings });
    context.config = config;
    context.accessLogPersistenceMode = config.accessLogPersistenceMode || 'light';

    // [Subconverter API] 提取 URL 控制参数，用于覆盖默认设置
    const urlInclude = url.searchParams.get('include');
    const urlExclude = url.searchParams.get('exclude');
    const urlRename = url.searchParams.get('rename');
    const urlEmoji = url.searchParams.get('emoji'); // true/false
    const urlUdp = url.searchParams.get('udp'); // true/false
    const urlTfo = url.searchParams.get('tfo'); // true/false
    const urlScv = url.searchParams.get('scv'); // true/false (skip-cert-verify)
    const urlList = url.searchParams.get('list') === 'true';

    const isBrowser = isBrowserAgent(userAgentHeader);

    console.log(`[MiSub Logic] isBrowser: ${isBrowser}, Disguise: ${config.disguise?.enabled}`);

    const isAuthenticated = await authMiddleware(request, env);

    if (
        config.disguise?.enabled &&
        isBrowser &&
        !url.searchParams.has('callback_token') &&
        !isAuthenticated
    ) {
        // [Smart Camouflage]
        // If disguise is enabled and it's a browser request (not a known client),
        // show the disguise page unless the user is authenticated.
        return createDisguiseResponse(config.disguise, request.url);
    }

    context.url = url; // [核心修复] 将 url 挂载到 context，确保后续服务能获取到 debug 参数
    const { token, profileIdentifier } = resolveRequestContext(url, config, allProfiles);

    console.log(
        `[MiSub Parse] Token: ${maskSensitiveLogValue(token)}, Profile: ${maskSensitiveLogValue(profileIdentifier)}`
    );
    const shouldSkipLogging = shouldSkipAccessLog(userAgentHeader);

    const targetState = await resolveSubscriptionTargets({
        context,
        request,
        url,
        env,
        config,
        settings,
        allProfiles,
        allMisubs,
        token,
        profileIdentifier,
        userAgentHeader,
        shouldSkipLogging,
        storageAdapter,
    });
    if (targetState.response) return targetState.response;
    const { targetMisubs, subName, isProfileExpired, currentProfile } = targetState;
    const { isExternalMode, useBuiltin, shouldSkipCertificateVerify, shouldEnableUdp } =
        targetState.engineFlags;

    // 使用统一的确定目标格式的方法（此方法中包含了处理各类客户端如 Surge 等对应版本的最新支持规则）
    let targetFormat = determineTargetFormat(userAgentHeader, url.searchParams);

    // [Access Log] Record access log and stats if enabled
    if (!url.searchParams.has('callback_token') && !shouldSkipLogging && config.enableAccessLog) {
        // [Log Deduplication]
        // Removed the premature LogService.addLog here.
        // We will pass the log metadata to generateCombinedNodeList (or log manually for cache hits)
        // to ensure we have the correct stats and avoid duplicates.
    }

    const prependedContentForSubconverter = buildPrependedVirtualNodes({
        context,
        config,
        targetMisubs,
        currentProfile,
        isProfileExpired,
    });

    const profileSub = currentProfile?.subconverter || {};
    const globalSub = config.subconverter || {};

    const globalTemplateUrl = resolveTemplateUrl(
        config.transformConfigMode,
        config.transformConfig,
        ''
    );
    const templateUrl = currentProfile
        ? resolveTemplateUrl(
              currentProfile.transformConfigMode,
              currentProfile.transformConfig,
              globalTemplateUrl
          )
        : globalTemplateUrl;
    const templateSource = resolveTemplateSource(templateUrl);

    // [逻辑统一] 规则等级：URL 参数 > 订阅组设置 > 全局设置 > 默认值 (std)
    // [重要变更] 如果使用了远程自定义配置 (templateSource.kind === 'remote')，则完全禁用内置等级 (强制为 none)
    const resolvedProfileLevel = currentProfile?.ruleLevel || currentProfile?.clashRuleLevel || '';
    const resolvedGlobalLevel = config.ruleLevel || config.clashRuleLevel || 'std';

    let ruleLevel;
    if (templateSource.kind === 'remote' || templateSource.kind === 'custom') {
        ruleLevel = 'none';
    } else {
        ruleLevel =
            url.searchParams.get('level') ||
            url.searchParams.get('ruleLevel') ||
            resolvedProfileLevel ||
            resolvedGlobalLevel;
    }

    // === 缓存机制：快速响应客户端请求 ===
    const cacheKey = generateCacheKey(
        profileIdentifier ? 'profile' : 'token',
        profileIdentifier || token
    );

    // 检查是否强制刷新（通过 URL 参数）
    const forceRefresh =
        url.searchParams.has('refresh') ||
        url.searchParams.has('nocache') ||
        url.searchParams.has('debug');

    // 定义刷新函数（用于后台刷新；cache-manager 可能传入 isBackground=true，
    // 刷新实现不依赖该标记，包装层直接忽略，与原闭包行为一致）
    const refreshNodes = async () =>
        refreshSubscriptionNodes({
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
        });

    const expectedRemoteNodeCount =
        targetMisubs.reduce((total, sub) => {
            if (!sub?.enabled || typeof sub?.url !== 'string' || !sub.url.startsWith('http'))
                return total;
            const knownCount = Math.max(
                Number(sub.lastGoodNodeCount) || 0,
                Number(sub.nodeCount) || 0
            );
            return total + (Number.isFinite(knownCount) && knownCount > 0 ? knownCount : 0);
        }, 0) +
        targetMisubs.filter(
            (sub) => sub?.enabled && typeof sub?.url === 'string' && !sub.url.startsWith('http')
        ).length;

    const { combinedNodeList, cacheHeaders } = await resolveNodeListWithCache({
        storageAdapter,
        cacheKey,
        forceRefresh,
        refreshNodes,
        context,
        targetMisubsCount: targetMisubs.length,
        expectedNodeCount: expectedRemoteNodeCount,
    });

    console.log(`[MiSub Nodes] Count/Length: ${combinedNodeList ? combinedNodeList.length : 0}`);

    const domain = url.hostname;
    const mergedExpireTimestamp = mergeSubscriptionUserInfo(context, targetMisubs).expire;
    const expireTime = formatNotificationExpireTime(
        currentProfile?.expiresAt,
        mergedExpireTimestamp
    );
    const expireStatus = formatNotificationExpireStatus(
        currentProfile?.expiresAt,
        mergedExpireTimestamp,
        Date.now(),
        config.NotifyThresholdDays
    );
    const profileExpireText = `<b>状态:</b> <code>${tgEscape(expireStatus)}</code>\n<b>到期时间:</b> <code>${tgEscape(expireTime)}</code>`;
    const nodeCount = isProfileExpired
        ? 0
        : countSubscriptionNodes(combinedNodeList, prependedContentForSubconverter);
    const nodeCountText = `<b>节点数:</b> <code>${nodeCount}</code>`;

    // [Support] External Subconverter Logic
    // 1. If 'nodes' format requested, return plain text nodes (DataSource for external converters)
    if (targetFormat === 'nodes') {
        const contentToReturn = isProfileExpired ? DEFAULT_EXPIRED_NODE + '\n' : combinedNodeList;
        const userInfoHeader = buildUserInfoHeaderFromSubscriptions(
            context,
            targetMisubs,
            currentProfile?.expiresAt
        );
        const nodeHeaders = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache',
            'X-MiSub-Mode': 'node-export-plain',
        };
        if (userInfoHeader) {
            nodeHeaders['Subscription-Userinfo'] = userInfoHeader;
            nodeHeaders['Profile-Update-Interval'] = String(config.UpdateInterval || 24);
        }
        // [兼容性优化] 第三方转换后端对明文列表的支持通常比 Base64 更好。
        // 同时对于 Cloudflare 而言，明文输出更有利于其边缘节点的流式处理。
        return new Response(contentToReturn, {
            headers: nodeHeaders,
        });
    }

    // 2. If external mode active, build the redirect URL and return 302
    if (isExternalMode && targetFormat !== 'base64') {
        if (
            shouldRenderClashYamlProfileTemplateLocally({
                isExternalMode,
                targetFormat,
                templateSource,
            })
        ) {
            try {
                const userInfoHeader = buildUserInfoHeaderFromSubscriptions(
                    context,
                    targetMisubs,
                    currentProfile?.expiresAt
                );
                const builtinOptions = {
                    ...resolveBuiltinRequestOptions({
                        searchParams: url.searchParams,
                        userAgent: userAgentHeader,
                        generatorOptions: config.generatorOptions,
                    }),
                    fileName: subName,
                    managedConfigUrl: buildManagedConfigUrl(request.url),
                    interval: config.UpdateInterval || 86400,
                    skipCertVerify: shouldSkipCertificateVerify,
                    enableUdp: shouldEnableUdp,
                    enableTfo:
                        urlTfo !== null
                            ? urlTfo === 'true' || urlTfo === '1'
                            : Boolean(config.builtinEnableTfo),
                    ruleLevel,
                    regionOverrides: Array.isArray(config.regionOverrides)
                        ? config.regionOverrides
                        : [],
                    isMeta: isMetaCore(userAgentHeader, url.searchParams),
                    customDnsOverride: config.customDnsOverride || '',
                    dnsMode:
                        url.searchParams.get('dns-mode') ||
                        url.searchParams.get('dnsMode') ||
                        config.dnsMode ||
                        'clean',
                    injectAiPolicy: resolveInjectionToggle(
                        url.searchParams,
                        ['ai-inject', 'aiInject'],
                        config.injectAiPolicy
                    ),
                    injectDnsExitGroup: resolveInjectionToggle(
                        url.searchParams,
                        ['dns-inject', 'dnsInject'],
                        config.injectDnsExitGroup
                    ),
                };
                const rendered = await ProcessorService.renderOutput({
                    targetFormat,
                    combinedNodeList: isProfileExpired
                        ? DEFAULT_EXPIRED_NODE + '\n'
                        : combinedNodeList,
                    subName,
                    config,
                    builtinOptions,
                    templateSource,
                    managedConfigUrl: builtinOptions.managedConfigUrl,
                    storageAdapter,
                    userInfoHeader,
                });

                if (rendered.headers?.['X-MiSub-Template-Mode'] === 'clash-yaml-profile') {
                    const responseHeaders = new Headers({
                        'Content-Type': rendered.contentType || 'application/x-yaml; charset=utf-8',
                        'Cache-Control': 'no-store, no-cache',
                        'X-MiSub-Mode': 'local-clash-yaml-profile-template',
                    });
                    if (userInfoHeader) {
                        responseHeaders.set('Subscription-Userinfo', userInfoHeader);
                        responseHeaders.set(
                            'Profile-Update-Interval',
                            String(config.UpdateInterval || 24)
                        );
                    }
                    Object.entries(rendered.headers || {}).forEach(([key, value]) =>
                        responseHeaders.set(key, value)
                    );
                    return new Response(rendered.content, { headers: responseHeaders });
                }
            } catch (err) {
                console.warn(
                    '[ExternalTemplate] Local Clash YAML profile render failed, falling back to external redirect:',
                    err?.message || err
                );
            }
        }

        const backend =
            url.searchParams.get('backend') || profileSub.backend || globalSub.defaultBackend;
        const externalNodeList = isProfileExpired ? DEFAULT_EXPIRED_NODE + '\n' : combinedNodeList;
        const externalUrl = buildExternalSubconverterUrl({
            backend,
            targetFormat,
            nodeList: externalNodeList,
            requestUrl: request.url,
            profileSub,
            globalSub,
            userAgent: userAgentHeader,
            searchParams: url.searchParams,
            templateSource,
            subName,
        });

        // [Access Log] Send notification for external redirection
        if (
            !url.searchParams.has('callback_token') &&
            !shouldSkipLogging &&
            config.enableAccessLog
        ) {
            const clientIp =
                request.headers.get('CF-Connecting-IP') ||
                request.headers.get('X-Real-IP') ||
                request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ <b>订阅被访问</b> (第三方转换)',
                    clientIp,
                    `<b>域名:</b> <code>${tgEscape(domain)}</code>\n<b>请求格式:</b> <code>${tgEscape(targetFormat)}</code>\n<b>客户端:</b> <code>${tgEscape(userAgentHeader)}</code>\n<b>订阅组:</b> <code>${tgEscape(subName)}</code>\n${nodeCountText}\n${profileExpireText}`
                )
            );
        }

        // [重要修复] 使用手动构建出的 302 响应，以确保头部是可变的 (Mutable)
        return new Response(null, {
            status: 302,
            headers: {
                Location: externalUrl.toString(),
                'Cache-Control': 'no-store, no-cache',
                'X-MiSub-Mode': 'external-redirect-v2',
                ...(templateSource.kind === 'builtin'
                    ? { 'X-MiSub-Template-Warning': 'external-engine-ignores-builtin-template' }
                    : {}),
            },
        });
    }

    if (targetFormat === 'base64') {
        let contentToEncode;
        if (isProfileExpired) {
            contentToEncode = DEFAULT_EXPIRED_NODE + '\n';
        } else {
            contentToEncode = combinedNodeList;
        }
        const headers = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store, no-cache',
        };
        Object.entries(cacheHeaders).forEach(([key, value]) => {
            headers[key] = value;
        });

        // [Deferred Logging] Log Success for Base64 (Direct Return)
        if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
            // 发送 Telegram 通知（独立于访问日志开关，只需配置 BotToken 和 ChatID）
            const clientIp =
                request.headers.get('CF-Connecting-IP') ||
                request.headers.get('X-Real-IP') ||
                request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                'N/A';
            context.waitUntil(
                sendEnhancedTgNotification(
                    config,
                    '🛰️ <b>订阅被访问</b>',
                    clientIp,
                    `<b>域名:</b> <code>${tgEscape(domain)}</code>\n<b>请求格式:</b> <code>${tgEscape(targetFormat)}</code>\n<b>客户端:</b> <code>${tgEscape(userAgentHeader)}</code>\n<b>订阅组:</b> <code>${tgEscape(subName)}</code>\n${nodeCountText}\n${profileExpireText}`
                )
            );

            // 访问日志（需要 enableAccessLog 开关）
            if (config.enableAccessLog) {
                logAccessSuccess({
                    context,
                    env,
                    request,
                    userAgentHeader,
                    targetFormat,
                    token,
                    profileIdentifier,
                    subName,
                    domain,
                });
            }
        }

        return new Response(base64EncodeUtf8(contentToEncode), { headers });
    }

    // [Subconverter API] URL 参数优先级高于全局/Profile 设置
    const finalSkipCertVerify =
        urlScv !== null ? urlScv === 'true' || urlScv === '1' : shouldSkipCertificateVerify;
    const finalEnableUdp = urlUdp !== null ? urlUdp === 'true' || urlUdp === '1' : shouldEnableUdp;
    const finalEnableTfo =
        urlTfo !== null ? urlTfo === 'true' || urlTfo === '1' : Boolean(config.builtinEnableTfo);

    const builtinOptions = {
        ...resolveBuiltinRequestOptions({
            searchParams: url.searchParams,
            userAgent: userAgentHeader,
            generatorOptions: config.generatorOptions,
        }),
        fileName: subName,
        managedConfigUrl: '',
        interval: config.UpdateInterval || 86400,
        skipCertVerify: finalSkipCertVerify,
        enableUdp: finalEnableUdp,
        enableTfo: finalEnableTfo,
        ruleLevel: ruleLevel, // 统一后的规则等级
        regionOverrides: Array.isArray(config.regionOverrides) ? config.regionOverrides : [],
        isMeta: isMetaCore(userAgentHeader, url.searchParams),
        customDnsOverride: config.customDnsOverride || '',
        dnsMode:
            url.searchParams.get('dns-mode') ||
            url.searchParams.get('dnsMode') ||
            config.dnsMode ||
            'clean',
        injectAiPolicy: resolveInjectionToggle(
            url.searchParams,
            ['ai-inject', 'aiInject'],
            config.injectAiPolicy
        ),
        injectDnsExitGroup: resolveInjectionToggle(
            url.searchParams,
            ['dns-inject', 'dnsInject'],
            config.injectDnsExitGroup
        ),
    };

    const managedConfigUrl = buildManagedConfigUrl(request.url);

    const shouldUseBuiltin =
        useBuiltin &&
        (targetFormat === 'clash' ||
            targetFormat === 'egern' ||
            targetFormat.startsWith('surge') ||
            targetFormat === 'loon' ||
            targetFormat === 'quanx' ||
            targetFormat === 'singbox' ||
            targetFormat === 'sing-box');

    if (shouldUseBuiltin) {
        try {
            const userInfoHeader = buildUserInfoHeaderFromSubscriptions(
                context,
                targetMisubs,
                currentProfile?.expiresAt
            );

            let {
                content: finalContent,
                contentType,
                headers: resultHeaders,
            } = await ProcessorService.renderOutput({
                targetFormat,
                combinedNodeList,
                subName,
                config,
                builtinOptions,
                templateSource,
                managedConfigUrl,
                storageAdapter,
                userInfoHeader,
            });

            // [Subconverter API] 处理 list=true 逻辑：仅输出节点片段
            if (urlList) {
                const extracted = extractProxySectionFromBuiltin(finalContent, targetFormat);
                if (extracted) {
                    finalContent = extracted;
                    contentType = 'text/plain; charset=utf-8';
                }
            }

            const isJson = targetFormat === 'singbox' || targetFormat === 'sing-box';

            // [RFC 6266 / RFC 5987] Standardized Content-Disposition
            // filename: ASCII-only fallback, filename*: UTF-8 encoded
            const asciiSubName = subName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
            const encodedSubName = encodeURIComponent(subName)
                .replace(/'/g, '%27')
                .replace(/\(/g, '%28')
                .replace(/\)/g, '%29')
                .replace(/\*/g, '%2A');

            const responseHeaders = new Headers({
                'Content-Disposition': `attachment; filename="${asciiSubName}"; filename*=utf-8''${encodedSubName}`,
                'Content-Type': contentType || 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store, no-cache',
                'X-MiSub-Mode': `builtin-${targetFormat}`,
            });

            if (userInfoHeader) {
                responseHeaders.set('Subscription-Userinfo', userInfoHeader);
                responseHeaders.set('Profile-Update-Interval', String(config.UpdateInterval || 24));
            }

            Object.entries(resultHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
            Object.entries(cacheHeaders).forEach(([key, value]) => responseHeaders.set(key, value));

            if (!url.searchParams.has('callback_token') && !shouldSkipLogging) {
                const clientIp =
                    request.headers.get('CF-Connecting-IP') ||
                    request.headers.get('X-Real-IP') ||
                    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                    'N/A';
                context.waitUntil(
                    sendEnhancedTgNotification(
                        config,
                        '🛰️ <b>订阅被访问</b> (内置转换)',
                        clientIp,
                        `<b>域名:</b> <code>${tgEscape(domain)}</code>\n<b>请求格式:</b> <code>${tgEscape(targetFormat)}</code>\n<b>客户端:</b> <code>${tgEscape(userAgentHeader)}</code>\n<b>订阅组:</b> <code>${tgEscape(subName)}</code>\n${nodeCountText}\n${profileExpireText}`
                    )
                );

                if (config.enableAccessLog) {
                    logAccessSuccess({
                        context,
                        env,
                        request,
                        userAgentHeader,
                        targetFormat: `builtin-${targetFormat}`,
                        token,
                        profileIdentifier,
                        subName,
                        domain,
                    });
                }
            }

            return new Response(finalContent || '', { headers: responseHeaders });
        } catch (e) {
            console.error(`[Builtin${targetFormat}] Generation failed:`, e);
        }
    }

    const base64Headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
    };
    const userInfoHeader = buildUserInfoHeaderFromSubscriptions(
        context,
        targetMisubs,
        currentProfile?.expiresAt
    );
    if (userInfoHeader) {
        base64Headers['Subscription-Userinfo'] = userInfoHeader;
        base64Headers['Profile-Update-Interval'] = String(config.UpdateInterval || 24);
    }
    Object.entries(cacheHeaders).forEach(([key, value]) => {
        base64Headers[key] = value;
    });

    return new Response(base64EncodeUtf8(combinedNodeList), { headers: base64Headers });
}
