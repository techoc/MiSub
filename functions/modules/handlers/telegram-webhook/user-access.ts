/**
 * 用户访问控制：webhook 验签、用户权限、频率限制、用户绑定与节点读取
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { getStorageAdapter, getTelegramPushConfig } from './cache.ts';

// ==================== 验证函数 ====================

/**
 * 验证 Telegram Webhook 请求
 */
export function verifyTelegramRequest(request, config) {
    const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    return secretToken === config.webhook_secret;
}

function getUserBindingKey(userId) {
    return userId?.toString().trim();
}

export function getUserBoundProfileId(config, userId) {
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

export function setUserBoundProfileId(config, userId, profileId) {
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
export function checkUserPermission(userId, config) {
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

    const userIdStr = userId.toString();
    if (!config.allowed_user_ids.some((id) => id.toString().trim() === userIdStr)) {
        return { allowed: false, reason: '无权限使用此 Bot，请联系管理员添加白名单' };
    }

    return { allowed: true };
}

/**
 * 检查频率限制
 */
export async function checkRateLimit(userId, env, config) {
    const minuteKey = `tg_push_rate:${userId}:min`;
    const dayKey = `tg_push_rate:${userId}:day`;

    const kv = env?.MISUB_KV || null;
    if (!kv) return { allowed: true }; // 无 KV 时不限流

    const minuteCount = parseInt((await kv.get(minuteKey)) || '0');
    const dayCount = parseInt((await kv.get(dayKey)) || '0');

    if (minuteCount >= config.rate_limit.max_per_minute) {
        return {
            allowed: false,
            reason: `操作过快，请1分钟后再试（${config.rate_limit.max_per_minute}/分钟）`,
        };
    }

    if (dayCount >= config.rate_limit.max_per_day) {
        return { allowed: false, reason: `今日配额已用完（${config.rate_limit.max_per_day}/天）` };
    }

    await kv.put(minuteKey, (minuteCount + 1).toString(), { expirationTtl: 60 });
    await kv.put(dayKey, (dayCount + 1).toString(), { expirationTtl: 86400 });

    return { allowed: true };
}

// ==================== 获取用户节点 ====================

/**
 * 获取用户通过 Telegram 添加的节点
 */
export async function getUserNodes(userId, env) {
    const storageAdapter = await getStorageAdapter(env);
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
export async function getNodesWithMapping(userId, env) {
    const storageAdapter = await getStorageAdapter(env);
    const allSubscriptions = await storageAdapter.getAllSubscriptions();

    const config = await getTelegramPushConfig(env);
    const permission = checkUserPermission(userId, config);

    const userNodes: any[] = [];
    const indexMapping: any[] = []; // userIndex -> allIndex

    allSubscriptions.forEach((sub, allIndex) => {
        if (permission.allowed || (sub.source === 'telegram' && sub.telegram_user_id === userId)) {
            indexMapping.push(allIndex);
            userNodes.push(sub);
        }
    });

    return { allSubscriptions, userNodes, indexMapping, storageAdapter };
}
