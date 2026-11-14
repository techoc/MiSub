/**
 * 用户访问控制：webhook 验签、用户权限、频率限制、用户绑定与节点读取
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { getStorageAdapter, getTelegramPushConfig } from './cache.ts';
import type { ProfileItem, SubscriptionItem } from '../../../../types/models.ts';

/** Telegram 推送配置（getTelegramPushConfig 的产物形状） */
interface TelegramPushConfig {
    enabled?: boolean;
    bot_token?: string;
    webhook_secret?: string;
    allowed_user_ids?: unknown[];
    allow_all_users?: boolean;
    rate_limit?: { max_per_minute?: number; max_per_day?: number };
    default_profile_id?: string;
    auto_bind?: boolean;
    user_bindings?: Record<string, string>;
}

/** 权限检查结果 */
interface PermissionResult {
    allowed: boolean;
    reason?: string;
}

/** 用户节点读取用到的存储适配器最小面 */
interface TelegramStorageAdapter {
    getAllSubscriptions(): Promise<SubscriptionItem[]>;
    putAllSubscriptions(items: SubscriptionItem[]): Promise<unknown>;
    getAllProfiles(): Promise<ProfileItem[]>;
    putAllProfiles(profiles: ProfileItem[]): Promise<unknown>;
}

/** getNodesWithMapping 的返回结构 */
export interface TelegramNodesContext {
    allSubscriptions: SubscriptionItem[];
    userNodes: SubscriptionItem[];
    indexMapping: number[];
    storageAdapter: TelegramStorageAdapter;
}

// ==================== 验证函数 ====================

/**
 * 验证 Telegram Webhook 请求
 */
export function verifyTelegramRequest(request: Request, config: TelegramPushConfig): boolean {
    const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    return secretToken === config.webhook_secret;
}

function getUserBindingKey(userId: unknown): string {
    return String(userId ?? '').trim();
}

export function getUserBoundProfileId(config: TelegramPushConfig, userId: unknown): string {
    const bindingKey = getUserBindingKey(userId);
    const bindings = config?.user_bindings || {};

    if (bindingKey && Object.prototype.hasOwnProperty.call(bindings, bindingKey)) {
        return bindings[bindingKey] || '';
    }

    if (config?.auto_bind && config?.default_profile_id) {
        return config.default_profile_id;
    }

    return '';
}

export function setUserBoundProfileId(
    config: TelegramPushConfig,
    userId: unknown,
    profileId: string
) {
    const bindingKey = getUserBindingKey(userId);
    const bindings =
        config.user_bindings && typeof config.user_bindings === 'object'
            ? { ...config.user_bindings }
            : {};

    if (bindingKey) {
        bindings[bindingKey] = profileId || '';
    }

    config.user_bindings = bindings;
}

/**
 * 检查用户权限
 */
export function checkUserPermission(userId: unknown, config: TelegramPushConfig): PermissionResult {
    if (!config.enabled) {
        return { allowed: false, reason: 'Bot 已被管理员禁用' };
    }

    if (config.allow_all_users) {
        return { allowed: true };
    }

    if (!config.allowed_user_ids || config.allowed_user_ids.length === 0) {
        return {
            allowed: false,
            reason: '未配置白名单，请先在设置中添加允许用户或显式开启公开访问',
        };
    }

    const userIdStr = String(userId);
    if (!config.allowed_user_ids.some((id) => String(id).trim() === userIdStr)) {
        return { allowed: false, reason: '无权限使用此 Bot，请联系管理员添加白名单' };
    }

    return { allowed: true };
}

/**
 * 检查频率限制
 */
export async function checkRateLimit(
    userId: unknown,
    env: Env,
    config: TelegramPushConfig
): Promise<PermissionResult> {
    const minuteKey = `tg_push_rate:${userId}:min`;
    const dayKey = `tg_push_rate:${userId}:day`;

    const kv = env?.MISUB_KV || null;
    if (!kv) return { allowed: true }; // 无 KV 时不限流

    const minuteCount = parseInt((await kv.get(minuteKey)) || '0');
    const dayCount = parseInt((await kv.get(dayKey)) || '0');

    const maxPerMinute = config.rate_limit?.max_per_minute ?? Infinity;
    const maxPerDay = config.rate_limit?.max_per_day ?? Infinity;
    if (minuteCount >= maxPerMinute) {
        return {
            allowed: false,
            reason: `操作过快，请1分钟后再试（${maxPerMinute}/分钟）`,
        };
    }

    if (dayCount >= maxPerDay) {
        return { allowed: false, reason: `今日配额已用完（${maxPerDay}/天）` };
    }

    await kv.put(minuteKey, (minuteCount + 1).toString(), { expirationTtl: 60 });
    await kv.put(dayKey, (dayCount + 1).toString(), { expirationTtl: 86400 });

    return { allowed: true };
}

// ==================== 获取用户节点 ====================

/**
 * 获取用户通过 Telegram 添加的节点
 */
export async function getUserNodes(userId: string | number, env: Env): Promise<SubscriptionItem[]> {
    const storageAdapter = (await getStorageAdapter(env)) as TelegramStorageAdapter;
    const allSubscriptions = await storageAdapter.getAllSubscriptions();

    // 检查用户是否在白名单中
    const config = await getTelegramPushConfig(env);
    const permission = checkUserPermission(userId, config);

    // 如果用户有权限（白名单用户），则显示所有节点（包括 Web 端添加的）
    if (permission.allowed) {
        return allSubscriptions;
    }

    // 否则仅返回该用户通过 Telegram 添加的节点（兜底逻辑）
    return allSubscriptions.filter(
        (sub) => sub.source === 'telegram' && sub.telegram_user_id === userId
    );
}

/**
 * 获取所有节点和用户节点的索引映射
 */
export async function getNodesWithMapping(
    userId: string | number,
    env: Env
): Promise<TelegramNodesContext> {
    const storageAdapter = (await getStorageAdapter(env)) as TelegramStorageAdapter;
    const allSubscriptions = await storageAdapter.getAllSubscriptions();

    const config = await getTelegramPushConfig(env);
    const permission = checkUserPermission(userId, config);

    const userNodes: SubscriptionItem[] = [];
    const indexMapping: number[] = []; // userIndex -> allIndex

    allSubscriptions.forEach((sub, allIndex) => {
        if (permission.allowed || (sub.source === 'telegram' && sub.telegram_user_id === userId)) {
            indexMapping.push(allIndex);
            userNodes.push(sub);
        }
    });

    return { allSubscriptions, userNodes, indexMapping, storageAdapter };
}
