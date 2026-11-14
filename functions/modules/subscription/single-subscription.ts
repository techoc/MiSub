import { StorageFactory } from '../../storage-adapter.ts';
import { createJsonResponse } from '../utils.ts';
import { parseNodeInfo } from '../utils/geo-utils.ts';
import { calculateProtocolStats, calculateRegionStats } from '../utils/node-parser.ts';
import { KV_KEY_SUBS } from '../config.ts';
import { fetchSubscriptionNodes } from './node-fetcher.ts';

import type { SubscriptionItem } from '../../../types/models.ts';

/** 预览用到的存储适配器最小面 */
interface PreviewStorage {
    get(key: string): Promise<unknown>;
    getSubscriptionById?(id: string): Promise<SubscriptionItem | null>;
}

/**
 * 处理单个订阅模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {Object} env - Cloudflare环境对象
 * @param {string} subscriptionId - 订阅ID
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
export async function handleSingleSubscriptionMode(
    request: Request,
    env: Env,
    subscriptionId: string,
    userAgent: string,
    skipCertVerify = false
) {
    const storageAdapter = StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );
    const adapter = storageAdapter as unknown as PreviewStorage;

    // 查找订阅
    const subscription: SubscriptionItem | null =
        typeof adapter.getSubscriptionById === 'function'
            ? await adapter.getSubscriptionById(subscriptionId)
            : (((await adapter.get(KV_KEY_SUBS)) as SubscriptionItem[] | null) || []).find(
                  (sub) => sub.id === subscriptionId
              ) || null;

    if (!subscription || !subscription.enabled) {
        return createJsonResponse({ error: '订阅不存在或已禁用' }, 404);
    }
    const url = subscription.url || '';

    // 检查是否为手工节点
    if (!url.startsWith('http')) {
        // 手工节点：直接解析节点URL
        const nodeInfo = parseNodeInfo(url);
        const manualNodeResult = {
            subscriptionName: subscription.name || '手工节点',
            url,
            success: true,
            nodes: [
                {
                    ...nodeInfo,
                    subscriptionName: subscription.name || '手工节点',
                },
            ],
            error: null,
            isManualNode: true,
        };

        return {
            success: true,
            subscriptions: [manualNodeResult],
            nodes: manualNodeResult.nodes,
            totalCount: manualNodeResult.nodes.length,
            stats: {
                protocols: { [nodeInfo.protocol]: 1 },
                regions: { [nodeInfo.region || '其他']: 1 },
            },
        };
    }

    // HTTP订阅：获取节点（开启保护性缓存时，上游失败回退缓存节点，与输出链路一致）
    const result = await fetchSubscriptionNodes(
        url,
        subscription.name,
        userAgent,
        subscription.customUserAgent ?? null,
        false,
        subscription.exclude ?? '',
        subscription.fetchProxy ?? null,
        skipCertVerify,
        Boolean(subscription?.plusAsSpace),
        subscription?.enableNodeCache === true,
        storageAdapter,
        subscription
    );

    return {
        success: true,
        subscriptions: [result],
        nodes: result.nodes,
        totalCount: result.nodes.length,
        stats: {
            protocols: calculateProtocolStats(result.nodes),
            regions: calculateRegionStats(result.nodes),
        },
    };
}

/**
 * 处理直接URL模式的节点获取
 * @param {Object} request - HTTP请求对象
 * @param {string} subscriptionUrl - 订阅URL
 * @param {string} userAgent - 用户代理
 * @returns {Promise<Object>} 处理结果
 */
export async function handleDirectUrlMode(
    subscriptionUrl: string,
    userAgent: string,
    skipCertVerify = false,
    plusAsSpace = false
) {
    const debug = subscriptionUrl.includes('b0b422857bb46aba65da8234c84f38c6');
    const result = await fetchSubscriptionNodes(
        subscriptionUrl,
        '预览订阅',
        userAgent,
        null,
        debug,
        '',
        null,
        skipCertVerify,
        plusAsSpace
    );

    return {
        success: true,
        subscriptions: [result],
        nodes: result.nodes,
        totalCount: result.nodes.length,
        stats: {
            protocols: calculateProtocolStats(result.nodes),
            regions: calculateRegionStats(result.nodes),
        },
    };
}
