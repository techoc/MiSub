/**
 * 节点操作命令：/delete /enable /disable /toggle /search /sub /subSimple
 * /rename /info /copy /export
 * 从 telegram-webhook-handler.js 拆分而来；路由见 ./dispatch.js。
 */

import { escapeHtml } from '../../utils.js';
import { createRequestCache, getCachedProfiles, getCachedSettings } from './cache.js';
import { parseTargetArgs } from './group-manage.js';
import { sendTelegramMessage } from './telegram-api.js';
import { getNodesWithMapping, getUserNodes } from './user-access.js';

/**
 * 处理 /delete 命令
 */
export async function handleDeleteCommand(chatId, userId, args, env) {
    try {
        const target = parseTargetArgs(args);

        if (target.type === 'none') {
            await sendTelegramMessage(
                chatId,
                '❌ <b>请指定要删除的节点</b>\n\n' +
                    '用法：\n' +
                    '/delete 1 - 删除第1个\n' +
                    '/delete 1,3,5 - 删除多个\n' +
                    '/delete all - 删除全部',
                env
            );
            return;
        }

        const { allSubscriptions, userNodes, indexMapping, storageAdapter } =
            await getNodesWithMapping(userId, env);

        if (userNodes.length === 0) {
            await sendTelegramMessage(chatId, '📋 暂无可删除的节点', env);
            return;
        }

        let indicesToDelete = [];

        if (target.type === 'all') {
            indicesToDelete = indexMapping;
        } else if (target.type === 'index') {
            for (const idx of target.values) {
                if (idx >= 0 && idx < userNodes.length) {
                    indicesToDelete.push(indexMapping[idx]);
                }
            }
        } else if (target.type === 'id') {
            for (const id of target.values) {
                const foundIdx = allSubscriptions.findIndex((s) => s.id === id);
                if (foundIdx !== -1 && indexMapping.includes(foundIdx)) {
                    indicesToDelete.push(foundIdx);
                }
            }
        }

        if (indicesToDelete.length === 0) {
            await sendTelegramMessage(chatId, '❌ 未找到指定的节点', env);
            return;
        }

        // 收集要删除的 ID
        const deletedIds = [];
        for (const idx of indicesToDelete) {
            if (allSubscriptions[idx]) {
                deletedIds.push(allSubscriptions[idx].id);
            }
        }

        // 删除节点（从后往前删除以保持索引正确）
        indicesToDelete.sort((a, b) => b - a);
        const deletedNames = [];
        for (const idx of indicesToDelete) {
            deletedNames.push(allSubscriptions[idx].name);
            allSubscriptions.splice(idx, 1);
        }

        await storageAdapter.putAllSubscriptions(allSubscriptions);

        // 3. 清理订阅组中的引用
        try {
            const profiles = await storageAdapter.getAllProfiles();
            if (profiles.length > 0) {
                let profilesUpdated = false;
                const idsToRemove = new Set(deletedIds);

                profiles.forEach((profile) => {
                    // 清理 manualNodes
                    if (Array.isArray(profile.manualNodes)) {
                        const prevLen = profile.manualNodes.length;
                        profile.manualNodes = profile.manualNodes.filter(
                            (id) => !idsToRemove.has(id)
                        );
                        if (profile.manualNodes.length !== prevLen) profilesUpdated = true;
                    }
                    // 清理 subscriptions
                    if (Array.isArray(profile.subscriptions)) {
                        const prevLen = profile.subscriptions.length;
                        profile.subscriptions = profile.subscriptions.filter(
                            (id) => !idsToRemove.has(id)
                        );
                        if (profile.subscriptions.length !== prevLen) profilesUpdated = true;
                    }
                });

                if (profilesUpdated) {
                    await storageAdapter.putAllProfiles(profiles);
                    console.info(
                        `[Telegram Push] Cleaned up ${deletedIds.length} node references from profiles`
                    );
                }
            }
        } catch (cleanupError) {
            console.error('[Telegram Push] Cleanup profiles error:', cleanupError);
        }

        let message = `✅ <b>已删除 ${deletedNames.length} 个节点</b>\n\n`;
        if (deletedNames.length <= 5) {
            deletedNames.reverse().forEach((name) => {
                message += `• ${name}\n`;
            });
        }

        await sendTelegramMessage(chatId, message, env);
        console.info(`[Telegram Push] User ${userId} deleted ${deletedNames.length} nodes`);
    } catch (error) {
        console.error('[Telegram Push] Delete command failed:', error);
        await sendTelegramMessage(chatId, `❌ 删除失败: ${error.message}`, env);
    }
}

