/**
 * 节点文本输入处理：用户直接粘贴节点/订阅链接时的导入入口
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { clearAllNodeCaches } from '../../../services/node-cache-service.ts';
import { createJsonResponse, escapeHtml } from '../../utils.ts';
import {
    createRequestCache,
    getCachedStorageAdapter,
    getCachedSubscriptions,
    getTelegramPushConfig,
} from './cache.ts';
import {
    buildImportGroupName,
    extractNodeName,
    extractNodeUrls,
    extractSubscriptionUrls,
    generateId,
} from './message-text.ts';
import { sendTelegramMessage } from './telegram-api.ts';
import { checkRateLimit, getUserBoundProfileId } from './user-access.ts';

import type { KvRecord } from '../../../../types/models.ts';
/**
 * 处理节点输入（核心逻辑）
 */
export async function handleNodeInput(
    chatId,
    text,
    userId,
    env,
    requestCache: KvRecord | null = null,
    options = {}
) {
    // 同一批导入的节点共用一个分组名（文件导入用文件名，文本导入用时间）
    const importGroupName =
        (options as Record<string, any>).groupName || buildImportGroupName(options);
    try {
        const cache = requestCache || createRequestCache();
        const config = await getTelegramPushConfig(env, cache);

        // 检查频率限制
        const rateLimitCheck = await checkRateLimit(userId, env, config);
        if (!rateLimitCheck.allowed) {
            await sendTelegramMessage(chatId, `❌ ${rateLimitCheck.reason}`, env);
            return createJsonResponse({ ok: true });
        }

        // 1. 尝试提取节点链接 (SS, VLESS 等)
        let nodeUrls = extractNodeUrls(text);
        let importType = 'node'; // node | subscription

        // 2. 提取订阅链接（支持一条消息里多行/多个订阅链接）
        const subscriptionUrls = extractSubscriptionUrls(text).filter(
            (url) => !nodeUrls.includes(url)
        );

        if (nodeUrls.length > 0 && subscriptionUrls.length > 0) {
            // 节点与订阅混发：订阅链接优先按订阅导入，节点单独导入
            importType = 'mixed';
        } else if (nodeUrls.length === 0 && subscriptionUrls.length > 0) {
            importType = 'subscription';
        }

        if (nodeUrls.length === 0 && subscriptionUrls.length === 0) {
            await sendTelegramMessage(
                chatId,
                '❌ <b>未识别到有效的链接</b>\n\n' +
                    '支持的内容：\n' +
                    '1. 节点链接 (SS, VMess, VLESS, Hysteria, etc.)\n' +
                    '2. 订阅链接 (HTTP/HTTPS) — <b>可一条消息发多个，每行一个</b>\n\n' +
                    '发送 /help 查看使用帮助',
                env
            );
            return createJsonResponse({ ok: true });
        }

        const storageAdapter = await getCachedStorageAdapter(env, cache);
        const allSubscriptions = await getCachedSubscriptions(env, cache);

        // 3. 批量处理与去重
        // 订阅链接与节点链接一并处理：订阅（http/https）存为订阅源，节点存为手动节点，
        // 前端通过 URL 协议区分。这样「一条消息发多个订阅链接」可一次全部导入。
        const allUrls =
            importType === 'subscription'
                ? [...subscriptionUrls]
                : [...subscriptionUrls, ...nodeUrls];
        const addedNodes: any[] = [];
        const ignoredUrls: any[] = [];

        for (const url of allUrls) {
            // 去重检测
            const exists = allSubscriptions.some((sub) => sub.url === url);
            if (exists) {
                ignoredUrls.push(url);
                continue;
            }

            const isSubscription = /^https?:\/\//i.test(url);
            const defaultName = isSubscription
                ? `订阅源 ${new URL(url).hostname}`
                : extractNodeName(url);

            const node = {
                id: generateId(),
                name: defaultName,
                url: url,
                enabled: true,
                source: 'telegram',
                // 同一批导入的节点归入同一分组，便于在网页端按组管理/加入订阅组
                group: importGroupName,
                telegram_user_id: userId,
                created_at: new Date().toISOString(),
            };

            // 注意：MiSub 中订阅源也通过 KV_KEY_SUBS 存储
            // 前端通过 URL 格式区分是“手动节点”还是“订阅源”
            // 订阅源 -> type: subscription or implied by http protocol

            allSubscriptions.unshift(node);
            addedNodes.push(node);
        }

        if (addedNodes.length === 0) {
            await sendTelegramMessage(
                chatId,
                `⚠️ <b>未添加任何节点</b>\n\n` +
                    `检测到 ${ignoredUrls.length} 个重复链接，已自动忽略。`,
                env
            );
            return createJsonResponse({ ok: true });
        }

        await storageAdapter.putAllSubscriptions(allSubscriptions);

        // [Verification] Read-Your-Writes Check
        try {
            const verifySubs = await storageAdapter.getAllSubscriptions();
            const isVerified = addedNodes.every((added) =>
                verifySubs.some((s) => s.id === added.id)
            );
            if (!isVerified) {
                console.warn('[Telegram Push] KV Verification failed');
                throw new Error('KV Write Verification Failed. Please try again.');
            }
        } catch (verifyError) {
            console.error('[Telegram Push] KV Verification error:', verifyError);
            if ((verifyError as Error).message.includes('Verification Failed')) throw verifyError;
        }

        // 4. 自动关联到订阅组 (分类处理)
        let boundProfileName = '';
        const boundProfileId = getUserBoundProfileId(config, userId);
        if (boundProfileId) {
            const profiles = await storageAdapter.getAllProfiles();
            const targetProfile = profiles.find((p) => p.id === boundProfileId);

            if (targetProfile) {
                // 分类 ID
                const subIds = addedNodes
                    .filter((n) => /^https?:\/\//i.test(n.url))
                    .map((n) => n.id);
                const nodeIds = addedNodes
                    .filter((n) => !/^https?:\/\//i.test(n.url))
                    .map((n) => n.id);

                let updated = false;

                if (nodeIds.length > 0) {
                    targetProfile.manualNodes = targetProfile.manualNodes || [];
                    targetProfile.manualNodes.push(...nodeIds);
                    updated = true;
                }

                if (subIds.length > 0) {
                    targetProfile.subscriptions = targetProfile.subscriptions || [];
                    targetProfile.subscriptions.push(...subIds);
                    updated = true;
                }

                if (updated) {
                    await storageAdapter.putAllProfiles(profiles);
                    boundProfileName = targetProfile.name;
                }
            }
        }

        // 5. 清除节点缓存，确保 Bot 新增/关联的节点能立即出现在实际订阅输出中
        try {
            const cacheResult = await clearAllNodeCaches(storageAdapter);
            console.info(
                `[Telegram Push] Cleared ${cacheResult?.cleared ?? 0} node caches after node import`
            );
        } catch (cacheError) {
            console.warn(
                '[Telegram Push] Failed to clear node caches after node import:',
                (cacheError as Error | undefined)?.message || cacheError
            );
        }

        // 6. 发送反馈消息
        let message;
        const totalIgnored = ignoredUrls.length;
        const ignoreMsg = totalIgnored > 0 ? `\n⚠️ 已跳过 ${totalIgnored} 个重复链接` : '';

        if (addedNodes.length === 1) {
            const node = addedNodes[0];
            const isSub = /^https?:\/\//i.test(node.url);
            const typeLabel = isSub ? '📡 订阅源' : '🚀 节点';

            message =
                `✅ <b>${typeLabel}添加成功！</b>\n\n` +
                `📋 信息：\n` +
                `• 名称: ${escapeHtml(node.name)}\n` +
                // 对于订阅源显示域名，对于节点显示协议
                `• 类型: ${isSub ? new URL(node.url).hostname : (node.url as Record<string, any>).split('://')[0].toUpperCase()}`;

            if (boundProfileName) {
                message += `\n• 已关联: ${escapeHtml(boundProfileName)}`;
            }
            message += ignoreMsg;
            message += `\n\n💡 发送 /list 查看列表`;
        } else {
            message = `✅ <b>成功添加 ${addedNodes.length} 个项目</b>${ignoreMsg}\n\n`;
            addedNodes.slice(0, 5).forEach((node, index) => {
                const isSub = /^https?:\/\//i.test(node.url);
                const label = isSub
                    ? '[订阅]'
                    : `[${(node.url as Record<string, any>).split('://')[0].toUpperCase()}]`;
                message += `${index + 1}. ${escapeHtml(node.name)} ${label}\n`;
            });
            if (addedNodes.length > 5) {
                message += `... 等 ${addedNodes.length} 个\n`;
            }
            if (boundProfileName) {
                message += `\n🔗 已关联到: ${escapeHtml(boundProfileName)}`;
            }
            message += `\n📋 发送 /list 查看完整列表`;
        }

        await sendTelegramMessage(chatId, message, env);
        console.info(
            `[Telegram Push] User ${userId} added ${addedNodes.length} items (Ignored ${totalIgnored})`
        );

        return createJsonResponse({ ok: true });
    } catch (error) {
        console.error('[Telegram Push] Node addition failed:', error);
        await sendTelegramMessage(
            chatId,
            `❌ <b>添加失败</b>\n\n错误: ${escapeHtml((error as Error).message)}`,
            env
        );
        return createJsonResponse({ ok: true });
    }
}
