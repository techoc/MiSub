/**
 * 留言板处理模块
 * 处理留言板的公开访问和管理接口
 */

import { StorageFactory } from '../../storage-adapter.ts';
import {
    createJsonResponse,
    createErrorResponse,
    JSON_BODY_LIMITS,
    readJsonWithLimit,
} from '../utils.ts';
import { sendTgNotification } from '../notifications.ts';
import { KV_KEY_GUESTBOOK, KV_KEY_SETTINGS, DEFAULT_SETTINGS } from '../config.ts';

import type { MisubSettings } from '../../../types/models.ts';

const GUESTBOOK_INDEX_KEY = `${KV_KEY_GUESTBOOK}_index`;
const GUESTBOOK_ITEM_PREFIX = `${KV_KEY_GUESTBOOK}:item:`;

/** 留言条目 */
interface GuestbookMessage {
    id: string;
    nickname: string;
    content: string;
    type: string;
    status: string;
    createdAt: string;
    isVisible: boolean;
    reply: string | null;
    replyAt: string | null;
    [key: string]: unknown;
}

/** 留言板配置 */
interface GuestbookConfig {
    enabled: boolean;
    requireAudit?: boolean;
    allowAnonymous?: boolean;
}

/** 存储适配器（工厂返回的具体实现） */
type GuestbookStorage = ReturnType<typeof StorageFactory.createAdapter>;

/** 从未知错误中提取 HTTP 状态码 */
function getErrorStatus(error: unknown): number {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === 'number' ? status : 500;
}

/**
 * 获取存储适配器实例
 */
async function getStorageAdapter(env: Env): Promise<GuestbookStorage> {
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType);
}

function getGuestbookItemKey(id: unknown): string {
    return `${GUESTBOOK_ITEM_PREFIX}${id}`;
}

async function loadGuestbookMessages(
    storageAdapter: GuestbookStorage
): Promise<GuestbookMessage[]> {
    const index = await storageAdapter.get(GUESTBOOK_INDEX_KEY);
    if (Array.isArray(index) && index.length > 0) {
        const entries = await Promise.all(
            index.map((id) => storageAdapter.get(getGuestbookItemKey(id)))
        );
        return entries.filter(Boolean) as GuestbookMessage[];
    }

    const legacy = await storageAdapter.get(KV_KEY_GUESTBOOK);
    return Array.isArray(legacy) ? (legacy as GuestbookMessage[]) : [];
}

async function persistGuestbookMessage(
    storageAdapter: GuestbookStorage,
    message: GuestbookMessage
): Promise<void> {
    const index = await storageAdapter.get(GUESTBOOK_INDEX_KEY);
    const ids: unknown[] = Array.isArray(index) ? index : [];
    if (!ids.includes(message.id)) {
        ids.push(message.id);
        await storageAdapter.put(GUESTBOOK_INDEX_KEY, ids);
    }
    await storageAdapter.put(getGuestbookItemKey(message.id), message);
}

async function removeGuestbookMessage(storageAdapter: GuestbookStorage, id: string): Promise<void> {
    const index = await storageAdapter.get(GUESTBOOK_INDEX_KEY);
    const ids = Array.isArray(index) ? index.filter((item) => item !== id) : [];
    await storageAdapter.put(GUESTBOOK_INDEX_KEY, ids);
    await storageAdapter.delete(getGuestbookItemKey(id));
}

/**
 * 获取公开留言列表
 * 仅返回 isVisible 为 true 的留言
 */
export async function handleGuestbookGet(env: Env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const [messages, rawSettings] = await Promise.all([
            loadGuestbookMessages(storageAdapter),
            storageAdapter.get(KV_KEY_SETTINGS),
        ]);
        const settings = (rawSettings || {}) as MisubSettings;

        const guestbookConfig: GuestbookConfig =
            (settings.guestbook as GuestbookConfig | undefined) || DEFAULT_SETTINGS.guestbook;

        // 如果功能未启用，返回空列表或错误状态
        if (!guestbookConfig.enabled) {
            return createJsonResponse({
                success: false,
                message: '留言板功能未启用',
                data: [],
                disabled: true,
            });
        }

        // 过滤可见消息，并在返回前移除可能的敏感字段（如果有）
        // 按时间倒序排列
        const publicMessages = messages
            .filter((msg) => msg.isVisible)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((msg) => ({
                id: msg.id,
                nickname: msg.nickname,
                content: msg.content,
                type: msg.type || 'general',
                status: msg.status, // approved, replied
                createdAt: msg.createdAt,
                reply: msg.reply,
                replyAt: msg.replyAt,
            }));

        return createJsonResponse({
            success: true,
            data: publicMessages,
            config: {
                enabled: true,
            },
        });
    } catch (e) {
        console.error('[Guestbook Error] Get:', e);
        return createErrorResponse('获取留言失败', 500);
    }
}

/**
 * 提交新留言 (Public)
 */
