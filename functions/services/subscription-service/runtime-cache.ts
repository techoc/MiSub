/**
 * 订阅节点缓存与运行时信息（nodeCount / 流量 UserInfo / 识别名称）读写
 * 从 subscription-service.js 拆分而来；编排器见 ../subscription-service.js。
 */

import { isRealProxyNode } from './source-identity.ts';

import type { SubscriptionUserInfo } from '../../../types/models.ts';

/** 订阅节点保护性缓存条目 */
export interface SubscriptionNodeCacheEntry {
    nodes: string[];
    nodeCount: number;
    updatedAt: string;
    filterFingerprint?: string;
    sourceId?: string | null;
    sourceName?: string;
    sourceUrl?: string;
}

/** 订阅运行时信息（写回订阅记录） */
export interface SubscriptionRuntimeInfo {
    nodeCount?: number;
    userInfo?: SubscriptionUserInfo | null;
    lastGoodNodeCount?: number;
    detectedName?: string;
    [key: string]: unknown;
}

/** 运行时缓存用到的存储适配器最小面 */
interface RuntimeCacheStorage {
    get(key: string): Promise<unknown>;
    put?(key: string, value: unknown): Promise<unknown>;
    updateSubscriptionById?(
        id: string,
        updater: (current: Record<string, unknown>) => Record<string, unknown> | null
    ): Promise<unknown>;
}

/** 入参归一为普通记录（对外函数接受 unknown，内部按字段收窄） */
function asRecord(value: unknown): Record<string, unknown> {
    return (value as Record<string, unknown>) || {};
}

