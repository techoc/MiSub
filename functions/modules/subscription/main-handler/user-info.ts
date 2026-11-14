/**
 * 订阅用户信息（流量/到期）合并与格式化
 * 从 main-handler.js 拆分而来；编排器见 ../main-handler.js。
 */

import type { KvRecord, SubscriptionItem } from '../../../../types/models.ts';

/** 合并后的流量/到期信息 */
interface MergedUserInfo {
    upload: number;
    download: number;
    total: number;
    expire: number;
}

/** 把外部传入的上下文归一为可索引记录 */
function asContext(context: unknown): KvRecord {
    return (context as KvRecord | null | undefined) || {};
}

export function getCurrentRequestUserInfo(
    context: unknown,
    sub: SubscriptionItem | null | undefined
): KvRecord | null {
    const currentInfo = asContext(context).currentSubscriptionRuntimeInfo || {};
    const runtimeKey = [sub?.id, sub?.url].find(
        (key) => key != null && Object.prototype.hasOwnProperty.call(currentInfo, String(key))
    );
    if (runtimeKey) {
        return (currentInfo[String(runtimeKey)] as KvRecord | null | undefined)?.userInfo || null;
    }
    return (sub?.userInfo as KvRecord | null | undefined) || null;
}

export function mergeSubscriptionUserInfo(
    context: unknown,
    subscriptions: unknown
): MergedUserInfo {
    const ctx = asContext(context);
    const strategy = ctx.config?.mergeExpireStrategy || 'max';
    const list: KvRecord[] = Array.isArray(subscriptions) ? subscriptions : [];
    return list.reduce<MergedUserInfo>(
        (acc, sub: KvRecord) => {
            const userInfo = sub?.enabled
                ? getCurrentRequestUserInfo(ctx, sub as SubscriptionItem)
                : null;
            if (!userInfo) return acc;

            let nextExpire = acc.expire;
            if (userInfo.expire > 0) {
                if (acc.expire === 0) {
                    nextExpire = userInfo.expire;
                } else {
                    nextExpire =
                        strategy === 'min'
                            ? Math.min(acc.expire, userInfo.expire)
                            : Math.max(acc.expire, userInfo.expire);
                }
            }

            if (sub?.excludeTraffic) {
                return {
                    ...acc,
                    expire: nextExpire,
                };
            }

            return {
                upload: (acc.upload || 0) + (userInfo.upload || 0),
                download: (acc.download || 0) + (userInfo.download || 0),
                total: (acc.total || 0) + (userInfo.total || 0),
                expire: nextExpire,
            };
        },
        { upload: 0, download: 0, total: 0, expire: 0 }
    );
}

export function buildUserInfoHeaderFromSubscriptions(
    context: unknown,
    subscriptions: unknown,
    profileExpiresAt: string | number | null = ''
): string | null {
    const totalUserInfo = mergeSubscriptionUserInfo(context, subscriptions);

    const profileExpireTimestamp = profileExpiresAt
        ? Math.floor(new Date(profileExpiresAt).getTime() / 1000)
        : 0;
    const safeUserInfo = {
        upload: isFinite(totalUserInfo.upload) ? totalUserInfo.upload : 0,
        download: isFinite(totalUserInfo.download) ? totalUserInfo.download : 0,
        total: isFinite(totalUserInfo.total) ? totalUserInfo.total : 0,
        expire:
            profileExpireTimestamp > 0
                ? profileExpireTimestamp
                : isFinite(totalUserInfo.expire)
                  ? totalUserInfo.expire
                  : 0,
    };

    return safeUserInfo.total > 0
        ? `upload=${safeUserInfo.upload}; download=${safeUserInfo.download}; total=${safeUserInfo.total}; expire=${safeUserInfo.expire}`
        : null;
}

export function resolveNotificationExpireDate(
    profileExpiresAt: string | number | null | undefined,
    mergedExpireTimestamp: number | string = 0
): Date | null {
    let date = profileExpiresAt ? new Date(profileExpiresAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
        const timestamp = Number(mergedExpireTimestamp);
        date =
            Number.isFinite(timestamp) && timestamp > 0
                ? new Date(timestamp > 1e12 ? timestamp : timestamp * 1000)
                : null;
    }

    return !date || Number.isNaN(date.getTime()) ? null : date;
}

export function formatNotificationExpireTime(
    profileExpiresAt: string | number | null | undefined,
    mergedExpireTimestamp: number | string = 0
): string {
    const date = resolveNotificationExpireDate(profileExpiresAt, mergedExpireTimestamp);

    if (!date) return '未设置';

    return date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
    });
}

export function formatNotificationExpireStatus(
    profileExpiresAt: string | number | null | undefined,
    mergedExpireTimestamp: number | string = 0,
    now: number = Date.now(),
    thresholdDays: number = 3
): string {
    const date = resolveNotificationExpireDate(profileExpiresAt, mergedExpireTimestamp);
    if (!date) return '正常';
    if (date.getTime() <= now) return '已到期';

    const threshold = Number.isFinite(Number(thresholdDays))
        ? Math.max(0, Number(thresholdDays))
        : 3;
    const remainingMs = date.getTime() - now;
    if (remainingMs <= threshold * 24 * 60 * 60 * 1000) return '即将到期';
    return '正常';
}

export function formatSubscriptionExpireTime(expireTimestamp: unknown): string {
    const timestamp = Number(expireTimestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

    const date = new Date(timestamp * 1000);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function countSubscriptionNodes(nodeList: unknown, prependedContent: unknown = ''): number {
    const lines = String(nodeList || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const prependedLines = String(prependedContent || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (prependedLines.length > 0 && prependedLines.every((line, index) => lines[index] === line)) {
        return Math.max(0, lines.length - prependedLines.length);
    }

    return lines.length;
}