/**
 * 处理 /enable 命令
 */
export async function handleEnableCommand(chatId, userId, args, env) {
    await handleToggleCommand(chatId, userId, args, env, true);
}

/**
 * 处理 /disable 命令
 */
export async function handleDisableCommand(chatId, userId, args, env) {
    await handleToggleCommand(chatId, userId, args, env, false);
}

/**
 * 切换节点启用状态
 */
export async function handleToggleCommand(chatId, userId, args, env, enable) {
    try {
        const target = parseTargetArgs(args);
        const action = enable ? '启用' : '禁用';
        const icon = enable ? '✅' : '⛔';

        if (target.type === 'none') {
            await sendTelegramMessage(
                chatId,
                `❌ <b>请指定要${action}的节点</b>\n\n` +
                    `用法：\n` +
                    `/${enable ? 'enable' : 'disable'} 1 - ${action}第1个\n` +
                    `/${enable ? 'enable' : 'disable'} 1,3,5 - ${action}多个\n` +
                    `/${enable ? 'enable' : 'disable'} all - ${action}全部`,
                env
            );
            return;
        }

        const { allSubscriptions, userNodes, indexMapping, storageAdapter } =
            await getNodesWithMapping(userId, env);

        if (userNodes.length === 0) {
            await sendTelegramMessage(chatId, `📋 暂无可${action}的节点`, env);
            return;
        }

        let indicesToToggle = [];

        if (target.type === 'all') {
            indicesToToggle = [...indexMapping];
        } else if (target.type === 'index') {
            for (const idx of target.values) {
                if (idx >= 0 && idx < userNodes.length) {
                    indicesToToggle.push(indexMapping[idx]);
                }
            }
        }

        if (indicesToToggle.length === 0) {
            await sendTelegramMessage(chatId, '❌ 未找到指定的节点', env);
            return;
        }

        const toggledNames = [];
        for (const idx of indicesToToggle) {
            allSubscriptions[idx].enabled = enable;
            toggledNames.push(allSubscriptions[idx].name);
        }

        await storageAdapter.putAllSubscriptions(allSubscriptions);

        let message = `${icon} <b>已${action} ${toggledNames.length} 个节点</b>\n\n`;
        if (toggledNames.length <= 5) {
            toggledNames.forEach((name) => {
                message += `• ${name}\n`;
            });
        }

        await sendTelegramMessage(chatId, message, env);
    } catch (error) {
        console.error(`[Telegram Push] Toggle command failed:`, error);
        await sendTelegramMessage(
            chatId,
            `❌ ${enable ? '启用' : '禁用'}失败: ${error.message}`,
            env
        );
    }
}

/**
 * 处理 /search 命令
 */
export async function handleSearchCommand(chatId, userId, args, env) {
    try {
        const keyword = args.join(' ').trim();

        if (!keyword) {
            await sendTelegramMessage(
                chatId,
                '🔍 <b>搜索节点</b>\n\n' +
                    '用法：/search <关键词>\n\n' +
                    '示例：\n' +
                    '/search 香港\n' +
                    '/search vmess\n' +
                    '/search HK',
                env
            );
            return;
        }

        const userNodes = await getUserNodes(userId, env);
        const lowerKeyword = keyword.toLowerCase();

        const results = userNodes.filter((node, idx) => {
            const protocol = node.url.split('://')[0].toLowerCase();
            return (
                node.name.toLowerCase().includes(lowerKeyword) || protocol.includes(lowerKeyword)
            );
        });

        if (results.length === 0) {
            await sendTelegramMessage(chatId, `🔍 未找到包含 "<b>${keyword}</b>" 的节点`, env);
            return;
        }

        let message = `🔍 <b>搜索结果</b>：${results.length} 个\n\n`;

        results.slice(0, 10).forEach((node, i) => {
            const protocol = node.url.split('://')[0].toUpperCase();
            const status = node.enabled ? '✅' : '⛔';
            const originalIdx = userNodes.indexOf(node) + 1;
            message += `<b>${originalIdx}.</b> ${status} ${node.name} (${protocol})\n`;
        });

        if (results.length > 10) {
            message += `\n... 还有 ${results.length - 10} 个结果`;
        }

        await sendTelegramMessage(chatId, message, env);
    } catch (error) {
        console.error('[Telegram Push] Search command failed:', error);
        await sendTelegramMessage(chatId, `❌ 搜索失败: ${error.message}`, env);
    }
}

