/**
 * 数据管理命令：/import /sort /dup /bind /unbind
 * 从 telegram-webhook-handler.js 拆分而来；路由见 ./dispatch.js。
 */

import { KV_KEY_SUBS } from '../../config.ts';
import { escapeHtml } from '../../utils.ts';
import {
    createRequestCache,
    getCachedProfiles,
    getCachedSettings,
    getStorageAdapter,
    persistCachedSettings,
} from './cache.ts';
import { extractNodeName, extractNodeUrls, generateId } from './message-text.ts';
import { sendTelegramMessage } from './telegram-api.ts';
import {
    getNodesWithMapping,
    getUserBoundProfileId,
    setUserBoundProfileId,
} from './user-access.ts';

import type { KvRecord } from '../../../../types/models.ts';
/**
 * 处理 /import 命令 - 导入节点
 */
export async function handleImportCommand(chatId, userId, args, env) {
    try {
        if (args.length === 0) {
            await sendTelegramMessage(
                chatId,
                '📥 <b>导入节点</b>\n\n' +
                    '用法：/import <Base64 或订阅链接>\n\n' +
                    '支持：\n' +
                    '• Base64 编码的节点\n' +
                    '• 订阅链接（http/https）\n\n' +
                    '示例：\n' +
                    '/import c3M6Ly9...\n' +
                    '/import https://example.com/sub',
                env
            );
            return;
        }

        const input = args.join(' ').trim();
        let nodeUrls: any[] = [];

        // 判断是订阅链接还是 Base64
        if (input.startsWith('http://') || input.startsWith('https://')) {
            // 获取订阅内容
            await sendTelegramMessage(chatId, '⏳ 正在获取订阅内容...', env);

            try {
                const response = await fetch(input, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'v2rayN/7.23',
                        Accept: '*/*',
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const content = await response.text();

                // 尝试 Base64 解码
                try {
                    const decoded = decodeURIComponent(escape(atob(content.trim())));
                    nodeUrls = extractNodeUrls(decoded);
                } catch {
                    // 直接尝试提取
                    nodeUrls = extractNodeUrls(content);
                }
            } catch (fetchError) {
                await sendTelegramMessage(
                    chatId,
                    `❌ 获取订阅失败: ${(fetchError as Error).message}`,
                    env
                );
                return;
            }
        } else {
            // 尝试 Base64 解码
            try {
                const decoded = decodeURIComponent(escape(atob(input)));
                nodeUrls = extractNodeUrls(decoded);
            } catch {
                // 直接尝试提取
                nodeUrls = extractNodeUrls(input);
            }
        }

        if (nodeUrls.length === 0) {
            await sendTelegramMessage(chatId, '❌ 未识别到有效的节点链接', env);
            return;
        }

        // 添加节点
        const storageAdapter = await getStorageAdapter(env);
        const allSubscriptions = await storageAdapter.getAllSubscriptions();

        const addedNodes: any[] = [];
        for (const url of nodeUrls) {
            const node = {
                id: generateId(),
                name: extractNodeName(url),
                url: url,
                enabled: true,
                source: 'telegram',
                telegram_user_id: userId,
                created_at: new Date().toISOString(),
            };
            allSubscriptions.unshift(node);
            addedNodes.push(node);
        }

        await storageAdapter.put(KV_KEY_SUBS, allSubscriptions);

        await sendTelegramMessage(
            chatId,
            `✅ <b>导入成功</b>\n\n成功导入 ${addedNodes.length} 个节点\n\n发送 /list 查看列表`,
            env
        );

        console.info(`[Telegram Push] User ${userId} imported ${addedNodes.length} nodes`);
    } catch (error) {
        console.error('[Telegram Push] Import command failed:', error);
        await sendTelegramMessage(
            chatId,
            `❌ 导入失败: ${escapeHtml((error as Error).message)}`,
            env
        );
    }
}

/**
 * 处理 /sort 命令 - 节点排序
 */
export async function handleSortCommand(chatId, userId, args, env) {
    try {
        const sortType = args[0]?.toLowerCase() || '';

        if (!sortType || !['name', 'protocol', 'time', 'status'].includes(sortType)) {
            await sendTelegramMessage(
                chatId,
                '🔄 <b>节点排序</b>\n\n' +
                    '用法：/sort <类型>\n\n' +
                    '类型：\n' +
                    '• name - 按名称排序\n' +
                    '• protocol - 按协议排序\n' +
                    '• time - 按时间排序\n' +
                    '• status - 按状态排序',
                env
            );
            return;
        }

        const { allSubscriptions, userNodes, indexMapping, storageAdapter } =
            await getNodesWithMapping(userId, env);

        if (userNodes.length === 0) {
            await sendTelegramMessage(chatId, '📋 暂无可排序的节点', env);
            return;
        }

        // 创建排序映射
        const sortedIndices = [...Array(userNodes.length).keys()];

        switch (sortType) {
            case 'name':
                sortedIndices.sort((a, b) =>
                    (userNodes[a].name as Record<string, any>).localeCompare(
                        userNodes[b].name,
                        'zh-CN'
                    )
                );
                break;
            case 'protocol':
                sortedIndices.sort((a, b) => {
                    const pa = (userNodes[a].url as Record<string, any>).split('://')[0];
                    const pb = (userNodes[b].url as Record<string, any>).split('://')[0];
                    return pa.localeCompare(pb);
                });
                break;
            case 'time':
                sortedIndices.sort((a, b) => {
                    const ta = new Date(userNodes[a].created_at || 0).getTime();
                    const tb = new Date(userNodes[b].created_at || 0).getTime();
                    return tb - ta; // 新的在前
                });
                break;
            case 'status':
                sortedIndices.sort((a, b) => {
                    return (userNodes[b].enabled ? 1 : 0) - (userNodes[a].enabled ? 1 : 0);
                });
                break;
        }

        // 重新排列节点
        const sortedNodes = sortedIndices.map((i) => userNodes[i]);

        // 从 allSubscriptions 中移除用户节点
        const indicesToRemove = [...indexMapping].sort((a, b) => b - a);
        for (const idx of indicesToRemove) {
            allSubscriptions.splice(idx, 1);
        }

        // 将排序后的节点添加回去
        allSubscriptions.unshift(...sortedNodes);

        await storageAdapter.putAllSubscriptions(allSubscriptions);

        const sortNames = { name: '名称', protocol: '协议', time: '时间', status: '状态' };
        await sendTelegramMessage(
            chatId,
            `✅ <b>排序完成</b>\n\n已按${sortNames[sortType]}排序 ${userNodes.length} 个节点`,
            env
        );
    } catch (error) {
        console.error('[Telegram Push] Sort command failed:', error);
        await sendTelegramMessage(
            chatId,
            `❌ 排序失败: ${escapeHtml((error as Error).message)}`,
            env
        );
    }
}

/**
 * 处理 /dup 命令 - 去重检测
 */
export async function handleDupCommand(chatId, userId, args, env) {
    try {
        const action = args[0]?.toLowerCase() || '';

        const { allSubscriptions, userNodes, indexMapping, storageAdapter } =
            await getNodesWithMapping(userId, env);

        if (userNodes.length === 0) {
            await sendTelegramMessage(chatId, '📋 暂无节点', env);
            return;
        }

        // 检测重复（基于 URL）
        const urlMap = new Map();
        const duplicates: any[] = [];

        userNodes.forEach((node, idx) => {
            const url = node.url;
            if (urlMap.has(url)) {
                duplicates.push({ idx, node, originalIdx: urlMap.get(url) });
            } else {
                urlMap.set(url, idx);
            }
        });

        if (duplicates.length === 0) {
            await sendTelegramMessage(
                chatId,
                '✅ <b>未发现重复节点</b>\n\n所有节点链接都是唯一的',
                env
            );
            return;
        }

        if (action === 'clean' || action === 'remove') {
            // 自动清理重复
            const indicesToDelete = duplicates
                .map((d) => indexMapping[d.idx])
                .sort((a, b) => b - a);

            for (const idx of indicesToDelete) {
                allSubscriptions.splice(idx, 1);
            }

            await storageAdapter.putAllSubscriptions(allSubscriptions);

            await sendTelegramMessage(
                chatId,
                `✅ <b>去重完成</b>\n\n已删除 ${duplicates.length} 个重复节点`,
                env
            );
        } else {
            // 显示重复信息
            let message = `🔍 <b>发现 ${duplicates.length} 个重复节点</b>\n\n`;

            duplicates.slice(0, 5).forEach(({ idx, node, originalIdx }) => {
                message += `• #${idx + 1} 与 #${originalIdx + 1} 重复\n`;
                message += `  ${node.name}\n`;
            });

            if (duplicates.length > 5) {
                message += `\n... 还有 ${duplicates.length - 5} 个重复`;
            }

            message += '\n\n发送 /dup clean 自动清理重复';

            const keyboard = {
                inline_keyboard: [[{ text: '🗑️ 清理重复节点', callback_data: 'cmd_dup_clean' }]],
            };

            await sendTelegramMessage(chatId, message, env, { reply_markup: keyboard });
        }
    } catch (error) {
        console.error('[Telegram Push] Dup command failed:', error);
        await sendTelegramMessage(
            chatId,
            `❌ 去重检测失败: ${escapeHtml((error as Error).message)}`,
            env
        );
    }
}

/**
 * 处理 /bind 命令 - 绑定默认订阅组
 */
export async function handleBindCommand(
    chatId,
    userId,
    args,
    env,
    requestCache: KvRecord | null = null
) {
    try {
        const cache = requestCache || createRequestCache();
        const profiles = await getCachedProfiles(env, cache);
        const settings = await getCachedSettings(env, cache);
        const config = settings.telegram_push_config || {};

        // 没有参数时列出订阅组
        if (args.length === 0) {
            if (profiles.length === 0) {
                await sendTelegramMessage(chatId, '📋 暂无订阅组\n\n请在 Web 界面创建', env, {
                    requestCache,
                });
                return;
            }

            let message = '🔗 <b>绑定订阅组</b>\n\n';
            message += '当前绑定: ';

            const currentProfileId = getUserBoundProfileId(config, userId);
            if (currentProfileId) {
                const current = profiles.find((p) => p.id === currentProfileId);
                message += current ? `<b>${current.name}</b>` : '(已失效)';
            } else {
                message += '无';
            }

            message += '\n\n可用订阅组:\n';
            profiles.forEach((p, i) => {
                const isCurrent = p.id === currentProfileId;
                message += `${isCurrent ? '✅' : ''} ${i + 1}. ${p.name}\n`;
            });
            message += '\n用法: /bind [序号]';

            // 生成快捷按钮
            const buttons = profiles.slice(0, 6).map((p, i) => ({
                text: `${i + 1}. ${p.name.substring(0, 8)}`,
                callback_data: `bind_profile_${p.id}`,
            }));

            const keyboard = {
                inline_keyboard: [
                    buttons.slice(0, 3),
                    buttons.slice(3, 6),
                    [{ text: '❌ 解除绑定', callback_data: 'unbind_profile' }],
                ].filter((row) => row.length > 0),
            };

            await sendTelegramMessage(chatId, message, env, {
                reply_markup: keyboard,
                requestCache,
            });
            return;
        }

        // 绑定指定订阅组
        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= profiles.length) {
            await sendTelegramMessage(chatId, '❌ 无效的序号', env, { requestCache });
            return;
        }

        const targetProfile = profiles[idx];

        // 更新配置
        setUserBoundProfileId(config, userId, targetProfile.id);
        config.auto_bind = true;
        settings.telegram_push_config = config;
        cache.settings = settings;
        await persistCachedSettings(env, cache);

        await sendTelegramMessage(
            chatId,
            `✅ <b>绑定成功</b>\n\n` +
                `已绑定到: <b>${targetProfile.name}</b>\n\n` +
                `之后添加的节点将自动关联到此订阅组`,
            env,
            { requestCache }
        );
    } catch (error) {
        console.error('[Telegram Push] Bind command failed:', error);
        await sendTelegramMessage(
            chatId,
            `❌ 绑定失败: ${escapeHtml((error as Error).message)}`,
            env,
            {
                requestCache,
            }
        );
    }
}

/**
 * 处理 /unbind 命令 - 解除绑定
 */
export async function handleUnbindCommand(
    chatId,
    userId,
    env,
    requestCache: KvRecord | null = null
) {
    try {
        const cache = requestCache || createRequestCache();
        const settings = await getCachedSettings(env, cache);
        const config = settings.telegram_push_config || {};

        if (!getUserBoundProfileId(config, userId)) {
            await sendTelegramMessage(chatId, '馃搵 褰撳墠鏈粦瀹氫换浣曡闃呯粍', env);
            return;
        }

        setUserBoundProfileId(config, userId, '');
        settings.telegram_push_config = config;
        cache.settings = settings;
        await persistCachedSettings(env, cache);

        await sendTelegramMessage(
            chatId,
            '✅ <b>解除绑定成功</b>\n\n' + '之后添加的节点将不再自动关联订阅组',
            env
        );
    } catch (error) {
        console.error('[Telegram Push] Unbind command failed:', error);
        await sendTelegramMessage(
            chatId,
            `❌ 解除绑定失败: ${escapeHtml((error as Error).message)}`,
            env
        );
    }
}
