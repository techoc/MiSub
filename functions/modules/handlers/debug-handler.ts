/**
 * 调试处理器模块
 * 处理调试、订阅预览等开发相关API请求
 */

import { StorageFactory } from '../../storage-adapter.ts';
import {
    createJsonResponse,
    createErrorResponse,
    JSON_BODY_LIMITS,
    readJsonWithLimit,
} from '../utils.ts';
import { handleSubscriptionNodesRequest } from '../subscription-handler.ts';
import { debugTgNotification } from '../../services/notification-service.ts';
import {
    parseNodeList,
    calculateProtocolStats,
    calculateRegionStats,
} from '../utils/node-parser.ts';
import {
    redactSensitiveObject,
    redactUrl,
    safeFetchPublicUrl,
    validatePublicFetchUrl,
} from '../security-utils.ts';

/** 从错误对象提取 HTTP 状态码 */
function getErrorStatus(error: unknown, fallback: number): number {
    const status = (error as { status?: number } | undefined)?.status;
    return typeof status === 'number' ? status : fallback;
}

/** 调试导出数据结构 */
interface DebugExportData {
    exportInfo: { timestamp: string; version: string; storageType: string };
    data: Record<string, unknown>;
}

/**
 * 调试订阅信息和节点内容
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleDebugSubscriptionRequest(request: Request, env: Env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
        const {
            url: subscriptionUrl,
            subscriptionId,
            profileId,
            userAgent = 'MiSub-Debug/1.0',
        } = requestData;

        // 验证必需参数
        if (!subscriptionUrl && !subscriptionId && !profileId) {
            return createErrorResponse('请提供订阅URL、订阅ID或订阅组ID', 400);
        }

        // 使用订阅处理器获取节点信息
        const nodeRequest = new Request('https://debug.local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
        });

        const nodeResult = await handleSubscriptionNodesRequest(nodeRequest, env);

        if (!nodeResult.success) {
            return createJsonResponse(
                {
                    error: '获取订阅信息失败',
                    details: nodeResult.error,
                },
                400
            );
        }

        // 生成详细的调试信息
        const subscriptions: Array<Record<string, unknown>> = Array.isArray(
            nodeResult.subscriptions
        )
            ? nodeResult.subscriptions
            : [];
        const nodes: Array<Record<string, unknown>> = Array.isArray(nodeResult.nodes)
            ? nodeResult.nodes
            : [];

        const debugInfo = {
            requestInfo: {
                providedUrl: !!subscriptionUrl,
                providedSubscriptionId: !!subscriptionId,
                providedProfileId: !!profileId,
                userAgent: userAgent,
            },
            subscriptionInfo: {
                totalSubscriptions: subscriptions.length,
                successfulSubscriptions: subscriptions.filter((s) => s.success).length,
                failedSubscriptions: subscriptions.filter((s) => !s.success).length,
            },
            nodeInfo: {
                totalNodes: nodeResult.totalCount || 0,
                protocols: nodeResult.stats?.protocols || {},
                regions: nodeResult.stats?.regions || {},
            },
            detailedSubscriptions: subscriptions.map((sub) => {
                const subNodes = Array.isArray(sub.nodes) ? sub.nodes : [];
                return {
                    name: sub.subscriptionName,
                    url: redactUrl(sub.url),
                    success: sub.success,
                    nodeCount: subNodes.length,
                    error: sub.error,
                    isManualNode: sub.isManualNode || false,
                    protocols: sub.success ? calculateProtocolStats(subNodes) : {},
                    regions: sub.success ? calculateRegionStats(subNodes) : {},
                };
            }),
            sampleNodes: nodes.slice(0, 5).map((node) => ({
                name: node.name,
                protocol: node.protocol,
                region: node.region,
                url: redactUrl(node.url), // 隐藏敏感信息
            })),
        };

        return createJsonResponse({
            success: true,
            debugInfo,
        });
    } catch (e) {
        return createJsonResponse(
            {
                error: `调试失败: ${(e as Error).message}`,
                stack: (e as Error).stack,
            },
            500
        );
    }
}

/**
 * 获取系统环境信息
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleSystemInfoRequest(request: Request, env: Env) {
    if (request.method !== 'GET') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const storageType = await StorageFactory.getStorageType(env);
        const storageAdapter = StorageFactory.createAdapter(env, storageType);

        // 获取基本统计信息
        const [allSubscriptions, allProfiles] = await Promise.all([
            typeof storageAdapter.getAllSubscriptions === 'function'
                ? storageAdapter.getAllSubscriptions()
                : storageAdapter.get('misub_subscriptions_v1').then((res) => res || []),
            typeof storageAdapter.getAllProfiles === 'function'
                ? storageAdapter.getAllProfiles()
                : storageAdapter.get('misub_profiles_v1').then((res) => res || []),
        ]);

        const subscriptionList = Array.isArray(allSubscriptions) ? allSubscriptions : [];
        const profileList = Array.isArray(allProfiles) ? allProfiles : [];
        const activeSubscriptions = subscriptionList.filter((sub) => sub.enabled).length;
        const activeProfiles = profileList.filter((profile) => profile.enabled).length;

        const systemInfo = {
            environment: {
                storageType,
                availableFeatures: {
                    kv: storageType === 'kv',
                    d1: storageType === 'd1',
                    dual: StorageFactory.hasDualStorage(env),
                },
                bindings: {
                    hasKv: !!StorageFactory.resolveKV(env),
                    hasD1: !!env.MISUB_DB,
                    hasAdminPassword: !!env.ADMIN_PASSWORD,
                    hasCookieSecret: !!env.COOKIE_SECRET,
                    hasTelegramBot: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID,
                },
            },
            statistics: {
                subscriptions: {
                    total: subscriptionList.length,
                    active: activeSubscriptions,
                    inactive: subscriptionList.length - activeSubscriptions,
                },
                profiles: {
                    total: profileList.length,
                    active: activeProfiles,
                    inactive: profileList.length - activeProfiles,
                },
            },
            timestamp: new Date().toISOString(),
            uptime: null, // Cloudflare Workers 中没有 process.uptime
        };

        return createJsonResponse({
            success: true,
            systemInfo,
        });
    } catch (e) {
        return createErrorResponse(`获取系统信息失败: ${(e as Error).message}`, 500);
    }
}

/**
 * 测试存储连接
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleStorageTestRequest(request: Request, env: Env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const storageType = await StorageFactory.getStorageType(env);
        const storageAdapter = StorageFactory.createAdapter(env, storageType);

        const testKey = `misub_test_${Date.now()}`;
        const testValue = {
            timestamp: new Date().toISOString(),
            test: true,
            storageType,
        };

        // 测试写入
        const writeStart = Date.now();
        await storageAdapter.put(testKey, testValue);
        const writeTime = Date.now() - writeStart;

        // 测试读取
        const readStart = Date.now();
        const readValue = await storageAdapter.get(testKey);
        const readTime = Date.now() - readStart;

        // 测试删除
        const deleteStart = Date.now();
        await storageAdapter.delete(testKey);
        const deleteTime = Date.now() - deleteStart;

        const isSuccessful = JSON.stringify(readValue) === JSON.stringify(testValue);

        const testResults = {
            storageType,
            operations: {
                write: {
                    success: true,
                    time: writeTime,
                },
                read: {
                    success: isSuccessful,
                    time: readTime,
                },
                delete: {
                    success: true,
                    time: deleteTime,
                },
            },
            overall: {
                success: isSuccessful,
                totalTime: writeTime + readTime + deleteTime,
            },
            timestamp: new Date().toISOString(),
        };

        return createJsonResponse({
            success: true,
            testResults,
        });
    } catch (e) {
        return createJsonResponse(
            {
                error: `存储测试失败: ${(e as Error).message}`,
                storageType: await StorageFactory.getStorageType(env),
            },
            500
        );
    }
}

/**
 * 导出数据（备份功能）
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleExportDataRequest(request: Request, env: Env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
        const {
            includeSubscriptions = true,
            includeProfiles = true,
            includeSettings = false,
        } = requestData;

        const storageAdapter = StorageFactory.createAdapter(
            env,
            await StorageFactory.getStorageType(env)
        );
        const exportData: DebugExportData = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                storageType: await StorageFactory.getStorageType(env),
            },
            data: {},
        };

        if (includeSubscriptions) {
            const subscriptions = (await storageAdapter.get('misub_subscriptions_v1')) || [];
            exportData.data.subscriptions = redactSensitiveObject(subscriptions);
        }

        if (includeProfiles) {
            const profiles = (await storageAdapter.get('misub_profiles_v1')) || [];
            exportData.data.profiles = redactSensitiveObject(profiles);
        }

        if (includeSettings) {
            const settings = (await storageAdapter.get('misub_settings_v1')) || {};
            exportData.data.settings = redactSensitiveObject(settings);
        }

        const exportSize = JSON.stringify(exportData).length;

        return createJsonResponse({
            success: true,
            exportData,
            metadata: {
                size: exportSize,
                subscriptionsCount: Array.isArray(exportData.data.subscriptions)
                    ? exportData.data.subscriptions.length
                    : 0,
                profilesCount: Array.isArray(exportData.data.profiles)
                    ? exportData.data.profiles.length
                    : 0,
                settingsCount: Object.keys(exportData.data.settings || {}).length,
            },
        });
    } catch (e) {
        return createErrorResponse(`数据导出失败: ${(e as Error).message}`, 500);
    }
}

/**
 * 节点内容预览（不解析，只显示原始内容）
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handlePreviewContentRequest(request: Request, env: Env) {
    if (request.method !== 'POST') {
        return createJsonResponse('Method Not Allowed', 405);
    }

    try {
        const requestData = await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
        const { url, userAgent = 'MiSub-Preview/1.0', maxLength = 5000 } = requestData;

        if (!url) {
            return createJsonResponse(
                {
                    error: '请提供订阅URL',
                },
                400
            );
        }

        const urlValidation = validatePublicFetchUrl(url);
        if (!urlValidation.ok) {
            return createErrorResponse(urlValidation.error, 400);
        }

        const response = await safeFetchPublicUrl(urlValidation.url!.toString(), {
            headers: { 'User-Agent': userAgent },
        });

        if (!response.ok) {
            return createJsonResponse(
                {
                    error: `HTTP ${response.status}: ${response.statusText}`,
                },
                400
            );
        }

        const rawContent = await response.text();
        const contentLength = rawContent.length;

        // 检测内容类型
        const isBase64 = /^[A-Za-z0-9+/=]+$/s.test(rawContent.replace(/\s/g, ''));
        let decodedContent = rawContent;
        const contentInfo: Record<string, unknown> = {
            originalLength: contentLength,
            isBase64,
            contentType: 'unknown',
        };

        if (isBase64) {
            try {
                const cleanedContent = rawContent.replace(/\s/g, '');
                const binaryString = atob(cleanedContent);
                decodedContent = new TextDecoder('utf-8').decode(
                    new Uint8Array([...binaryString].map((c) => c.charCodeAt(0)))
                );
                contentInfo.decodedLength = decodedContent.length;
                contentInfo.decodeSuccess = true;
            } catch (e) {
                contentInfo.decodeError = (e as Error).message;
                contentInfo.decodeSuccess = false;
            }
        }

        // 检测内容格式
        if (decodedContent.includes('proxies:') && decodedContent.includes('rules:')) {
            contentInfo.contentType = 'clash-config';
        } else if (decodedContent.includes('outbounds') && decodedContent.includes('inbounds')) {
            contentInfo.contentType = 'singbox-config';
        } else {
            const nodeMatches = decodedContent.match(
                /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//gm
            );
            if (nodeMatches) {
                contentInfo.contentType = 'node-list';
                contentInfo.nodeCount = nodeMatches.length;
            }
        }

        // 截取内容用于预览
        const previewContent =
            decodedContent.length > maxLength
                ? decodedContent.substring(0, maxLength) + '\n...[内容已截断]'
                : decodedContent;

        return createJsonResponse({
            success: true,
            contentInfo,
            previewContent,
            fullContent: requestData.fullExport === true ? decodedContent : null,
        });
    } catch (e) {
        return createErrorResponse(`内容预览失败: ${(e as Error).message}`, getErrorStatus(e, 500));
    }
}

/**
 * 测试Telegram通知
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @returns {Promise<Response>} HTTP响应
 */
export async function handleTestNotificationRequest(request: Request, env: Env) {
    if (request.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    try {
        const { botToken, chatId } = await readJsonWithLimit(request, JSON_BODY_LIMITS.small);
        const settings = { BotToken: botToken, ChatID: chatId };

        const result = await debugTgNotification(
            settings,
            '🔔 <b>通知测试</b> 🔔\n\n这是来自 MiSub 的测试消息，用于验证您的配置是否正确。'
        );

        if (result.success) {
            return createJsonResponse({ success: true, detail: result.response });
        } else {
            return createJsonResponse(
                { success: false, error: result.error, detail: result.response },
                400
            );
        }
    } catch (e) {
        return createErrorResponse((e as Error).message, getErrorStatus(e, 500));
    }
}