/**
 * 处理 /sub 命令 - 获取订阅链接
 */
export async function handleSubCommand(chatId, args, env, request, requestCache = null) {
    try {
        const cache = requestCache || createRequestCache();
        const profiles = await getCachedProfiles(env, cache);
        const settings = await getCachedSettings(env, cache);

        // 获取公开的订阅组
        const publicProfiles = profiles.filter((p) => p.isPublic);

        if (publicProfiles.length === 0) {
            await sendTelegramMessage(
                chatId,
                '🔗 <b>暂无公开订阅组</b>\n\n' + '请在 Web 界面创建订阅组并设为公开',
                env
            );
            return;
        }

        // 获取基础 URL - 优先使用设置中的域名
        let baseUrl = settings.custom_domain || settings.publicDomain || '';
        if (!baseUrl && request?.url) {
            try {
                const url = new URL(request.url);
                baseUrl = `${url.protocol}//${url.host}`;
            } catch (e) {
                baseUrl = '';
            }
        }

        if (args.length > 0) {
            // 查找指定订阅组
            const targetName = args.join(' ').trim().toLowerCase();
            const profile = publicProfiles.find(
                (p) =>
                    p.name.toLowerCase().includes(targetName) || p.id.toLowerCase() === targetName
            );

            if (!profile) {
                await sendTelegramMessage(
                    chatId,
                    `❌ 未找到名为 "<b>${escapeHtml(args.join(' '))}</b>" 的订阅组`,
                    env
                );
                return;
            }

            let message = `🔗 <b>${profile.name}</b>\n\n`;
            if (baseUrl) {
                message += `订阅链接：\n<code>${baseUrl}/sub/${profile.id}</code>\n\n`;
                message += `点击链接可复制`;
            } else {
                message += `订阅组 ID：<code>${profile.id}</code>\n\n`;
                message += `💡 请在设置中配置公开域名以获取完整链接`;
            }

            await sendTelegramMessage(chatId, message, env);
        } else {
            // 列出所有公开订阅组
            let message = `🔗 <b>订阅组列表</b>\n\n`;

            publicProfiles.forEach((profile, i) => {
                message += `<b>${i + 1}. ${profile.name}</b>\n`;
                if (baseUrl) {
                    message += `<code>${baseUrl}/sub/${profile.id}</code>\n\n`;
                } else {
                    message += `ID: <code>${profile.id}</code>\n\n`;
                }
            });

            if (!baseUrl) {
                message += `💡 请在设置中配置公开域名`;
            } else {
                message += `💡 使用 /sub <名称> 获取指定订阅`;
            }

            await sendTelegramMessage(chatId, message, env);
        }
    } catch (error) {
        console.error('[Telegram Push] Sub command failed:', error);
        await sendTelegramMessage(chatId, `❌ 获取订阅失败: ${escapeHtml(error.message)}`, env);
    }
}

/**
 * 处理订阅获取 - 简化版（用于快捷菜单，不需要 request）
 */
export async function handleSubCommandSimple(chatId, env, requestCache = null) {
    try {
        const cache = requestCache || createRequestCache();
        const profiles = await getCachedProfiles(env, cache);
        const settings = await getCachedSettings(env, cache);

        // 获取公开的订阅组
        const publicProfiles = profiles.filter((p) => p.isPublic);

        if (publicProfiles.length === 0) {
            await sendTelegramMessage(
                chatId,
                '🔗 <b>暂无公开订阅组</b>\n\n' + '请在 Web 界面创建订阅组并设为公开',
                env
            );
            return;
        }

        // 尝试从设置中获取域名
        const customDomain = settings.custom_domain || settings.publicDomain || '';

        let message = '🔗 <b>订阅组列表</b>\n\n';

        publicProfiles.forEach((profile, i) => {
            message += `<b>${i + 1}. ${profile.name}</b>\n`;
            message += `ID: <code>${profile.id}</code>\n`;
            if (customDomain) {
                message += `链接: <code>${customDomain}/sub/${profile.id}</code>\n`;
            }
            message += '\n';
        });

        if (!customDomain) {
            message += '💡 请使用 /sub 命令获取完整链接';
        }

        await sendTelegramMessage(chatId, message, env);
    } catch (error) {
        console.error('[Telegram Push] Sub command simple failed:', error);
        await sendTelegramMessage(chatId, `❌ 获取订阅失败: ${escapeHtml(error.message)}`, env);
    }
}

