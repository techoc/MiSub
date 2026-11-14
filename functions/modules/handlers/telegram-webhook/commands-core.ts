/**
 * 基础命令：/start /help /menu /list /listTypeSelector /stats
 * 从 telegram-webhook-handler.js 拆分而来；路由见 ./dispatch.js。
 */

import { escapeHtml } from '../../utils.ts';
import { createRequestCache, getCachedProfiles, getCachedSettings } from './cache.ts';
import { editTelegramMessage, sendTelegramMessage } from './telegram-api.ts';
import { getUserBoundProfileId, getUserNodes } from './user-access.ts';

// ==================== 命令处理器 ====================

/**
 * 处理 /start 命令
 */
export async function handleStartCommand(chatId, env) {
    const message =
        '👋 <b>欢迎使用 MiSub Telegram Bot！</b>\n\n' +
        '通过这个 Bot，你可以：\n' +
        '• 📤 快速添加代理节点\n' +
        '• 📋 管理你的节点列表\n' +
        '• 🔗 获取订阅链接\n\n' +
        '直接发送节点链接即可添加，支持批量添加。\n\n' +
        '发送 /help 查看完整命令列表\n' +
        '发送 /menu 打开快捷菜单';

    await sendTelegramMessage(chatId, message, env);
}

/**
 * 处理 /help 命令
 */
export async function handleHelpCommand(chatId, env) {
    const message =
        '📖 <b>MiSub Bot 命令帮助</b>\n\n' +
        '<b>📤 添加节点</b>\n' +
        '直接发送节点链接（支持批量）\n\n' +
        '<b>📋 查看</b>\n' +
        '/list - 选择节点列表 / 机场列表\n' +
        '/stats - 统计信息\n' +
        '/info [序号] - 节点详情\n' +
        '/search [词] - 搜索节点\n\n' +
        '<b>✏️ 编辑</b>\n' +
        '/enable [序号] - 启用\n' +
        '/disable [序号] - 禁用\n' +
        '/rename [序号] [名] - 重命名\n' +
        '/delete [序号] - 删除\n\n' +
        '<b>🔧 工具</b>\n' +
        '/groups [node|sub] - 分组管理\n' +
        '/grename [旧组] [新组] - 重命名分组\n' +
        '/bind - 绑定订阅组\n' +
        '/sort [类型] - 排序\n' +
        '/dup - 去重\n' +
        '/copy [序号] - 复制链接\n' +
        '/menu - 快捷菜单\n\n' +
        '💡 序号支持：1 | 1,3,5 | all';

    await sendTelegramMessage(chatId, message, env);
}

/**
 * 处理 /menu 命令 - 快捷菜单
 */
export async function handleMenuCommand(chatId, env, messageId: KvRecord | null = null, requestCache: KvRecord | null = null) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '\uD83D\uDE80 节点列表', callback_data: 'cmd_list_node' }, // 🚀
                { text: '\uD83D\uDCE1 机场列表', callback_data: 'cmd_list_sub' }, // 📡
                { text: '\uD83D\uDCCA 统计', callback_data: 'cmd_stats' }, // 📊
            ],
            [
                { text: '\uD83D\uDCC1 分组管理', callback_data: 'gmls_node' }, // 📁
                { text: '\uD83D\uDD17 绑定', callback_data: 'cmd_bind' }, // 🔗
                { text: '\uD83D\uDD0D 搜索', callback_data: 'prompt_search' }, // 🔍
            ],
            [{ text: '\u2753 帮助', callback_data: 'cmd_help' }], // ❓
            [
                { text: '\u2705 全启用', callback_data: 'cmd_enable_all' }, // ✅
                { text: '\u26D4 全禁用', callback_data: 'cmd_disable_all' }, // ⛔
            ],
            [
                { text: '\uD83D\uDDD1\uFE0F 清空', callback_data: 'confirm_delete_all' }, // 🗑️
            ],
        ],
    };

    if (messageId) {
        await editTelegramMessage(chatId, messageId, '📱 <b>快捷菜单</b>', env, {
            requestCache,
            reply_markup: keyboard,
        });
    } else {
        await sendTelegramMessage(chatId, '📱 <b>快捷菜单</b>', env, {
            requestCache,
            reply_markup: keyboard,
        });
    }
}

/**
 * 处理 /list 命令 - 节点列表（带分页和操作按钮）
 */
