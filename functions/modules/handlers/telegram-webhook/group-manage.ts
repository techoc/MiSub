/**
 * 订阅组（TG 侧分组）选择、管理与批量操作
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { clearAllNodeCaches } from '../../../services/node-cache-service.ts';
import { escapeHtml } from '../../utils.ts';
import { createRequestCache, getCachedStorageAdapter, getCachedSubscriptions } from './cache.ts';
import { editTelegramMessage, sendTelegramMessage } from './telegram-api.ts';
import { getUserNodes } from './user-access.ts';

import type { KvRecord } from '../../../../types/models.ts';
/**
 * 节点分组选择面板：列出所有分组及数量，点击进入该分组列表。
 *
 * 与网站「手动节点 → 分组筛选」对应。用户节点较多时（如 200+），
 * 先选分组再看列表比直接翻页友好得多。
 */
export async function handleGroupSelect(
    chatId: any,
    userId: any,
    env: any,
    messageId: KvRecord | null = null,
    type = 'node',
    requestCache: Record<string, any> | null = null
) {
    const cache = requestCache || createRequestCache();
    const allNodes = await getUserNodes(userId, env);
    const nodes =
        type === 'sub'
            ? allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''))
            : allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));

    // 统计分组
    const groupCounts = new Map();
    let ungrouped = 0;
    nodes.forEach((n) => {
        const g = (n.group || '').trim();
        if (g) groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
        else ungrouped++;
    });

    const title = type === 'sub' ? '\uD83D\uDCE1 选择订阅分组' : '\uD83D\uDE80 选择节点分组';
    let text = `<b>${title}</b>\n\n共 ${nodes.length} 项`;
    if (groupCounts.size > 0) {
        text += `，${groupCounts.size} 个分组`;
    }

    // 构建分组按钮（每行 2 个）
    const buttons: any[] = [];
    const entries = Array.from(groupCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (let i = 0; i < entries.length; i += 2) {
        const row: Array<{ text: string; callback_data: string }> = [];
        for (let j = i; j < Math.min(i + 2, entries.length); j++) {
            const [name, count] = entries[j];
            // callback_data 有 64 字节限制，长组名需要截断
            const short = name.length > 20 ? `${name.slice(0, 18)}…` : name;
            row.push({
                text: `${short} (${count})`,
                callback_data: `grp_${type}_${encodeURIComponent(name).slice(0, 40)}`,
            });
        }
        buttons.push(row);
    }

    // 全部 / 未分组
    const tail = [{ text: `全部 (${nodes.length})`, callback_data: `grp_${type}___all__` }];
    if (ungrouped > 0) {
        tail.push({ text: `未分组 (${ungrouped})`, callback_data: `grp_${type}___none__` });
    }
    buttons.push(tail);

    buttons.push([{ text: '\uD83D\uDD19 返回菜单', callback_data: 'cmd_menu' }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
        await editTelegramMessage(chatId, messageId, text, env, {
            reply_markup: keyboard,
            requestCache,
        });
    } else {
        await sendTelegramMessage(chatId, text, env, { reply_markup: keyboard, requestCache });
    }
}

/**
 * 分组管理面板：列出所有分组，支持重命名、删除、批量改组。
 *
 * 对应网站的「批量分组」功能。
 */
export async function handleGroupManage(
    chatId: any,
    userId: any,
    env: any,
    messageId: KvRecord | null = null,
    type = 'node',
    requestCache: Record<string, any> | null = null
) {
    const cache = requestCache || createRequestCache();
    const allNodes = await getUserNodes(userId, env);
    const nodes =
        type === 'sub'
            ? allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''))
            : allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));

    const groupCounts = new Map();
    let ungrouped = 0;
    nodes.forEach((n) => {
        const g = (n.group || '').trim();
        if (g) groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
        else ungrouped++;
    });

    let text =
        '\uD83D\uDCC1 <b>分组管理</b>\n\n' +
        `共 ${nodes.length} 项，${groupCounts.size} 个分组` +
        (ungrouped > 0 ? `，${ungrouped} 项未分组` : '') +
        '\n\n点击分组可重命名或删除：';

    const buttons: any[] = [];
    Array.from(groupCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, count]) => {
            const short = name.length > 16 ? `${name.slice(0, 14)}…` : name;
            buttons.push([
                {
                    text: `📁 ${short} (${count})`,
                    callback_data: `gmgr_${type}_${encodeURIComponent(name).slice(0, 40)}`,
                },
            ]);
        });

    buttons.push([{ text: '🔙 返回菜单', callback_data: 'cmd_menu' }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
        await editTelegramMessage(chatId, messageId, text, env, {
            reply_markup: keyboard,
            requestCache,
        });
    } else {
        await sendTelegramMessage(chatId, text, env, { reply_markup: keyboard, requestCache });
    }
}

