/**
 * 订阅节点缓存与运行时信息（nodeCount / 流量 UserInfo / 识别名称）读写
 * 从 subscription-service.js 拆分而来；编排器见 ../subscription-service.js。
 */

import { isRealProxyNode } from './source-identity.ts';

export function parseSubscriptionUserInfoHeader(header) {
    if (typeof header !== 'string' || !header.trim()) return null;

    const info = {};
    header.split(';').forEach((part) => {
        const [rawKey, rawValue] = part.trim().split('=');
        const key = rawKey?.trim();
        const value = rawValue?.trim();
        if (!key || value === undefined || value === '') return;
        info[key] = /^\d+$/.test(value) ? Number(value) : value;
    });

    return Object.keys(info).length > 0 ? info : null;
}

/**
 * 构建单机场订阅源的保护性缓存 key
 */
export function buildSubscriptionNodeCacheKey(sub: Record<string, any> = {}) {
    const id = typeof sub.id === 'string' ? sub.id.trim() : '';
    if (id) return `node_cache_subscription_${encodeURIComponent(id)}`;

    const url = typeof sub.url === 'string' ? sub.url.trim() : '';
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }
    return `node_cache_subscription_url_${Math.abs(hash).toString(36)}`;
}

/**
 * 构建订阅"过滤配置"指纹（exclude 文本 + 算子链 + 旧版 nodeTransform）。
 * 用于区分"节点数缩减是用户改了过滤配置"与"上游响应被截断"：
 * 前者是预期行为，不应触发骤降保护或回退旧缓存。
 */
export function buildSubscriptionFilterFingerprint(sub: Record<string, any> = {}) {
    const exclude = typeof sub.exclude === 'string' ? sub.exclude.trim() : '';
    const operators = Array.isArray(sub.operators) ? JSON.stringify(sub.operators) : '';
    const nodeTransform = sub.nodeTransform ? JSON.stringify(sub.nodeTransform) : '';
    return JSON.stringify([exclude, operators, nodeTransform]);
}

/**
 * 读取单机场订阅的保护性缓存（预览链路与输出链路共用）。
 * @param {Object} storage 存储适配器
 * @param {Object} sub 订阅对象（用于构建缓存 key）
 * @returns {Promise<{nodes: string[], nodeCount: number, updatedAt: string, filterFingerprint?: string}|null>}
 */
export async function readSubscriptionNodeCache(storage, sub) {
    if (!storage?.get) return null;
    try {
        const cached = await storage.get(buildSubscriptionNodeCacheKey(sub));
        if (!cached || !Array.isArray(cached.nodes)) return null;
        const nodes = cached.nodes.filter(isRealProxyNode);
        return nodes.length > 0 ? { ...cached, nodes } : null;
    } catch (error) {
        console.warn('[SubscriptionCache] Failed to read cache:', error);
        return null;
    }
}

export async function writeSubscriptionNodeCache(storage, sub, nodes) {
    if (!storage?.put) return false;
    const realNodes = Array.isArray(nodes) ? nodes.filter(isRealProxyNode) : [];
    if (realNodes.length === 0) return false;

    try {
        await storage.put(buildSubscriptionNodeCacheKey(sub), {
            nodes: realNodes,
            nodeCount: realNodes.length,
            updatedAt: new Date().toISOString(),
            filterFingerprint: buildSubscriptionFilterFingerprint(sub),
            sourceId: sub?.id || null,
            sourceName: sub?.name || '',
            sourceUrl: sub?.url || '',
        });
        return true;
    } catch (error) {
        console.warn('[SubscriptionCache] Failed to write cache:', error);
        return false;
    }
}

async function writeSubscriptionRuntimeInfo(storage, sub, runtimeInfo: Record<string, any> = {}) {
    if (!storage || !sub?.id) return false;
    const { nodeCount, userInfo, lastGoodNodeCount, detectedName } = runtimeInfo;
    const hasUserInfo = Object.prototype.hasOwnProperty.call(runtimeInfo, 'userInfo');
    const hasLastGoodNodeCount = Object.prototype.hasOwnProperty.call(
        runtimeInfo,
        'lastGoodNodeCount'
    );
    const hasDetectedName = typeof detectedName === 'string' && detectedName.trim().length > 0;

    try {
        const applyUpdate = (current) => {
            if (!current) return current;
            return {
                ...current,
                nodeCount: Number.isFinite(nodeCount) ? nodeCount : current.nodeCount,
                ...(hasLastGoodNodeCount &&
                Number.isFinite(lastGoodNodeCount) &&
                lastGoodNodeCount > 0
                    ? { lastGoodNodeCount }
                    : {}),
                ...(hasUserInfo ? { userInfo } : {}),
                // 识别到的机场名：仅记录，不覆盖用户手动设置的 name
                ...(hasDetectedName ? { detectedName: detectedName.trim() } : {}),
                lastError: null,
                lastUpdate: new Date().toISOString(),
            };
        };

        if (typeof storage.updateSubscriptionById === 'function') {
            return Boolean(await storage.updateSubscriptionById(sub.id, applyUpdate));
        }

        if (typeof storage.get === 'function' && typeof storage.put === 'function') {
            const all = await storage.get('misub_subscriptions_v1');
            if (!Array.isArray(all)) return false;
            const index = all.findIndex((item) => item?.id === sub.id);
            if (index === -1) return false;
            all[index] = applyUpdate(all[index]);
            await storage.put('misub_subscriptions_v1', all);
            return true;
        }
    } catch (error) {
        console.warn('[SubscriptionRuntimeInfo] Failed to write subscription info:', error);
    }

    return false;
}

export function scheduleSubscriptionRuntimeInfoUpdate(context, storage, sub, runtimeInfo) {
    const promise = writeSubscriptionRuntimeInfo(storage, sub, runtimeInfo);

    if (context && typeof context.waitUntil === 'function') {
        context.waitUntil(
            promise.catch((error) => {
                console.warn('[SubscriptionRuntimeInfo] Async update failed:', error);
            })
        );
        return;
    }

    promise.catch((error) => {
        console.warn('[SubscriptionRuntimeInfo] Async update failed:', error);
    });
}

export function recordCurrentRequestRuntimeInfo(context, sub, runtimeInfo) {
    const key = sub?.id || sub?.url;
    if (!context || !key) return;

    context.currentSubscriptionRuntimeInfo = context.currentSubscriptionRuntimeInfo || {};
    context.currentSubscriptionRuntimeInfo[key] = runtimeInfo;
}

/**
 * 带重试的订阅获取函数（支持网络错误和 HTTP 状态码重试）
 * @param {string} url - 请求 URL
 * @param {Object} init - fetch 初始化选项
 * @param {Object} options - 重试选项
 * @returns {Promise<Response>} - 响应对象
 */