/**
 * 处理 /rename 命令
 */
export async function handleRenameCommand(chatId, userId, args, env) {
    try {
        if (args.length < 2) {
            await sendTelegramMessage(
                chatId,
                '✏️ <b>重命名节点</b>\n\n' +
                    '用法：/rename [序号] [新名称]\n\n' +
                    '示例：/rename 1 香港节点01',
                env
            );
            return;
        }

        const idx = parseInt(args[0]) - 1;
        const newName = args.slice(1).join(' ').trim();

        if (isNaN(idx) || idx < 0) {
            await sendTelegramMessage(chatId, '❌ 请输入有效的序号', env);
            return;
        }

        if (!newName) {
            await sendTelegramMessage(chatId, '❌ 请输入新名称', env);
            return;
        }

        const { allSubscriptions, userNodes, indexMapping, storageAdapter } =
            await getNodesWithMapping(userId, env);

        if (idx >= userNodes.length) {
            await sendTelegramMessage(
                chatId,
                `❌ 序号超出范围（共 ${userNodes.length} 个节点）`,
                env
            );
            return;
        }

        const allIdx = indexMapping[idx];
        const oldName = allSubscriptions[allIdx].name;
        allSubscriptions[allIdx].name = newName;

        await storageAdapter.putAllSubscriptions(allSubscriptions);

        await sendTelegramMessage(
            chatId,
            `✅ <b>重命名成功</b>\n\n` + `原名称：${oldName}\n` + `新名称：${newName}`,
            env
        );
    } catch (error) {
        console.error('[Telegram Push] Rename command failed:', error);
        await sendTelegramMessage(chatId, `❌ 重命名失败: ${escapeHtml(error.message)}`, env);
    }
}

/**
 * 处理 /info 命令 - 节点详情
 */
export async function handleInfoCommand(chatId, userId, args, env) {
    try {
        if (args.length === 0) {
            await sendTelegramMessage(
                chatId,
                '📄 <b>查看节点详情</b>\n\n' + '用法：/info <序号>\n' + '示例：/info 1',
                env
            );
            return;
        }

        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0) {
            await sendTelegramMessage(chatId, '❌ 请输入有效的序号', env);
            return;
        }

        const userNodes = await getUserNodes(userId, env);

        if (idx >= userNodes.length) {
            await sendTelegramMessage(
                chatId,
                `❌ 序号超出范围（共 ${userNodes.length} 个节点）`,
                env
            );
            return;
        }

        const node = userNodes[idx];
        const protocol = node.url.split('://')[0].toUpperCase();
        const status = node.enabled ? '✅ 启用' : '⛔ 禁用';
        const createdAt = node.created_at
            ? new Date(node.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            : '未知';

        // 脱敏显示服务器地址
        let serverInfo = '未解析';
        try {
            const urlPart = node.url.split('://')[1]?.split('#')[0];
            if (urlPart) {
                // 简单脱敏
                serverInfo =
                    urlPart.length > 20
                        ? urlPart.substring(0, 10) + '...' + urlPart.slice(-8)
                        : urlPart;
            }
        } catch {}

        let message = `📄 <b>节点详情 #${idx + 1}</b>\n\n`;
        message += `<b>名称：</b>${node.name}\n`;
        message += `<b>协议：</b>${protocol}\n`;
        message += `<b>状态：</b>${status}\n`;
        message += `<b>ID：</b><code>${node.id}</code>\n`;
        message += `<b>添加：</b>${createdAt}\n`;

        // 操作按钮
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📋 复制链接', callback_data: `copy_node_${idx}` },
                    {
                        text: node.enabled ? '⛔ 禁用' : '✅ 启用',
                        callback_data: `toggle_node_${idx}`,
                    },
                ],
                [
                    { text: '✏️ 重命名', callback_data: `prompt_rename_${idx}` },
                    { text: '🗑️ 删除', callback_data: `confirm_delete_${idx}` },
                ],
            ],
        };

        await sendTelegramMessage(chatId, message, env, { reply_markup: keyboard });
    } catch (error) {
        console.error('[Telegram Push] Info command failed:', error);
        await sendTelegramMessage(chatId, `❌ 获取详情失败: ${escapeHtml(error.message)}`, env);
    }
}