/**
 * 单个分组的操作面板（重命名 / 删除 / 查看）。
 */
export async function handleGroupActions(
    chatId: any,
    userId: any,
    env: any,
    messageId: any,
    type: any,
    groupName: any,
    requestCache: Record<string, any> | null = null
) {
    const cache = requestCache || createRequestCache();
    const allNodes = await getUserNodes(userId, env);
    const nodes =
        type === 'sub'
            ? allNodes.filter((n) => /^https?:\/\//i.test(n.url || ''))
            : allNodes.filter((n) => !/^https?:\/\//i.test(n.url || ''));
    const count = nodes.filter((n) => (n.group || '').trim() === groupName).length;

    const text =
        `\uD83D\uDCC1 <b>${escapeHtml(groupName)}</b>\n\n` +
        `包含 ${count} 项\n\n` +
        '选择要执行的操作：';

    const encoded = encodeURIComponent(groupName).slice(0, 40);
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✏️ 重命名', callback_data: `gmrn_${type}_${encoded}` },
                { text: '📋 查看列表', callback_data: `grp_${type}_${encoded}` },
            ],
            [
                { text: '🗑 删除分组', callback_data: `gmrm_${type}_${encoded}` },
                { text: '🚫 清空该组', callback_data: `gmcl_${type}_${encoded}` },
            ],
            [{ text: '🔙 返回', callback_data: `gmls_${type}` }],
        ],
    };

    if (messageId) {
        await editTelegramMessage(chatId, messageId, text, env, {
            reply_markup: keyboard,
            requestCache,
        });
    } else {
        await sendTelegramMessage(chatId, text, env, { reply_markup: keyboard, requestCache });
    }
}

/**
 * 执行分组操作。
 * @param {string} op rename | clear | delete
 */
export async function applyGroupOperation(
    chatId: any,
    userId: any,
    env: any,
    type: any,
    groupName: any,
    op = 'rename',
    newName: KvRecord | null = null,
    requestCache: Record<string, any> | null = null
) {
    const cache = requestCache || createRequestCache();
    const storageAdapter = await getCachedStorageAdapter(env, cache);
    const allSubscriptions = await getCachedSubscriptions(env, cache);

    let changed = 0;
    allSubscriptions.forEach((sub: any) => {
        if ((sub.group || '').trim() !== groupName) return;
        // 订阅源与节点都按 type 筛选
        const isSub = /^https?:\/\//i.test(sub.url || '');
        if (type === 'sub' ? !isSub : isSub) return;

        if (op === 'rename') sub.group = newName;
        else if (op === 'clear') sub.group = ''; // 清空该组 = 成员变为未分组
        changed++;
    });

    if (op === 'delete') {
        // 删除分组：把成员移除（这里语义同「删除该组内所有项」）
        const remaining = allSubscriptions.filter((sub: any) => {
            const isSub = /^https?:\/\//i.test(sub.url || '');
            const sameType = type === 'sub' ? isSub : !isSub;
            const sameGroup = (sub.group || '').trim() === groupName;
            if (sameType && sameGroup) {
                changed++;
                return false;
            }
            return true;
        });
        await storageAdapter.putAllSubscriptions(remaining);
    } else {
        if (changed === 0) return 0;
        await storageAdapter.putAllSubscriptions(allSubscriptions);
    }

    // 清理节点缓存，避免前端读到旧数据
    if (type === 'node') await clearAllNodeCaches(env);

    return changed;
}

/**
 * 解析目标参数（支持序号、ID、all）
 * @returns {Object} { type: 'index'|'id'|'all'|'range', values: [] }
 */
export function parseTargetArgs(args: any) {
    if (!args || args.length === 0) {
        return { type: 'none', values: [] };
    }

    const arg = args.join(' ').trim().toLowerCase();

    if (arg === 'all' || arg === '全部') {
        return { type: 'all', values: [] };
    }

    // 支持逗号分隔的多个值
    const parts = arg.split(/[,，\s]+/).filter((p: any) => p);
    const indices: number[] = [];
    const ids: any[] = [];

    for (const part of parts) {
        const num = parseInt(part);
        if (!isNaN(num) && num > 0) {
            indices.push(num - 1); // 转为0-indexed
        } else {
            ids.push(part);
        }
    }

    if (indices.length > 0 && ids.length === 0) {
        return { type: 'index', values: indices };
    } else if (ids.length > 0 && indices.length === 0) {
        return { type: 'id', values: ids };
    } else if (indices.length > 0 && ids.length > 0) {
        return { type: 'mixed', indices, ids };
    }

    return { type: 'none', values: [] };
}
