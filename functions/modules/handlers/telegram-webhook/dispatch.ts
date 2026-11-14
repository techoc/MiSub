/**
 * 命令路由：把 /command 分发到对应处理器
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { createJsonResponse, escapeHtml } from '../../utils.ts';
import { applyGroupOperation, handleGroupManage } from './group-manage.ts';
import {
    handleHelpCommand,
    handleListCommand,
    handleListTypeSelector,
    handleMenuCommand,
    handleStartCommand,
    handleStatsCommand,
} from './commands-core.ts';
import {
    handleCopyCommand,
    handleDeleteCommand,
    handleDisableCommand,
    handleEnableCommand,
    handleExportCommand,
    handleInfoCommand,
    handleRenameCommand,
    handleSearchCommand,
    handleSubCommand,
} from './commands-node.ts';
import {
    handleBindCommand,
    handleDupCommand,
    handleImportCommand,
    handleSortCommand,
    handleUnbindCommand,
} from './commands-data.ts';
import { sendTelegramMessage } from './telegram-api.ts';

import type { KvRecord } from '../../../../types/models.ts';
// ==================== 命令路由 ====================

/**
 * 处理命令
 */
export async function handleCommand(chatId, text, userId, env, request, requestCache: KvRecord | null = null) {
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase().split('@')[0]; // 移除 @botname
    const args = parts.slice(1);

    switch (command) {
        case '/start':
            await handleStartCommand(chatId, env);
            break;

        case '/help':
            await handleHelpCommand(chatId, env);
            break;

        case '/menu':
            await handleMenuCommand(chatId, env, null, requestCache);
            break;

        case '/list':
            if (args[0]?.toLowerCase() === 'node' || args[0] === '节点') {
                await handleListCommand(chatId, userId, env, 0, 'node', null, requestCache);
            } else if (
                ['sub', 'airport', 'subscription', '订阅', '机场'].includes(args[0]?.toLowerCase())
            ) {
                await handleListCommand(chatId, userId, env, 0, 'sub', null, requestCache);
            } else {
                await handleListTypeSelector(chatId, env, null, requestCache);
            }
            break;

        case '/stats':
            await handleStatsCommand(chatId, userId, env, requestCache);
            break;

        case '/delete':
        case '/del':
        case '/rm':
            await handleDeleteCommand(chatId, userId, args, env);
            break;

        case '/enable':
        case '/on':
            await handleEnableCommand(chatId, userId, args, env);
            break;

        case '/disable':
        case '/off':
            await handleDisableCommand(chatId, userId, args, env);
            break;

        case '/search':
        case '/find':
            await handleSearchCommand(chatId, userId, args, env);
            break;

        case '/sub':
        case '/subscription':
            await handleSubCommand(chatId, args, env, request, requestCache);
            break;

        case '/rename':
            await handleRenameCommand(chatId, userId, args, env);
            break;

        case '/info':
        case '/detail':
            await handleInfoCommand(chatId, userId, args, env);
            break;

        case '/copy':
        case '/cp':
            await handleCopyCommand(chatId, userId, args, env);
            break;

        case '/export':
        case '/backup':
            await handleExportCommand(chatId, userId, args, env);
            break;

        case '/import':
            await handleImportCommand(chatId, userId, args, env);
            break;

        case '/sort':
            await handleSortCommand(chatId, userId, args, env);
            break;

        case '/dup':
        case '/dedup':
            await handleDupCommand(chatId, userId, args, env);
            break;

        case '/groups':
        case '/group':
            // /groups [node|sub] 打开分组管理面板
            await handleGroupManage(
                chatId,
                userId,
                env,
                null,
                args[0] === 'sub' ? 'sub' : 'node',
                requestCache
            );
            break;

        case '/grename': {
            // /grename <旧组名> <新组名>
            const oldName = args[0];
            const newName = args.slice(1).join(' ').trim();
            if (!oldName || !newName) {
                await sendTelegramMessage(
                    chatId,
                    '✏️ <b>重命名分组</b>\n\n用法：/grename 旧组名 新组名\n\n例：/grename 导入 01 香港节点',
                    env
                );
                break;
            }
            const n = await applyGroupOperation(
                chatId,
                userId,
                env,
                'node',
                oldName,
                'rename',
                newName,
                requestCache
            );
            await sendTelegramMessage(
                chatId,
                n > 0
                    ? `✅ 已将 <b>${escapeHtml(oldName)}</b> 重命名为 <b>${escapeHtml(newName)}</b>（${n} 项）`
                    : `⚠️ 未找到分组 <b>${escapeHtml(oldName)}</b>`,
                env
            );
            break;
        }

        case '/bind':
            await handleBindCommand(chatId, userId, args, env, requestCache);
            break;

        case '/unbind':
            await handleUnbindCommand(chatId, userId, env, requestCache);
            break;

        default:
            await sendTelegramMessage(
                chatId,
                '❌ 未知命令\n\n发送 /help 查看可用命令\n发送 /menu 打开快捷菜单',
                env
            );
    }

    return createJsonResponse({ ok: true });
}
