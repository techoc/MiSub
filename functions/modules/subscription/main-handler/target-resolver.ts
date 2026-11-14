/**
 * 访问目标解析：按 profile / token 两条路径确定本次请求要聚合的订阅集合、
 * 名称、到期状态与转换引擎开关；token 校验失败时返回伪装页/404。
 * 从 main-handler.js 的 handleMisubRequest 拆分而来。
 */

import { createDisguiseResponse } from '../../disguise-page.ts';
import { resolveBuiltinEngineFlags, resolveEffectiveEngine } from './engine-flags.ts';
import { handleProfileMode } from '../profile-handler.ts';
import { getProfileDownloadCountKey } from './request-helpers.ts';
import { setOutputCacheHints } from './output-cache.ts';

// Use a valid, non-routable Shadowsocks URL so clients can display the
// expiration notice as a node instead of dropping a comment line.
export const DEFAULT_EXPIRED_NODE = `trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#${encodeURIComponent('您的订阅已到期')}`;

/**
 * @returns {Promise<{response?: Response, targetMisubs: any[], subName: string,
 *   isProfileExpired: boolean, currentProfile: any|null,
 *   engineFlags: {isExternalMode: boolean, useBuiltin: boolean,
 *     shouldSkipCertificateVerify: boolean, shouldEnableUdp: boolean}}>}
 */