export async function handleListCommand(
    chatId,
    userId,
    env,
    page = 0,
    type = 'all',
    messageId: KvRecord | null = null,
    requestCache: KvRecord | null = null,
    groupFilter = null
) {
    try {
        const cache = requestCache || createRequestCache();
        const allNodes = await getUserNodes(userId, env);
        const profiles = await getCachedProfiles(env, cache);
        const settings = await getCachedSettings(env, cache);
        const config = settings.telegram_push_config || {};

        // 过滤节点
        let userNodes = allNodes;
        let title = '列表';
        if (type === 'node') {
            userNodes = allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));
            title = '\uD83D\uDE80 节点列表'; // 🚀
        } else if (type === 'sub') {
            userNodes = allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''));
            title = '\uD83D\uDCE1 机场列表'; // 📡
        }

        // 按分组过滤（null = 不过滤，'__none__' = 仅未分组）
        if (groupFilter === '__none__') {
            userNodes = userNodes.filter((n) => !(n.group || '').trim());
            title += ' · 未分组';
        } else if (groupFilter) {
            userNodes = userNodes.filter((n) => (n.group || '').trim() === groupFilter);
            title += ` · ${groupFilter}`;
        }

        // 获取当前绑定的订阅组
        const boundProfileId = getUserBoundProfileId(config, userId);
        const boundProfile = boundProfileId ? profiles.find((p) => p.id === boundProfileId) : null;
        const boundNodeIds = new Set(boundProfile?.manualNodes || []);

        if (userNodes.length === 0) {
            let emptyMsg = `\uD83D\uDCCB <b>暂无${type === 'sub' ? '机场订阅' : type === 'node' ? '节点' : '资源'}</b>\n\n`; // 📋
            if (type === 'sub') emptyMsg += '发送包含 http/https 的链接即可添加机场订阅';
            else emptyMsg += '直接发送 ss/vless 等链接即可添加节点';

            if (messageId) {
                // Add back button even for empty list
                const keyboard = {
                    inline_keyboard: [[{ text: '🔙 返回菜单', callback_data: 'cmd_menu' }]],
                };
                await editTelegramMessage(chatId, messageId, emptyMsg, env, {
                    reply_markup: keyboard,
                });
            } else {
                await sendTelegramMessage(chatId, emptyMsg, env);
            }
            return;
        }

        const pageSize = 6; // 减少每页数量以容纳更多信息
        const totalPages = Math.ceil(userNodes.length / pageSize);
        const currentPage = Math.min(Math.max(0, page), totalPages - 1);
        const startIdx = currentPage * pageSize;
        const endIdx = Math.min(startIdx + pageSize, userNodes.length);

        let message = `\uD83D\uDCCB <b>${title}</b> (${userNodes.length} 个)\n`; // 📋
        message += `第 ${currentPage + 1}/${totalPages} 页`;
        if (boundProfile) {
            message += ` | 绑定: ${escapeHtml(boundProfile.name)}`;
        }
        message += '\n\n';

        for (let i = startIdx; i < endIdx; i++) {
            const node = userNodes[i];
            const nodeUrl = node.url || '';
            const isSub = /^https?:\/\//i.test(nodeUrl);

            let protocol = '未知';
            if (isSub) {
                protocol = '订阅';
            } else if (nodeUrl.includes('://')) {
                try {
                    protocol = nodeUrl.split('://')[0].toUpperCase();
                } catch (e) {
                    protocol = 'UNKNOWN';
                }
            }

            const status = node.enabled ? '\u2705' : '\u26D4'; // ✅ ⛔
            const inProfile = boundNodeIds.has(node.id) ? '\uD83D\uDD17' : ''; // 🔗
            const typeIcon = isSub ? '\uD83D\uDCE1 ' : '\uD83D\uDE80 '; // 📡 🚀

            message += `<b>${i + 1}.</b> ${status}${inProfile} ${typeIcon}${escapeHtml(node.name || '未命名')} <code>${protocol}</code>\n`;
        }

        message += '\n点击序号查看详情和操作';

        // 构建按钮：当前页节点的快捷按钮
        const nodeButtons = [];
        for (let i = startIdx; i < endIdx; i++) {
            const isSubList = type === 'sub';
            // 如果是混合列表('all'), 检测URL; 如果明确是 'sub', 则就是sub.
            // 但 handleListCommand 的 type 参数已经区分了 'node', 'sub', 'all'.
            // 这里我们尽量明确:
            const actionPrefix =
                type === 'sub' || (type === 'all' && /^https?:\/\//i.test(userNodes[i].url || ''))
                    ? 'node_action_sub_'
                    : 'node_action_node_';

            nodeButtons.push({
                text: `${i + 1}`,
                callback_data: `${actionPrefix}${i}`,
            });
        }

        // 分页按钮
        const navButtons = [];
        const typePrefix = type !== 'all' ? `${type}_` : '';

        if (currentPage > 0) {
            navButtons.push({
                text: '\u2B05\uFE0F',
                callback_data: `list_page_${typePrefix}${currentPage - 1}`,
            }); // ⬅️
        }

        // Add Back button in the middle or separate row?
        // Let's put pagination < > on one row, and Back on another or same?
        // Standard: <  Page  >
        // Row 2: Back

        navButtons.push({ text: `${currentPage + 1}/${totalPages}`, callback_data: 'noop' });

        if (currentPage < totalPages - 1) {
            navButtons.push({
                text: '\u27A1\uFE0F',
                callback_data: `list_page_${typePrefix}${currentPage + 1}`,
            }); // ➡️
        }

        const backButtonRow = [
            { text: '🔙 返回分组', callback_data: `cmd_list_${type === 'sub' ? 'sub' : 'node'}` },
            { text: '🏠 菜单', callback_data: 'cmd_menu' },
        ];

        const keyboard = {
            inline_keyboard: [nodeButtons, navButtons, backButtonRow],
        };

        if (messageId) {
            await editTelegramMessage(chatId, messageId, message, env, { reply_markup: keyboard });
        } else {
            await sendTelegramMessage(chatId, message, env, { reply_markup: keyboard });
        }
    } catch (error) {
        console.error('[Telegram Push] List command failed:', error);
        await sendTelegramMessage(chatId, `\u274C 获取列表失败: ${error.message}`, env); // ❌
    }
}

