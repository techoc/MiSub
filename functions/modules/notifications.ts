/**
 * 通知功能模块
 * 处理业务层逻辑：订阅到期和流量预警，Cron 任务报告。
 * 核心发送逻辑已抽离至 functions/services/notification-service.js
 */

import { formatBytes } from './utils.ts';
import { KV_KEY_SUBS, KV_KEY_SETTINGS, DEFAULT_SETTINGS, SYSTEM_CONSTANTS } from './config.ts';
// 导入核心通知服务及工具
import {
    sendTgNotification as sendCoreTg,
    sendEnhancedTgNotification as sendCoreEnhancedTg,
    tgEscape as coreTgEscape,
} from '../services/notification-service.ts';
import type {
    KvRecord,
    MisubSettings,
    SubscriptionItem,
    SubscriptionUserInfo,
} from '../../types/models.ts';

/** cron 用到的存储适配器最小面 */
interface CronStorageAdapter {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown): Promise<unknown>;
    getAllSubscriptions?(): Promise<KvRecord[]>;
    putAllSubscriptions?(subscriptions: KvRecord[]): Promise<unknown>;
}

/** 单个订阅的更新结果 */
interface SubscriptionUpdateResult {
    name: string;
    success: boolean;
    traffic?: boolean;
    nodes?: boolean;
    error?: string;
}

/** 节点数量变化记录 */
interface NodeCountChange {
    name: string;
    previous: number;
    current: number;
    diff: number;
}

/**
 * 转义 Telegram HTML 特殊字符
 */
export function tgEscape(text: unknown): string {
    return coreTgEscape(text);
}

/**
 * 发送Telegram基础通知 (兼容旧调用)
 */
export async function sendTgNotification(settings: MisubSettings, message: string) {
    return sendCoreTg(settings, message);
}

/**
 * 增强版TG通知 (兼容旧调用)
 */
export async function sendEnhancedTgNotification(
    settings: MisubSettings,
    type: string,
    clientIp: string,
    additionalData = ''
) {
    return sendCoreEnhancedTg(settings, type, clientIp, additionalData);
}

async function loadSubscriptionsForCron(
    storageAdapter: CronStorageAdapter
): Promise<SubscriptionItem[]> {
    if (typeof storageAdapter.getAllSubscriptions === 'function') {
        const subscriptions = await storageAdapter.getAllSubscriptions();
        if (Array.isArray(subscriptions)) {
            return subscriptions as SubscriptionItem[];
        }
    }

    const subscriptions = await storageAdapter.get(KV_KEY_SUBS);
    return Array.isArray(subscriptions) ? (subscriptions as SubscriptionItem[]) : [];
}

async function persistSubscriptionsForCron(
    storageAdapter: CronStorageAdapter,
    subscriptions: SubscriptionItem[]
) {
    if (typeof storageAdapter.putAllSubscriptions === 'function') {
        await storageAdapter.putAllSubscriptions(subscriptions);
        return;
    }

    await storageAdapter.put(KV_KEY_SUBS, subscriptions);
}

/**
 * 检查并发送订阅到期和流量预警通知
 */
export async function checkAndNotify(sub: SubscriptionItem, settings: MisubSettings, env: Env) {
    if (!sub?.enabled || !sub.userInfo) return;

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. 检查订阅到期
    if (sub.userInfo.expire) {
        const expiryDate = new Date(sub.userInfo.expire * 1000);
        const daysRemaining = Math.ceil((expiryDate.getTime() - now) / ONE_DAY_MS);

        if (daysRemaining <= (settings.NotifyThresholdDays || 7)) {
            if (!sub.lastNotifiedExpire || now - Number(sub.lastNotifiedExpire) > ONE_DAY_MS) {
                const message = `🗓️ <b>订阅临期提醒</b> 🗓️

<b>订阅名称:</b> <code>${tgEscape(sub.name || '未命名')}</code>
<b>状态:</b> <code>${tgEscape(daysRemaining < 0 ? '已过期' : `仅剩 ${daysRemaining} 天到期`)}</code>
<b>到期日期:</b> <code>${expiryDate.toLocaleDateString('zh-CN')}</code>`;

                const sent = await sendCoreTg(settings, message);
                if (sent) {
                    sub.lastNotifiedExpire = now;
                }
            }
        }
    }

    // 2. 检查流量使用
    const { upload, download, total } = sub.userInfo;
    if (Number(total || 0) > 0) {
        const used = Number(upload || 0) + Number(download || 0);
        const usagePercent = Math.round((used / Number(total || 0)) * 100);

        if (usagePercent >= (settings.NotifyThresholdPercent || 90)) {
            if (!sub.lastNotifiedTraffic || now - Number(sub.lastNotifiedTraffic) > ONE_DAY_MS) {
                const message = `📈 <b>流量预警提醒</b> 📈

<b>订阅名称:</b> <code>${tgEscape(sub.name || '未命名')}</code>
<b>状态:</b> <code>已使用 ${usagePercent}%</code>
<b>详情:</b> <code>${tgEscape(formatBytes(used))} / ${tgEscape(formatBytes(total || 0))}</code>`;

                const sent = await sendCoreTg(settings, message);
                if (sent) {
                    sub.lastNotifiedTraffic = now;
                }
            }
        }
    }
}