export async function handleGuestbookPost(request: Request, env: Env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const rawSettings = await storageAdapter.get(KV_KEY_SETTINGS);
        const settings = (rawSettings || {}) as MisubSettings;
        const guestbookConfig: GuestbookConfig =
            (settings.guestbook as GuestbookConfig | undefined) || DEFAULT_SETTINGS.guestbook;

        if (!guestbookConfig.enabled) {
            return createErrorResponse('留言板功能未启用', 403);
        }

        const body = (await readJsonWithLimit(request, JSON_BODY_LIMITS.small)) as Record<
            string,
            unknown
        >;
        const { nickname, content, type } = body;

        // 基础验证
        const contentText = typeof content === 'string' ? content : '';
        if (!contentText || contentText.trim().length === 0) {
            return createErrorResponse('留言内容不能为空', 400);
        }
        if (contentText.length > 500) {
            return createErrorResponse('留言内容过长（最大500字）', 400);
        }

        const nicknameText = typeof nickname === 'string' ? nickname.trim() : '';
        let finalNickname = nicknameText || '匿名用户';
        if (finalNickname.length > 20) {
            finalNickname = finalNickname.substring(0, 20);
        }

        // 构建新留言
        const newMessage: GuestbookMessage = {
            id: crypto.randomUUID(),
            nickname: finalNickname,
            content: contentText.trim(),
            type: typeof type === 'string' && type ? type : 'general', // general, feature, bug
            createdAt: new Date().toISOString(),
            status: 'pending',
            isVisible: !guestbookConfig.requireAudit, // 如果不需要审核，则默认可见
            reply: null,
            replyAt: null,
        };

        // 保存
        await persistGuestbookMessage(storageAdapter, newMessage);

        // 发送通知给管理员
        try {
            const messageText =
                `📝 *新留言提醒*\n\n` +
                `*用户*: ${finalNickname}\n` +
                `*类型*: ${newMessage.type}\n` +
                `*内容*: ${newMessage.content}\n` +
                `*状态*: ${newMessage.isVisible ? '🟢 已显示' : '🔴 待审核'}`;
            await sendTgNotification(settings, messageText);
        } catch (notifyError) {
            console.warn('[Guestbook] Notification failed:', notifyError);
        }

        return createJsonResponse({
            success: true,
            message: newMessage.isVisible ? '留言提交成功' : '留言提交成功，等待管理员审核',
            data: newMessage,
        });
    } catch (e) {
        console.error('[Guestbook Error] Post:', e);
        const status = getErrorStatus(e);
        return createErrorResponse(status === 413 ? (e as Error).message : '提交留言失败', status);
    }
}

/**
 * 获取管理端留言列表 (Auth Required)
 */
export async function handleGuestbookManageGet(env: Env) {
    try {
        const storageAdapter = await getStorageAdapter(env);
        const messages = await loadGuestbookMessages(storageAdapter);

        // 管理端返回所有字段，按时间倒序
        const sortedMessages = messages.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return createJsonResponse({
            success: true,
            data: sortedMessages,
        });
    } catch (e) {
        console.error('[Guestbook Manage Error] Get:', e);
        return createErrorResponse('获取留言数据失败', 500);
    }
}

/**
 * 管理操作 (Auth Required)
 * - reply: 回复
 * - delete: 删除
 * - toggle: 切换可见性
 */
export async function handleGuestbookManageAction(request: Request, env: Env) {
    try {
        const body = (await readJsonWithLimit(request, JSON_BODY_LIMITS.small)) as Record<
            string,
            unknown
        >;
        const { action, id, replyContent, status } = body; // action: 'reply' | 'delete' | 'toggle' | 'update_status'

        const storageAdapter = await getStorageAdapter(env);
        const messages = await loadGuestbookMessages(storageAdapter);

        const index = messages.findIndex((m) => m.id === id);
        if (index === -1) {
            return createErrorResponse('留言不存在', 404);
        }

        const updatedMessage = messages[index];

        if (action === 'delete') {
            messages.splice(index, 1);
            await removeGuestbookMessage(storageAdapter, String(id));
        } else if (action === 'reply') {
            updatedMessage.reply = (replyContent ?? null) as string | null;
            updatedMessage.replyAt = new Date().toISOString();
            updatedMessage.status = 'replied';
            // 自动通过审核（如果回复了肯定是要显示的）
            if (!updatedMessage.isVisible) {
                updatedMessage.isVisible = true;
            }
        } else if (action === 'toggle') {
            updatedMessage.isVisible = !updatedMessage.isVisible;
            // 如果变为可见且状态还是 pending，改为 approved
            if (updatedMessage.isVisible && updatedMessage.status === 'pending') {
                updatedMessage.status = 'approved';
            }
        } else if (action === 'status') {
            // 只更新状态，例如改为 'pending' or 'approved'
            if (status) updatedMessage.status = String(status);
        } else {
            return createErrorResponse('未知操作', 400);
        }

        if (action !== 'delete') {
            await persistGuestbookMessage(storageAdapter, updatedMessage);
        }

        return createJsonResponse({
            success: true,
            message: '操作成功',
            data: updatedMessage,
        });
    } catch (e) {
        console.error('[Guestbook Manage Error] Action:', e);
        return createErrorResponse(`操作失败: ${(e as Error).message}`, getErrorStatus(e));
    }
}