/**
 * 处理 /copy 命令 - 复制节点链接
 */
export async function handleCopyCommand(chatId, userId, args, env) {
    try {
        const target = parseTargetArgs(args);

        if (target.type === 'none') {
            await sendTelegramMessage(
                chatId,
                '📋 <b>复制节点链接</b>\n\n' +
                    '用法：/copy <序号>\n' +
                    '示例：/copy 1\n' +
                    '示例：/copy 1,2,3',
                env
            );
            return;
        }

        const userNodes = await getUserNodes(userId, env);

        if (userNodes.length === 0) {
            await sendTelegramMessage(chatId, '📋 暂无节点', env);
            return;
        }

        let indicesToCopy = [];

        if (target.type === 'all') {
            indicesToCopy = userNodes.map((_, i) => i);
        } else if (target.type === 'index') {
            indicesToCopy = target.values.filter((idx) => idx >= 0 && idx < userNodes.length);
        }

        if (indicesToCopy.length === 0) {
            await sendTelegramMessage(chatId, '❌ 未找到指定的节点', env);
            return;
        }

        // 生成链接文本
        const links = indicesToCopy.map((idx) => userNodes[idx].url).join('\n');

        if (indicesToCopy.length === 1) {
            const node = userNodes[indicesToCopy[0]];
            await sendTelegramMessage(
                chatId,
                `📋 <b>${node.name}</b>\n\n<code>${node.url}</code>\n\n点击上方链接可复制`,
                env
            );
        } else {
            await sendTelegramMessage(
                chatId,
                `📋 <b>已复制 ${indicesToCopy.length} 个节点链接</b>\n\n<code>${links}</code>`,
                env
            );
        }
    } catch (error) {
        console.error('[Telegram Push] Copy command failed:', error);
        await sendTelegramMessage(chatId, `❌ 复制失败: ${escapeHtml(error.message)}`, env);
    }
}

/**
 * 处理 /export 命令 - 导出节点
 */
export async function handleExportCommand(chatId, userId, args, env) {
    try {
        const userNodes = await getUserNodes(userId, env);

        if (userNodes.length === 0) {
            await sendTelegramMessage(chatId, '📦 暂无可导出的节点', env);
            return;
        }

        const format = args[0]?.toLowerCase() || 'base64';

        let content = '';
        let formatName = '';

        switch (format) {
            case 'url':
            case 'raw':
                // 原始链接格式
                content = userNodes.map((n) => n.url).join('\n');
                formatName = '原始链接';
                break;

            case 'base64':
            default: {
                // Base64 格式
                const urls = userNodes.map((n) => n.url).join('\n');
                content = btoa(unescape(encodeURIComponent(urls)));
                formatName = 'Base64';
                break;
            }
        }

        let message = `📦 <b>导出成功</b>\n\n`;
        message += `格式：${formatName}\n`;
        message += `节点：${userNodes.length} 个\n\n`;

        if (content.length > 3000) {
            // 内容太长，分块发送
            message += `内容较长，请分段复制：`;
            await sendTelegramMessage(chatId, message, env);

            // 分块发送
            const chunkSize = 3000;
            for (let i = 0; i < content.length; i += chunkSize) {
                const chunk = content.substring(i, i + chunkSize);
                await sendTelegramMessage(chatId, `<code>${chunk}</code>`, env);
            }
        } else {
            message += `<code>${content}</code>`;
            await sendTelegramMessage(chatId, message, env);
        }

        await sendTelegramMessage(
            chatId,
            '💡 <b>导出格式</b>\n' + '/export - Base64（默认）\n' + '/export url - 原始链接',
            env
        );
    } catch (error) {
        console.error('[Telegram Push] Export command failed:', error);
        await sendTelegramMessage(chatId, `❌ 导出失败: ${escapeHtml(error.message)}`, env);
    }
}