export function parseSubscriptionUserInfoHeader(header: unknown): SubscriptionUserInfo | null {
    if (typeof header !== 'string' || !header.trim()) return null;

    const info: SubscriptionUserInfo = {};
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
export function buildSubscriptionNodeCacheKey(sub: unknown = {}): string {
    const record = asRecord(sub);
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (id) return `node_cache_subscription_${encodeURIComponent(id)}`;

    const url = typeof record.url === 'string' ? record.url.trim() : '';
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
export function buildSubscriptionFilterFingerprint(sub: unknown = {}): string {
    const record = asRecord(sub);
    const exclude = typeof record.exclude === 'string' ? record.exclude.trim() : '';
    const operators = Array.isArray(record.operators) ? JSON.stringify(record.operators) : '';
    const nodeTransform = record.nodeTransform ? JSON.stringify(record.nodeTransform) : '';
    return JSON.stringify([exclude, operators, nodeTransform]);
}

/**
 * 读取单机场订阅的保护性缓存（预览链路与输出链路共用）。
 * @param storage 存储适配器
 * @param sub 订阅对象（用于构建缓存 key）
 */
export async function readSubscriptionNodeCache(
    storage: unknown,
    sub: unknown
): Promise<SubscriptionNodeCacheEntry | null> {
    const adapter = storage as RuntimeCacheStorage | null | undefined;
    if (typeof adapter?.get !== 'function') return null;
    try {
        const cached = await adapter.get(buildSubscriptionNodeCacheKey(sub));
        const entry = cached as SubscriptionNodeCacheEntry | null;
        if (!entry || !Array.isArray(entry.nodes)) return null;
        const nodes = entry.nodes.filter((node) => isRealProxyNode(node));
        return nodes.length > 0 ? { ...entry, nodes } : null;
    } catch (error) {
        console.warn('[SubscriptionCache] Failed to read cache:', error);
        return null;
    }
}

export async function writeSubscriptionNodeCache(
    storage: unknown,
    sub: unknown,
    nodes: unknown
): Promise<boolean> {
    const adapter = storage as RuntimeCacheStorage | null | undefined;
    if (typeof adapter?.put !== 'function') return false;
    const realNodes = Array.isArray(nodes)
        ? (nodes as string[]).filter((node) => isRealProxyNode(node))
        : [];
    if (realNodes.length === 0) return false;

    const record = asRecord(sub);
    try {
        await adapter.put(buildSubscriptionNodeCacheKey(sub), {
            nodes: realNodes,
            nodeCount: realNodes.length,
            updatedAt: new Date().toISOString(),
            filterFingerprint: buildSubscriptionFilterFingerprint(sub),
            sourceId: record.id || null,
            sourceName: record.name || '',
            sourceUrl: record.url || '',
        });
        return true;
    } catch (error) {
        console.warn('[SubscriptionCache] Failed to write cache:', error);
        return false;
    }
}

async function writeSubscriptionRuntimeInfo(
    storage: unknown,
    sub: unknown,
    runtimeInfo: SubscriptionRuntimeInfo = {}
): Promise<boolean> {
    const adapter = storage as RuntimeCacheStorage | null | undefined;
    const subId = typeof asRecord(sub).id === 'string' ? String(asRecord(sub).id) : '';
    if (!adapter || !subId) return false;

    const { nodeCount, userInfo, lastGoodNodeCount, detectedName } = runtimeInfo;
    const hasUserInfo = Object.prototype.hasOwnProperty.call(runtimeInfo, 'userInfo');
    const hasLastGoodNodeCount = Object.prototype.hasOwnProperty.call(
        runtimeInfo,
        'lastGoodNodeCount'
    );
    const hasDetectedName = typeof detectedName === 'string' && detectedName.trim().length > 0;

    try {
        const applyUpdate = (
            current: Record<string, unknown> | null
        ): Record<string, unknown> | null => {
            if (!current) return current;
            return {
                ...current,
                nodeCount: Number.isFinite(nodeCount) ? nodeCount : current.nodeCount,
                ...(hasLastGoodNodeCount &&
                Number.isFinite(lastGoodNodeCount) &&
                (lastGoodNodeCount as number) > 0
                    ? { lastGoodNodeCount }
                    : {}),
                ...(hasUserInfo ? { userInfo } : {}),
                // 识别到的机场名：仅记录，不覆盖用户手动设置的 name
                ...(hasDetectedName ? { detectedName: detectedName.trim() } : {}),
                lastError: null,
                lastUpdate: new Date().toISOString(),
            };
        };

        if (typeof adapter.updateSubscriptionById === 'function') {
            return Boolean(await adapter.updateSubscriptionById(subId, applyUpdate));
        }

        if (typeof adapter.get === 'function' && typeof adapter.put === 'function') {
            const rawAll = await adapter.get('misub_subscriptions_v1');
            if (!Array.isArray(rawAll)) return false;
            const all = rawAll as Array<Record<string, unknown>>;
            const index = all.findIndex((item) => item?.id === subId);
            if (index === -1) return false;
            all[index] = applyUpdate(all[index]) ?? all[index];
            await adapter.put('misub_subscriptions_v1', all);
            return true;
        }
    } catch (error) {
        console.warn('[SubscriptionRuntimeInfo] Failed to write subscription info:', error);
    }

    return false;
}

export function scheduleSubscriptionRuntimeInfoUpdate(
    context: unknown,
    storage: unknown,
    sub: unknown,
    runtimeInfo: SubscriptionRuntimeInfo
) {
    const promise = writeSubscriptionRuntimeInfo(storage, sub, runtimeInfo);

    if (context && typeof (context as { waitUntil?: unknown }).waitUntil === 'function') {
        (context as { waitUntil: (promise: Promise<unknown>) => void }).waitUntil(
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

export function recordCurrentRequestRuntimeInfo(
    context: unknown,
    sub: unknown,
    runtimeInfo: SubscriptionRuntimeInfo
) {
    const record = asRecord(sub);
    const key = record.id || record.url;
    if (!context || !key) return;

    const contextRecord = context as Record<string, unknown>;
    const currentRuntimeInfo =
        (contextRecord.currentSubscriptionRuntimeInfo as Record<string, unknown> | undefined) || {};
    currentRuntimeInfo[String(key)] = runtimeInfo;
    contextRecord.currentSubscriptionRuntimeInfo = currentRuntimeInfo;
}
