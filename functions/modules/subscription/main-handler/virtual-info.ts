/**
 * 到期/流量提示虚拟节点（trojan://127.0.0.1 占位节点）构建
 * 从 main-handler.js 的 handleMisubRequest 拆分而来。
 */

import { formatBytes } from '../../utils.ts';
import {
    formatSubscriptionExpireTime,
    getCurrentRequestUserInfo,
    mergeSubscriptionUserInfo,
} from './user-info.ts';

export function buildPrependedVirtualNodes({
    context,
    config,
    targetMisubs,
    currentProfile,
    isProfileExpired,
}: any) {
    let prependedContentForSubconverter = '';

    if (isProfileExpired) {
        // Use the flag set earlier
        prependedContentForSubconverter = ''; // Expired node is now in targetMisubs
    } else {
        // Otherwise, add traffic and expiration info nodes if enabled.
        if (config.enableTrafficNode !== false) {
            const totalUserInfo = mergeSubscriptionUserInfo(context, targetMisubs);
            const profileExpireTimestamp = currentProfile?.expiresAt
                ? Math.floor(new Date(currentProfile.expiresAt).getTime() / 1000)
                : 0;
            const expireTimestamp =
                profileExpireTimestamp > 0 ? profileExpireTimestamp : totalUserInfo.expire;
            const virtualNodes: any[] = [];

            const totalRemainingBytes = targetMisubs.reduce((acc: any, sub: any) => {
                const userInfo = sub?.enabled ? getCurrentRequestUserInfo(context, sub) : null;
                if (userInfo && userInfo.total > 0) {
                    const used = (userInfo.upload || 0) + (userInfo.download || 0);
                    return acc + Math.max(0, userInfo.total - used);
                }
                return acc;
            }, 0);
            if (totalRemainingBytes > 0) {
                const fakeNodeName = `流量剩余 ≫ ${formatBytes(totalRemainingBytes)}`;
                virtualNodes.push(
                    `trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#${encodeURIComponent(fakeNodeName)}`
                );
            }

            const expireText = formatSubscriptionExpireTime(expireTimestamp);
            if (expireText) {
                const fakeNodeName = `到期时间 ≫ ${expireText}`;
                virtualNodes.push(
                    `trojan://00000000-0000-0000-0000-000000000000@127.0.0.1:443#${encodeURIComponent(fakeNodeName)}`
                );
            }

            prependedContentForSubconverter = virtualNodes.join('\n');
        }
    }

    return prependedContentForSubconverter;
}