/**
 * 处理定时任务的通知更新（并行处理版本）
 */
export async function handleCronTrigger(env: Env) {
    const { StorageFactory } = await import('../storage-adapter.ts');

    const storageAdapter = await StorageFactory.createAdapter(
        env,
        await StorageFactory.getStorageType(env)
    );
    const originalSubs = await loadSubscriptionsForCron(storageAdapter);
    const allSubs: SubscriptionItem[] = structuredClone(originalSubs);
    const settings: MisubSettings =
        ((await storageAdapter.get(KV_KEY_SETTINGS)) as MisubSettings) ||
        (DEFAULT_SETTINGS as MisubSettings);

    const httpSubscriptions = allSubs.filter(
        (sub) => String(sub.url || '').startsWith('http') && sub.enabled
    );

    console.info(`[Cron] Starting parallel update for ${httpSubscriptions.length} subscriptions`);
    const startTime = Date.now();

    const CONCURRENCY = 6;
    const TIMEOUT = 15000;

    const nodeRegex =
        /^(ss|ssr|vmess|vless|trojan|hysteria2?|hy|hy2|tuic|anytls|socks5|socks):\/\//gm;
    let changesMade = false;
    let updatedCount = 0;
    let failedCount = 0;
    const failedSubscriptions: Array<{ name: string; error?: string }> = [];

    async function processSubscription(sub: SubscriptionItem): Promise<SubscriptionUpdateResult> {
        try {
            const fetchWithTimeout = (
                url: string,
                options: RequestInit & { cf?: Record<string, unknown> }
            ): Promise<Response> => {
                const { cf, ...requestInit } = options;
                const fetchCall = cf
                    ? fetch(new Request(url, requestInit), { cf })
                    : fetch(new Request(url, requestInit));
                return Promise.race([
                    fetchCall,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
                    ),
                ]);
            };

            const [trafficResult, nodeCountResult] = await Promise.allSettled([
                fetchWithTimeout(String(sub.url || ''), {
                    headers: { 'User-Agent': 'clash-verge/v2.4.3' },
                    redirect: 'follow',
                    cf: { insecureSkipVerify: true },
                }),
                fetchWithTimeout(String(sub.url || ''), {
                    headers: { 'User-Agent': SYSTEM_CONSTANTS.FETCHER_USER_AGENT },
                    redirect: 'follow',
                    cf: { insecureSkipVerify: true },
                }),
            ]);

            let hasTrafficUpdate = false;
            let hasNodeCountUpdate = false;

            if (trafficResult.status === 'fulfilled' && trafficResult.value.ok) {
                const userInfoHeader = trafficResult.value.headers.get('subscription-userinfo');
                if (userInfoHeader) {
                    const info: SubscriptionUserInfo = {};
                    userInfoHeader.split(';').forEach((part) => {
                        const [key, value] = part.trim().split('=');
                        if (key && value) info[key] = /^\d+$/.test(value) ? Number(value) : value;
                    });
                    const originalSub = allSubs.find((s) => s.id === sub.id);
                    if (originalSub) {
                        originalSub.userInfo = info;
                        await checkAndNotify(originalSub, settings, env);
                    }
                    hasTrafficUpdate = true;
                }
            }

            if (nodeCountResult.status === 'fulfilled' && nodeCountResult.value.ok) {
                const text = await nodeCountResult.value.text();
                let decoded = '';
                try {
                    decoded = atob(text.replace(/\s/g, ''));
                } catch {
                    decoded = text;
                }
                const matches = decoded.match(nodeRegex);
                if (matches) {
                    const originalSub = allSubs.find((s) => s.id === sub.id);
                    if (originalSub) {
                        const previousCount = originalSub.nodeCount;
                        const newCount = matches.length;
                        originalSub.nodeCount = newCount;

                        if (previousCount && previousCount > 0) {
                            const diff = newCount - previousCount;
                            const changePercent = Math.abs(diff) / previousCount;
                            const significantChange = Math.abs(diff) >= 10 || changePercent >= 0.2;

                            if (significantChange) {
                                originalSub.nodeCountChange = {
                                    previous: previousCount,
                                    current: newCount,
                                    diff: diff,
                                    timestamp: Date.now(),
                                };
                            }
                        }
                    }
                    hasNodeCountUpdate = true;
                }
            }

            return {
                name: sub.name,
                success: hasTrafficUpdate || hasNodeCountUpdate,
                traffic: hasTrafficUpdate,
                nodes: hasNodeCountUpdate,
            };
        } catch (e) {
            return {
                name: sub.name,
                success: false,
                error: (e as Error).message,
            };
        }
    }

    async function runWithConcurrency<T, R>(
        items: T[],
        concurrency: number,
        fn: (item: T) => Promise<R>
    ): Promise<R[]> {
        const results: Promise<R>[] = [];
        const executing = new Set<Promise<R>>();
        for (const item of items) {
            const promise: Promise<R> = fn(item).then((result) => {
                executing.delete(promise);
                return result;
            });
            executing.add(promise);
            results.push(promise);
            if (executing.size >= concurrency) {
                await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }

    const results = await runWithConcurrency(httpSubscriptions, CONCURRENCY, processSubscription);

    for (const result of results) {
        if (result.success) {
            updatedCount++;
            changesMade = true;
        } else if (result.error) {
            failedCount++;
            failedSubscriptions.push({ name: result.name, error: result.error });
        }
    }

    if (changesMade) {
        await persistSubscriptionsForCron(storageAdapter, allSubs);
    }

    const duration = Date.now() - startTime;
    const summary = {
        success: true,
        summary: {
            total: httpSubscriptions.length,
            updated: updatedCount,
            failed: failedCount,
            changes: changesMade,
            duration: `${duration}ms`,
            failed_subscriptions: failedSubscriptions,
        },
    };

    console.info(`[Cron] Completed in ${duration}ms:`, summary.summary);

    const nodeCountChanges: NodeCountChange[] = [];
    for (const sub of allSubs) {
        const change = sub.nodeCountChange as
            { previous?: number; current?: number; diff?: number } | undefined;
        if (change) {
            nodeCountChanges.push({
                name: sub.name,
                previous: Number(change.previous ?? 0),
                current: Number(change.current ?? 0),
                diff: Number(change.diff ?? 0),
            });
            delete sub.nodeCountChange;
        }
    }

    // 发送节点变化通知
    if (nodeCountChanges.length > 0 && settings.BotToken && settings.ChatID) {
        let nodeChangeMessage = `📉 <b>节点数量变化提醒</b>\n\n`;
        nodeChangeMessage += `检测到 ${nodeCountChanges.length} 个订阅的节点数量发生显著变化：\n\n`;

        nodeCountChanges.slice(0, 10).forEach((change) => {
            const changeType = change.diff > 0 ? '增加' : '减少';
            const emoji = change.diff > 0 ? '📈' : '📉';
            nodeChangeMessage += `${emoji} <b>${tgEscape(change.name)}</b>\n`;
            nodeChangeMessage += `  ${tgEscape(changeType)} ${Math.abs(change.diff)} 个 (<code>${change.previous}</code> → <code>${change.current}</code>)\n`;
        });

        if (nodeCountChanges.length > 10) {
            nodeChangeMessage += `\n... 还有 ${nodeCountChanges.length - 10} 个订阅有变化`;
        }

        await sendCoreTg(settings, nodeChangeMessage);
    }

    // 发送更新摘要
    if (settings.BotToken && settings.ChatID) {
        let updateMessage = `🔄 <b>订阅自动更新完成</b>\n\n`;
        updateMessage += `📊 <b>统计信息</b>\n`;
        updateMessage += `• 总订阅数: <code>${httpSubscriptions.length}</code> 个\n`;
        updateMessage += `• 成功更新: <code>${updatedCount}</code> 个\n`;

        if (failedCount > 0) {
            updateMessage += `• 更新失败: <code>${failedCount}</code> 个\n`;
        }

        if (nodeCountChanges.length > 0) {
            updateMessage += `• 节点变化: <code>${nodeCountChanges.length}</code> 个订阅\n`;
        }

        updateMessage += `\n⏱️ 耗时: <code>${duration}ms</code>\n`;

        if (failedSubscriptions.length > 0) {
            updateMessage += `\n❌ <b>失败详情:</b>\n`;
            failedSubscriptions.slice(0, 5).forEach((f) => {
                const errorText = f.error || '';
                const errorShort =
                    errorText.length > 30 ? errorText.substring(0, 30) + '...' : errorText;
                updateMessage += `• ${tgEscape(f.name)}: <code>${tgEscape(errorShort)}</code>\n`;
            });
        }

        await sendCoreTg(settings, updateMessage);
    }

    return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