export async function resolveSubscriptionTargets({
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
}) {
    let targetMisubs;
    let subName = config.FileName;
    let isProfileExpired = false; // Moved declaration here

    let currentProfile = null;
    let isExternalMode = false;
    let useBuiltin = true;
    let shouldSkipCertificateVerify = false;
    let shouldEnableUdp = true;

    const initEngineFlags = (targetProf) => {
        const profileSub = targetProf?.subconverter || {};
        const globalSub = config.subconverter || {};
        const effectiveEngine = resolveEffectiveEngine({
            searchParams: url.searchParams,
            userAgent: userAgentHeader,
            profileEngineMode: profileSub.engineMode,
            globalEngineMode: globalSub.engineMode,
        });
        isExternalMode = effectiveEngine === 'external';
        useBuiltin = !isExternalMode;
        const flags = resolveBuiltinEngineFlags(config, isExternalMode);
        shouldSkipCertificateVerify = flags.shouldSkipCertificateVerify;
        shouldEnableUdp = flags.shouldEnableUdp;
    };

    if (profileIdentifier) {
        // [修正] 使用 config 變量
        if (!token || token !== config.profileToken) {
            // [伪装加固] 不使用裸 403/403 文本响应：403 会暴露「该地址存在一个受保护的服务」，
            // 与首页的伪装行为形成差异，可被扫描器识别。改为返回伪装页（或 404），
            // 与未授权的 SPA 路由行为保持一致。
            return {
                response:
                    createDisguiseResponse(settings?.disguise, request.url) ||
                    new Response('Not Found', { status: 404 }),
            };
        }
        currentProfile = allProfiles.find(
            (p) => (p.customId && p.customId === profileIdentifier) || p.id === profileIdentifier
        );
        initEngineFlags(currentProfile);
        const profile = currentProfile;
        if (profile && profile.enabled) {
            // Check if the profile has an expiration date and if it's expired
            if (profile.expiresAt) {
                const expiryDate = new Date(profile.expiresAt);
                const now = new Date();
                if (now > expiryDate) {
                    isProfileExpired = true;
                }
            }

            if (isProfileExpired) {
                subName = profile.name; // Still use profile name for filename
                targetMisubs = [
                    {
                        id: 'expired-node',
                        url: DEFAULT_EXPIRED_NODE,
                        name: '您的订阅已到期',
                        isExpiredNode: true,
                    },
                ]; // Set expired node as the only targetMisub
            } else {
                subName = profile.name;
                targetMisubs = [];
                const relatedIds = [
                    ...(Array.isArray(profile.subscriptions)
                        ? profile.subscriptions.map((item) =>
                              typeof item === 'object' ? item.id : item
                          )
                        : []),
                    ...(Array.isArray(profile.manualNodes) ? profile.manualNodes : []),
                ].filter(Boolean);
                const relatedSubs =
                    typeof storageAdapter.getSubscriptionsByIds === 'function'
                        ? await storageAdapter.getSubscriptionsByIds(
                              Array.from(new Set(relatedIds))
                          )
                        : allMisubs;
                const misubMap = new Map(relatedSubs.map((item) => [item.id, item]));

                // 1. Add subscriptions in order defined by profile
                const profileSubIds = profile.subscriptions || [];
                if (Array.isArray(profileSubIds)) {
                    profileSubIds.forEach((item) => {
                        // 支持两种格式：纯字符串 ID 或 带有覆盖配置的对象 { id, exclude, operators, ... }
                        const isObject = item && typeof item === 'object';
                        const id = isObject ? item.id : item;

                        const baseSub = misubMap.get(id);
                        if (
                            baseSub &&
                            baseSub.enabled &&
                            typeof baseSub.url === 'string' &&
                            baseSub.url.startsWith('http')
                        ) {
                            // 如果是对象，则合并覆盖配置（Profile 级别的设置优先级更高）
                            const sub = isObject ? { ...baseSub, ...item } : baseSub;
                            targetMisubs.push(sub);
                        }
                    });
                }

                // 2. Add manual nodes in order defined by profile
                const profileNodeIds = profile.manualNodes || [];
                if (Array.isArray(profileNodeIds)) {
                    profileNodeIds.forEach((id) => {
                        const node = misubMap.get(id);
                        if (
                            node &&
                            node.enabled &&
                            typeof node.url === 'string' &&
                            !node.url.startsWith('http')
                        ) {
                            targetMisubs.push(node);
                        }
                    });
                }

                // 3. Add sub-profiles in order defined by profile (嵌套组合订阅)
                const profileSubProfileIds = profile.subProfiles || [];
                if (Array.isArray(profileSubProfileIds) && profileSubProfileIds.length > 0) {
                    for (const subProfileId of profileSubProfileIds) {
                        if (
                            !subProfileId ||
                            subProfileId === profile.id ||
                            subProfileId === profile.customId
                        ) {
                            continue;
                        }
                        try {
                            const subResult = await handleProfileMode(
                                request,
                                env,
                                subProfileId,
                                userAgentHeader,
                                true,
                                shouldSkipCertificateVerify,
                                1,
                                new Set([profile.id, profile.customId].filter(Boolean))
                            );
                            if (subResult.success && Array.isArray(subResult.nodes)) {
                                subResult.nodes.forEach((node) => {
                                    targetMisubs.push({
                                        id: `nested-${subProfileId}-${node.url}`,
                                        name: node.name,
                                        url: node.url,
                                        group: subResult.profileName || '组合订阅',
                                        isFromSubProfile: true,
                                        enabled: true,
                                    });
                                });
                            }
                        } catch (err) {
                            console.error(
                                `[MainHandler] Failed to resolve sub-profile ${subProfileId}:`,
                                err
                            );
                        }
                    }
                }
            }
            // [新增] 增加订阅组下载计数
            // 仅在非回调请求时及非内部请求时增加计数(避免重复计数)
            // 且仅当开启访问日志时才计数
            //
            // [性能] 读取+自增整体放进 waitUntil：此前这里的 KV get 是在
            // 主响应路径上 await 的，每次订阅拉取都被计数读阻塞一次往返。
            // read-modify-write 仍有并发丢计数窗口（KV 无原子自增），计数
            // 场景可接受；不再阻塞订阅下发。
            if (
                !url.searchParams.has('callback_token') &&
                !shouldSkipLogging &&
                config.enableAccessLog
            ) {
                try {
                    const downloadCountKey = getProfileDownloadCountKey(profile);
                    setOutputCacheHints(context, { downloadCountKey });
                    context.waitUntil(
                        (async () => {
                            const currentCount =
                                Number(await storageAdapter.get(downloadCountKey)) || 0;
                            await storageAdapter.put(downloadCountKey, currentCount + 1);
                        })().catch((err) =>
                            console.error('[Download Count] Failed to update:', err)
                        )
                    );
                } catch (err) {
                    // 计数失败不影响订阅服务
                    console.error('[Download Count] Error:', err);
                }
            }
        } else {
            return {
                response: new Response('Profile not found or disabled', { status: 404 }),
            };
        }
    } else {
        // [修正] 使用 config 變量
        if (!token || token !== config.mytoken) {
            // [伪装加固] 同 profile token：避免裸 403 暴露服务存在
            return {
                response:
                    createDisguiseResponse(settings?.disguise, request.url) ||
                    new Response('Not Found', { status: 404 }),
            };
        }
        targetMisubs = allMisubs.filter((s) => s.enabled);
        initEngineFlags(null);
    }

    return {
        targetMisubs,
        subName,
        isProfileExpired,
        currentProfile,
        engineFlags: {
            isExternalMode,
            useBuiltin,
            shouldSkipCertificateVerify,
            shouldEnableUdp,
        },
    };
}
