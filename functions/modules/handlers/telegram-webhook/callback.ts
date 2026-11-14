/**
 * Callback Query 处理：所有内联按钮回调
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { KV_KEY_SETTINGS, KV_KEY_SUBS } from '../../config.ts';
import { createJsonResponse, escapeHtml } from '../../utils.ts';
import {
    createRequestCache,
    getCachedProfiles,
    getCachedSettings,
    getStorageAdapter,
    persistCachedSettings,
} from './cache.ts';
import {
    applyGroupOperation,
    handleGroupActions,
    handleGroupManage,
    handleGroupSelect,
} from './group-manage.ts';
import { answerCallbackQuery, editTelegramMessage, sendTelegramMessage } from './telegram-api.ts';
import { getUserBoundProfileId, getUserNodes, setUserBoundProfileId } from './user-access.ts';
import {
    handleHelpCommand,
    handleListCommand,
    handleMenuCommand,
    handleStatsCommand,
} from './commands-core.ts';
import {
    handleCopyCommand,
    handleDeleteCommand,
    handleDisableCommand,
    handleEnableCommand,
    handleExportCommand,
    handleRenameCommand,
    handleSubCommandSimple,
} from './commands-node.ts';
import { handleBindCommand, handleDupCommand } from './commands-data.ts';

import type { KvRecord } from '../../../../types/models.ts';
// ==================== Callback Query 处理 ====================

/**
 * 处理 Callback Query（按钮回调）
 */