export async function handleListTypeSelector(chatId, env, messageId: KvRecord | null = null, requestCache: KvRecord | null = null) {
    const message =
        '📋 <b>请选择列表类型</b>\n\n' +
        '🚀 节点列表：手动添加的代理节点\n' +
        '📡 机场列表：HTTP/HTTPS 机场订阅源\n\n' +
        '节点和机场订阅分开管理，避免序号混淆。';
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🚀 节点列表', callback_data: 'cmd_list_node' },
                { text: '📡 机场列表', callback_data: 'cmd_list_sub' },
            ],
            [{ text: '🔙 返回菜单', callback_data: 'cmd_menu' }],
        ],
    };

    if (messageId) {
        await editTelegramMessage(chatId, messageId, message, env, {
            requestCache,
            reply_markup: keyboard,
        });
    } else {
        await sendTelegramMessage(chatId, message, env, { requestCache, reply_markup: keyboard });
    }
}

/**
 * 处理 /stats 命令
 */
export async function handleStatsCommand(chatId, userId, env, requestCache: KvRecord | null = null) {
    try {
        const userNodes = await getUserNodes(userId, env);

        let subCount = 0;
        let nodeCount = 0;
        let enabledCount = 0;
        const protocolCounts = {};

        userNodes.forEach((node) => {
            const isSub = /^https?:\/\//i.test(node.url);

            if (isSub) {
                subCount++;
            } else {
                nodeCount++;
                const protocol = node.url.split('://')[0].toUpperCase();
                protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
            }

            if (node.enabled) enabledCount++;
        });

        const disabledCount = userNodes.length - enabledCount;

        let message = `\uD83D\uDCCA <b>统计信息</b>\n\n`; // 📊
        message += `资源总数: <b>${userNodes.length}</b>\n`;
        message += `├─ 订阅源: <b>${subCount}</b>\n`;
        message += `└─ 手动节点: <b>${nodeCount}</b>\n\n`;

        message += `状态:\n`;
        message += `\u2705 已启用: <b>${enabledCount}</b>\n`; // ✅
        message += `\u26D4 已禁用: <b>${disabledCount}</b>\n\n`; // ⛔

        if (Object.keys(protocolCounts).length > 0) {
            message += `<b>节点协议分布：</b>\n`;
            Object.entries(protocolCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([protocol, count]) => {
                    message += `• ${protocol}: ${count}\n`;
                });
        }

        await sendTelegramMessage(chatId, message, env, { requestCache });
    } catch (error) {
        console.error('[Telegram Push] Stats command failed:', error);
        await sendTelegramMessage(chatId, `\u274C 获取统计失败: ${error.message}`, env, {
            requestCache,
        }); // ❌
    }
}