export async function handleCallbackQuery(callbackQuery, env, request, requestCache: KvRecord | null = null) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    try {
        // 分组管理：gmgr_<type>_<name> 打开某组操作面板
        if (data.startsWith('gmgr_')) {
            const rest = data.slice(5);
            const sep = rest.indexOf('_');
            const type = rest.slice(0, sep);
            let name = rest.slice(sep + 1);
            try {
                name = decodeURIComponent(name);
            } catch {
                /* 保持原样 */
            }
            await answerCallbackQuery(callbackQuery.id, '', env);
            await handleGroupActions(chatId, userId, env, messageId, type, name, requestCache);
            return createJsonResponse({ ok: true });
        }

        // 返回分组管理列表：gmls_<type>
        if (data.startsWith('gmls_')) {
            const type = data.slice(5);
            await answerCallbackQuery(callbackQuery.id, '', env);
            await handleGroupManage(chatId, userId, env, messageId, type, requestCache);
            return createJsonResponse({ ok: true });
        }

        // 重命名分组：gmrn_<type>_<name> -> 提示用命令完成
        if (data.startsWith('gmrn_')) {
            const rest = data.slice(5);
            const sep = rest.indexOf('_');
            const type = rest.slice(0, sep);
            let name = rest.slice(sep + 1);
            try {
                name = decodeURIComponent(name);
            } catch {
                /* 保持原样 */
            }
            await answerCallbackQuery(callbackQuery.id, '', env);
            await editTelegramMessage(
                chatId,
                messageId,
                `✏️ <b>重命名分组</b>\n\n` +
                    `当前名称：<code>${escapeHtml(name)}</code>\n\n` +
                    `请发送命令完成重命名：\n` +
                    `<code>/grename ${escapeHtml(name)} 新名称</code>`,
                env,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: '🔙 返回',
                                    callback_data: `gmgr_${type}_${encodeURIComponent(name).slice(0, 40)}`,
                                },
                            ],
                        ],
                    },
                    requestCache,
                }
            );
            return createJsonResponse({ ok: true });
        }

        // 清空分组：gmcl_<type>_<name>
        if (data.startsWith('gmcl_')) {
            const rest = data.slice(5);
            const sep = rest.indexOf('_');
            const type = rest.slice(0, sep);
            let name = rest.slice(sep + 1);
            try {
                name = decodeURIComponent(name);
            } catch {
                /* 保持原样 */
            }
            const n = await applyGroupOperation(
                chatId,
                userId,
                env,
                type,
                name,
                'clear',
                null,
                requestCache
            );
            await answerCallbackQuery(callbackQuery.id, `已清空 ${n} 项的分组`, env);
            await handleGroupManage(chatId, userId, env, messageId, type, requestCache);
            return createJsonResponse({ ok: true });
        }

        // 删除分组：gmrm_<type>_<name>
        if (data.startsWith('gmrm_')) {
            const rest = data.slice(5);
            const sep = rest.indexOf('_');
            const type = rest.slice(0, sep);
            let name = rest.slice(sep + 1);
            try {
                name = decodeURIComponent(name);
            } catch {
                /* 保持原样 */
            }
            const n = await applyGroupOperation(
                chatId,
                userId,
                env,
                type,
                name,
                'delete',
                null,
                requestCache
            );
            await answerCallbackQuery(callbackQuery.id, `已删除分组及 ${n} 项`, env);
            await handleGroupManage(chatId, userId, env, messageId, type, requestCache);
            return createJsonResponse({ ok: true });
        }

        // 分组选择：grp_<type>_<encodedGroupName>
        if (data.startsWith('grp_')) {
            const rest = data.slice(4);
            const sep = rest.indexOf('_');
            const type = rest.slice(0, sep);
            const raw = rest.slice(sep + 1);
            let groupFilter: any = null;
            if (raw === '__all__') groupFilter = null;
            else if (raw === '__none__') groupFilter = '__none__';
            else {
                try {
                    groupFilter = decodeURIComponent(raw);
                } catch {
                    groupFilter = raw;
                }
            }

            await answerCallbackQuery(callbackQuery.id, '', env);
            await handleListCommand(
                chatId,
                userId,
                env,
                0,
                type,
                messageId,
                requestCache,
                groupFilter
            );
            return createJsonResponse({ ok: true });
        }

        // 分页命令
        // 分页命令 (格式: list_page_type_page 或 list_page_page 兼容旧版)
        if (data.startsWith('list_page_')) {
            const parts = data.replace('list_page_', '').split('_');
            let type = 'all';
            let page = 0;

            if (parts.length === 2 && isNaN(parseInt(parts[0]))) {
                type = parts[0];
                page = parseInt(parts[1]);
            } else {
                page = parseInt(parts[0]);
            }

            await answerCallbackQuery(callbackQuery.id, '', env);
            await handleListCommand(chatId, userId, env, page, type, messageId, requestCache);
            return createJsonResponse({ ok: true });
        }

        // 快捷菜单命令
        switch (data) {
            case 'cmd_menu':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleMenuCommand(chatId, env, messageId, requestCache);
                break;

            case 'cmd_list_node':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleGroupSelect(chatId, userId, env, messageId, 'node', requestCache);
                break;

            case 'cmd_list_sub':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleGroupSelect(chatId, userId, env, messageId, 'sub', requestCache);
                break;

            case 'cmd_stats':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleStatsCommand(chatId, userId, env, requestCache);
                break;
            case 'cmd_sub':
                await answerCallbackQuery(callbackQuery.id, '', env);
                // 获取订阅 - 不需要 request，直接列出订阅组
                await handleSubCommandSimple(chatId, env, requestCache);
                break;

            case 'cmd_help':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleHelpCommand(chatId, env);
                break;

            case 'cmd_export':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleExportCommand(chatId, userId, [], env);
                break;

            case 'cmd_dup':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleDupCommand(chatId, userId, [], env);
                break;

            case 'cmd_bind':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await handleBindCommand(chatId, userId, [], env, requestCache);
                break;

            case 'prompt_import':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await sendTelegramMessage(
                    chatId,
                    '📥 <b>导入节点</b>\n\n请发送：\n/import <订阅链接>\n或\n/import <Base64>',
                    env
                );
                break;

            case 'prompt_sort':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await sendTelegramMessage(
                    chatId,
                    '🔄 <b>排序节点</b>\n\n/sort name - 按名称\n/sort protocol - 按协议\n/sort time - 按时间\n/sort status - 按状态',
                    env
                );
                break;

            case 'cmd_enable_all':
                await answerCallbackQuery(callbackQuery.id, '启用中...', env);
                await handleEnableCommand(chatId, userId, ['all'], env);
                break;

            case 'cmd_disable_all':
                await answerCallbackQuery(callbackQuery.id, '禁用中...', env);
                await handleDisableCommand(chatId, userId, ['all'], env);
                break;

            case 'confirm_delete_all': {
                const confirmKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '⚠️ 确认删除', callback_data: 'do_delete_all' },
                            { text: '❌ 取消', callback_data: 'cancel_action' },
                        ],
                    ],
                };
                await answerCallbackQuery(callbackQuery.id, '', env);
                await editTelegramMessage(chatId, messageId, '⚠️ <b>确认删除全部？</b>', env, {
                    reply_markup: confirmKeyboard,
                });
                break;
            }

            case 'do_delete_all':
                await answerCallbackQuery(callbackQuery.id, '删除中...', env);
                await handleDeleteCommand(chatId, userId, ['all'], env);
                break;

            case 'cancel_action':
                await answerCallbackQuery(callbackQuery.id, '已取消', env);
                await editTelegramMessage(chatId, messageId, '❌ 已取消', env);
                break;

            case 'prompt_search':
                await answerCallbackQuery(callbackQuery.id, '', env);
                await sendTelegramMessage(
                    chatId,
                    '🔍 <b>搜索节点</b>\n\n请发送：/search <关键词>\n例：/search 香港',
                    env
                );
                break;

            case 'cmd_dup_clean':
                await answerCallbackQuery(callbackQuery.id, '清理中...', env);
                await handleDupCommand(chatId, userId, ['clean'], env);
                break;

            default:
                // 处理动态回调
                // 处理动态回调
                if (data.startsWith('node_action_')) {
                    // 节点/订阅 详情展示
                    // 格式: node_action_node_{idx} 或 node_action_sub_{idx}
                    // 兼容旧格式: node_action_{idx} (默认为node)

                    let type = 'node';
                    let idxStr = '';
                    if (data.startsWith('node_action_node_')) {
                        type = 'node';
                        idxStr = data.replace('node_action_node_', '');
                    } else if (data.startsWith('node_action_sub_')) {
                        type = 'sub';
                        idxStr = data.replace('node_action_sub_', '');
                    } else {
                        idxStr = data.replace('node_action_', '');
                    }

                    const idx = parseInt(idxStr);
                    const storageAdapter = await getStorageAdapter(env);

                    // 获取对应列表
                    // 获取对应列表
                    let fullList = await getUserNodes(userId, env);
                    let targetList: any[] = [];

                    if (type === 'sub') {
                        // Must match handleListCommand's filtering logic for 'sub'
                        targetList = fullList.filter((n) => /^https?:\/\//i.test(n.url || ''));
                    } else {
                        // Must match handleListCommand's filtering logic for 'node'
                        targetList = fullList.filter((n) => !/^https?:\/\//i.test(n.url || ''));
                    }

                    let actionIdx = idx;
                    if ((idx < 0 || idx >= targetList.length) && fullList[idx]) {
                        const fallbackItem = fullList[idx];
                        const fallbackIsSub = /^https?:\/\//i.test(fallbackItem.url || '');
                        if (
                            (type === 'sub' && fallbackIsSub) ||
                            (type === 'node' && !fallbackIsSub)
                        ) {
                            actionIdx = targetList.findIndex((item) =>
                                fallbackItem.id
                                    ? item.id === fallbackItem.id
                                    : item === fallbackItem || item.url === fallbackItem.url
                            );
                            targetList = fullList;
                        }
                    }

                    const profiles = await storageAdapter.getAllProfiles();
                    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
                    const config = settings.telegram_push_config || {};

                    if (idx < 0 || idx >= targetList.length) {
                        await answerCallbackQuery(callbackQuery.id, '对象不存在', env, true);
                        return createJsonResponse({ ok: true });
                    }

                    const node = targetList[idx];
                    const boundProfileId = getUserBoundProfileId(config, userId);
                    const boundProfile = boundProfileId
                        ? profiles.find((p) => p.id === boundProfileId)
                        : null;

                    // Note: Manual nodes use 'id', subscriptions might not have 'id' in the same way or logic might differ.
                    // Subscriptions usually have 'id' too.
                    let isInProfile = false;
                    if (boundProfile) {
                        if (type === 'sub') {
                            isInProfile = (boundProfile.subscriptions || []).includes(node.id);
                        } else {
                            isInProfile = (boundProfile.manualNodes || []).includes(node.id);
                        }
                    }

                    const protocol = (node.url || '').split('://')[0].toUpperCase();
                    const typeLabel = type === 'sub' ? '订阅' : '节点';

                    let message = `📋 <b>${typeLabel} #${idx + 1}</b>\n\n`;
                    message += `名称: ${escapeHtml(node.name || '未命名')}\n`;
                    message += `协议: ${protocol}\n`;
                    message += `状态: ${node.enabled ? '✅ 启用' : '⛔ 禁用'}\n`;

                    if (boundProfile) {
                        message += `订阅组: ${isInProfile ? '🔗 已关联' : '未关联'}\n`;
                    }

                    // 构建操作按钮
                    const buttons: any[] = [];

                    // 第一行：启用/禁用，复制
                    const toggleCmd =
                        type === 'sub' ? `toggle_sub_${actionIdx}` : `toggle_node_${actionIdx}`;
                    const copyCmd =
                        type === 'sub' ? `copy_sub_${actionIdx}` : `copy_node_${actionIdx}`;

                    buttons.push([
                        { text: node.enabled ? '⛔ 禁用' : '✅ 启用', callback_data: toggleCmd },
                        { text: '📋 复制', callback_data: copyCmd },
                    ]);

                    // 如果有绑定的订阅组，添加关联/取消关联按钮
                    if (boundProfile) {
                        const linkCmd =
                            type === 'sub' ? `link_sub_${actionIdx}` : `link_node_${actionIdx}`;
                        const unlinkCmd =
                            type === 'sub' ? `unlink_sub_${actionIdx}` : `unlink_node_${actionIdx}`;
                        buttons.push([
                            {
                                text: isInProfile ? '➖ 从订阅组移除' : '➕ 添加到订阅组',
                                callback_data: isInProfile ? unlinkCmd : linkCmd,
                            },
                        ]);
                    }

                    // 第二行：重命名，删除
                    const renameCmd =
                        type === 'sub'
                            ? `prompt_rename_sub_${actionIdx}`
                            : `prompt_rename_node_${actionIdx}`;
                    const deleteCmd =
                        type === 'sub'
                            ? `confirm_delete_sub_${actionIdx}`
                            : `confirm_delete_node_${actionIdx}`;

                    buttons.push([
                        { text: '✏️ 重命名', callback_data: renameCmd },
                        { text: '🗑️ 删除', callback_data: deleteCmd },
                    ]);

                    // 返回列表
                    const listCmd = type === 'sub' ? 'cmd_list_sub' : 'cmd_list_node';
                    buttons.push([{ text: '◀️ 返回列表', callback_data: listCmd }]);

                    await answerCallbackQuery(callbackQuery.id, '', env);
                    await editTelegramMessage(chatId, messageId, message, env, {
                        reply_markup: { inline_keyboard: buttons },
                    });
                } else if (data.startsWith('link_node_')) {
                    // 添加节点到订阅组
                    const idx = parseInt(data.replace('link_node_', ''));
                    const storageAdapter = await getStorageAdapter(env);

                    // MUST Use filtered list to match index
                    const allNodes = await getUserNodes(userId, env);
                    const userNodes = allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));

                    const profiles = await storageAdapter.getAllProfiles();
                    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
                    const config = settings.telegram_push_config || {};

                    const boundProfileId = getUserBoundProfileId(config, userId);
                    if (idx >= 0 && idx < userNodes.length && boundProfileId) {
                        const node = userNodes[idx];
                        const profile = profiles.find((p) => p.id === boundProfileId);
                        if (profile) {
                            profile.manualNodes = profile.manualNodes || [];
                            if (!profile.manualNodes.includes(node.id)) {
                                profile.manualNodes.push(node.id);
                                await storageAdapter.putAllProfiles(profiles);
                            }
                            await answerCallbackQuery(
                                callbackQuery.id,
                                `已添加到 ${profile.name}`,
                                env
                            );
                            // 刷新操作面板
                            await editTelegramMessage(
                                chatId,
                                messageId,
                                `✅ 节点 #${idx + 1} 已添加到 <b>${profile.name}</b>`,
                                env
                            );
                        }
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '操作失败', env, true);
                    }
                } else if (data.startsWith('unlink_node_')) {
                    // 从订阅组移除节点
                    const idx = parseInt(data.replace('unlink_node_', ''));
                    const storageAdapter = await getStorageAdapter(env);

                    // MUST Use filtered list to match index
                    const allNodes = await getUserNodes(userId, env);
                    const userNodes = allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));

                    const profiles = await storageAdapter.getAllProfiles();
                    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
                    const config = settings.telegram_push_config || {};

                    const boundProfileId = getUserBoundProfileId(config, userId);
                    if (idx >= 0 && idx < userNodes.length && boundProfileId) {
                        const node = userNodes[idx];
                        const profile = profiles.find((p) => p.id === boundProfileId);
                        if (profile && profile.manualNodes) {
                            profile.manualNodes = profile.manualNodes.filter(
                                (id) => id !== node.id
                            );
                            await storageAdapter.putAllProfiles(profiles);
                            await answerCallbackQuery(
                                callbackQuery.id,
                                `已从 ${profile.name} 移除`,
                                env
                            );
                            await editTelegramMessage(
                                chatId,
                                messageId,
                                `✅ 节点 #${idx + 1} 已从 <b>${profile.name}</b> 移除`,
                                env
                            );
                        }
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '操作失败', env, true);
                    }
                } else if (data.startsWith('link_sub_')) {
                    // 添加订阅到订阅组
                    const idx = parseInt(data.replace('link_sub_', ''));
                    const storageAdapter = await getStorageAdapter(env);

                    // MUST Use filtered list
                    const allNodes = await getUserNodes(userId, env);
                    const subs = allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''));

                    const profiles = await storageAdapter.getAllProfiles();
                    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
                    const config = settings.telegram_push_config || {};

                    const boundProfileId = getUserBoundProfileId(config, userId);
                    if (idx >= 0 && idx < subs.length && boundProfileId) {
                        const sub = subs[idx];
                        const profile = profiles.find((p) => p.id === boundProfileId);
                        if (profile) {
                            profile.subscriptions = profile.subscriptions || [];
                            if (!profile.subscriptions.includes(sub.id)) {
                                profile.subscriptions.push(sub.id);
                                await storageAdapter.putAllProfiles(profiles);
                            }
                            await answerCallbackQuery(
                                callbackQuery.id,
                                `已添加到 ${profile.name}`,
                                env
                            );
                            await editTelegramMessage(
                                chatId,
                                messageId,
                                `✅ 订阅 #${idx + 1} 已添加到 <b>${profile.name}</b>`,
                                env
                            );
                        }
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '操作失败', env, true);
                    }
                } else if (data.startsWith('unlink_sub_')) {
                    // 从订阅组移除订阅
                    const idx = parseInt(data.replace('unlink_sub_', ''));
                    const storageAdapter = await getStorageAdapter(env);

                    // MUST Use filtered list
                    const allNodes = await getUserNodes(userId, env);
                    const subs = allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''));

                    const profiles = await storageAdapter.getAllProfiles();
                    const settings = (await storageAdapter.get(KV_KEY_SETTINGS)) || {};
                    const config = settings.telegram_push_config || {};

                    const boundProfileId = getUserBoundProfileId(config, userId);
                    if (idx >= 0 && idx < subs.length && boundProfileId) {
                        const sub = subs[idx];
                        const profile = profiles.find((p) => p.id === boundProfileId);
                        if (profile && profile.subscriptions) {
                            profile.subscriptions = profile.subscriptions.filter(
                                (id) => id !== sub.id
                            );
                            await storageAdapter.putAllProfiles(profiles);
                            await answerCallbackQuery(
                                callbackQuery.id,
                                `已从 ${profile.name} 移除`,
                                env
                            );
                            await editTelegramMessage(
                                chatId,
                                messageId,
                                `✅ 订阅 #${idx + 1} 已从 <b>${profile.name}</b> 移除`,
                                env
                            );
                        }
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '操作失败', env, true);
                    }
                } else if (data.startsWith('copy_sub_')) {
                    const idx = parseInt(data.replace('copy_sub_', ''));
                    // MUST Use filtered list
                    const allNodes = await getUserNodes(userId, env);
                    const subs = allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''));

                    if (idx >= 0 && idx < subs.length) {
                        const subUrl = subs[idx].url;
                        await answerCallbackQuery(callbackQuery.id, '已发送', env);
                        await sendTelegramMessage(
                            chatId,
                            `📋 <b>订阅链接</b>\n\n<code>${escapeHtml(subUrl)}</code>`,
                            env
                        );
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '对象不存在', env, true);
                    }
                } else if (data.startsWith('copy_node_')) {
                    const idx = parseInt(data.replace('copy_node_', ''));
                    await answerCallbackQuery(callbackQuery.id, '', env);
                    await handleCopyCommand(chatId, userId, [(idx + 1).toString()], env);
                } else if (data.startsWith('toggle_node_') || data.startsWith('toggle_sub_')) {
                    const isSub = data.startsWith('toggle_sub_');
                    const idx = parseInt(data.replace(isSub ? 'toggle_sub_' : 'toggle_node_', ''));
                    const storageAdapter = await getStorageAdapter(env);

                    let fullList = await getUserNodes(userId, env);
                    let targetList = [];
                    if (isSub) {
                        targetList = fullList.filter((n) => /^https?:\/\//i.test(n.url || ''));
                    } else {
                        targetList = fullList.filter((n) => !/^https?:\/\//i.test(n.url || ''));
                    }

                    if (idx >= 0 && idx < targetList.length) {
                        const targetItem = targetList[idx];
                        const isEnabled = (targetItem as Record<string, any>).enabled;

                        await answerCallbackQuery(
                            callbackQuery.id,
                            isEnabled ? '已禁用' : '已启用',
                            env
                        );

                        if (isSub) {
                            // Find original index in KV_KEY_SUBS to update
                            // Since targetList is filtered, we need to find the item in the original storage
                            const originalSubs = await storageAdapter.getAllSubscriptions();
                            // Match by ID if possible, or some unique property.
                            // Subscription objects usually have IDs.
                            const subToUpdate = originalSubs.find((s) => s.id === (targetItem as Record<string, any>).id);

                            if (subToUpdate) {
                                subToUpdate.enabled = !isEnabled;
                                await storageAdapter.putAllSubscriptions(originalSubs);
                                await handleListCommand(chatId, userId, env, 0, 'sub');
                            }
                        } else {
                            // Valid for manual nodes - use command which likely handles ID or index?
                            // handleDisableCommand takes index. Is it filtered index?
                            // Let's check handleDisableCommand.
                            // If handleDisableCommand expects ALL nodes index, we have a problem.
                            // But typically commands work on displayed lists?
                            // If user types /disable 1, what does it disable?
                            // If it disables filtered list item, we are good.
                            // If it disables global list item, we are misaligned.

                            // If handleDisableCommand uses `getUserNodes` without filtering, we need to map `idx` back to `allNodes` index.
                            const allNodes = await getUserNodes(userId, env);
                            const realIdx = allNodes.findIndex((n) => n.id === (targetItem as Record<string, any>).id);

                            if (realIdx !== -1) {
                                if (isEnabled) {
                                    await handleDisableCommand(
                                        chatId,
                                        userId,
                                        [(realIdx + 1).toString()],
                                        env
                                    );
                                } else {
                                    await handleEnableCommand(
                                        chatId,
                                        userId,
                                        [(realIdx + 1).toString()],
                                        env
                                    );
                                }
                            }
                        }
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '对象不存在', env, true);
                    }
                } else if (data.startsWith('confirm_delete_')) {
                    // Handles: confirm_delete_node_{idx}, confirm_delete_sub_{idx}, confirm_delete_{idx}
                    let type = 'node';
                    let idxStr = '';
                    if (data.startsWith('confirm_delete_sub_')) {
                        type = 'sub';
                        idxStr = data.replace('confirm_delete_sub_', '');
                    } else if (data.startsWith('confirm_delete_node_')) {
                        type = 'node';
                        idxStr = data.replace('confirm_delete_node_', '');
                    } else {
                        idxStr = data.replace('confirm_delete_', '');
                    }
                    const idx = parseInt(idxStr);

                    const confirmKeyboard = {
                        inline_keyboard: [
                            [
                                { text: '⚠️ 确认删除', callback_data: `do_delete_${type}_${idx}` },
                                { text: '❌ 取消', callback_data: 'cancel_action' },
                            ],
                        ],
                    };
                    await editTelegramMessage(
                        chatId,
                        messageId,
                        '⚠️ <b>确认删除此对象吗？</b>\n此操作无法撤销。',
                        env,
                        {
                            reply_markup: confirmKeyboard,
                        }
                    );
                } else if (data.startsWith('do_delete_')) {
                    // Handles: do_delete_node_{idx}, do_delete_sub_{idx}, do_delete_{idx}
                    let type = 'node';
                    let idxStr = '';
                    if (data.startsWith('do_delete_sub_')) {
                        type = 'sub';
                        idxStr = data.replace('do_delete_sub_', '');
                    } else if (data.startsWith('do_delete_node_')) {
                        type = 'node';
                        idxStr = data.replace('do_delete_node_', '');
                    } else {
                        idxStr = data.replace('do_delete_', '');
                    }
                    const idx = parseInt(idxStr);

                    // Need to map filtered index to real storage index/ID
                    const allNodes = await getUserNodes(userId, env);
                    let targetItem: any = null;

                    if (type === 'sub') {
                        const subs = allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''));
                        if (idx >= 0 && idx < subs.length) targetItem = subs[idx];
                    } else {
                        const nodes = allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));
                        if (idx >= 0 && idx < nodes.length) targetItem = nodes[idx];
                    }

                    if (targetItem) {
                        if (type === 'sub') {
                            // Create separate handleDeleteSub logic or direct DB manipulation safely
                            const storageAdapter = await getStorageAdapter(env);
                            const originalSubs = await storageAdapter.getAllSubscriptions();
                            const realIdx = originalSubs.findIndex((s) => s.id === targetItem.id);

                            if (realIdx !== -1) {
                                const deletedName = originalSubs[realIdx].name;
                                originalSubs.splice(realIdx, 1);
                                await storageAdapter.putAllSubscriptions(originalSubs);
                                await answerCallbackQuery(callbackQuery.id, '已删除', env);
                                await sendTelegramMessage(
                                    chatId,
                                    `🗑️ 已删除订阅: <b>${escapeHtml(deletedName)}</b>`,
                                    env
                                );
                                await handleListCommand(chatId, userId, env, 0, 'sub');
                            } else {
                                await answerCallbackQuery(
                                    callbackQuery.id,
                                    '对象不存在或已删除',
                                    env,
                                    true
                                );
                            }
                        } else {
                            // For nodes, find real index in ALL nodes for command
                            const realIdx = allNodes.findIndex((n) => n.id === targetItem.id);
                            if (realIdx !== -1) {
                                await answerCallbackQuery(callbackQuery.id, '正在删除...', env);
                                await handleDeleteCommand(
                                    chatId,
                                    userId,
                                    [(realIdx + 1).toString()],
                                    env
                                );
                            }
                        }
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '对象不存在', env, true);
                    }
                } else if (data.startsWith('prompt_rename_')) {
                    // Handles: prompt_rename_node_{idx}, prompt_rename_sub_{idx}, prompt_rename_{idx}
                    let type = 'node';
                    let idxStr = '';
                    if (data.startsWith('prompt_rename_sub_')) {
                        type = 'sub';
                        idxStr = data.replace('prompt_rename_sub_', '');
                    } else if (data.startsWith('prompt_rename_node_')) {
                        type = 'node';
                        idxStr = data.replace('prompt_rename_node_', '');
                    } else {
                        idxStr = data.replace('prompt_rename_', '');
                    }
                    const idx = parseInt(idxStr);

                    // Store state? Ideally use ForceReply.
                    // Simplified: Just tell user command
                    const cmdPrefix = type === 'sub' ? '/set_sub_name' : '/rename';
                    // Wait, do we have /set_sub_name? Probably not.
                    // If no command exists for renaming subs via bot, we might need to add one or just say "Not supported via bot yet".
                    // But for now, let's assume rename is only for nodes or implemented generically.
                    // Checking implementation: handleRenameCommand usually takes indices.

                    if (type === 'sub') {
                        await answerCallbackQuery(
                            callbackQuery.id,
                            '暂不支持在 Bot 中重命名订阅',
                            env,
                            true
                        );
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '请发送新名称', env);
                        await sendTelegramMessage(
                            chatId,
                            `请回复以下格式重命名:\n<code>/rename ${idx + 1} 新名称</code>`,
                            env
                        );
                    }
                } else if (data.startsWith('bind_profile_')) {
                    // 绑定订阅组
                    const profileId = data.replace('bind_profile_', '');
                    const cache = requestCache || createRequestCache();
                    const profiles = await getCachedProfiles(env, cache);
                    const settings = await getCachedSettings(env, cache);
                    const config = settings.telegram_push_config || {};

                    const targetProfile = profiles.find((p) => p.id === profileId);
                    if (targetProfile) {
                        setUserBoundProfileId(config, userId, profileId);
                        config.auto_bind = true;
                        settings.telegram_push_config = config;
                        cache.settings = settings;
                        await persistCachedSettings(env, cache);

                        await answerCallbackQuery(
                            callbackQuery.id,
                            `已绑定: ${targetProfile.name}`,
                            env
                        );
                        await editTelegramMessage(
                            chatId,
                            messageId,
                            `✅ <b>绑定成功</b>\n\n已绑定到: <b>${targetProfile.name}</b>`,
                            env,
                            { requestCache }
                        );
                    } else {
                        await answerCallbackQuery(callbackQuery.id, '订阅组不存在', env, true);
                    }
                } else if (data === 'unbind_profile') {
                    // 解除绑定
                    const cache = requestCache || createRequestCache();
                    const settings = await getCachedSettings(env, cache);
                    const config = settings.telegram_push_config || {};

                    setUserBoundProfileId(config, userId, '');
                    settings.telegram_push_config = config;
                    cache.settings = settings;
                    await persistCachedSettings(env, cache);

                    await answerCallbackQuery(callbackQuery.id, '已解除绑定', env);
                    await editTelegramMessage(chatId, messageId, '✅ 已解除绑定', env, {
                        requestCache,
                    });
                } else {
                    await answerCallbackQuery(callbackQuery.id, '未知操作', env);
                }
        }
    } catch (error) {
        console.error('[Telegram Push] Callback query failed:', error);
        await answerCallbackQuery(callbackQuery.id, '操作失败', env, true);
    }

    return createJsonResponse({ ok: true });
}
