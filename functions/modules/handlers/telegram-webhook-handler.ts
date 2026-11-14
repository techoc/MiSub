/**
 * Telegram Bot Webhook 处理模块 v2
 * 用于接收和处理用户通过 Telegram 推送的节点
 *
 * 支持的命令：
 * /start - 欢迎信息
 * /help - 帮助信息
 * /menu - 快捷菜单
 * /list - 节点列表（带分页）
 * /stats - 统计信息
 * /search - 搜索节点
 * /delete - 删除节点
 * /enable - 启用节点
 * /disable - 禁用节点
 * /rename - 重命名节点
 * /sub - 获取订阅链接
 * /info - 节点详情
 * /copy - 复制节点链接
 * /sort - 节点排序
 * /dup - 去重检测
 * /bind - 绑定订阅组
 * /unbind - 解除绑定
 * 模块已按职责拆分至 ./telegram-webhook/ 子目录（存储缓存、文本解析、
 * 文件导入、分组管理、Bot API、访问控制、命令组、路由、回调），本文件
 * 保留 webhook 入口 handleTelegramWebhook。
 */
import { JSON_BODY_LIMITS, createJsonResponse, readJsonWithLimit } from '../utils.ts';
import { answerCallbackQuery, sendTelegramMessage } from './telegram-webhook/telegram-api.ts';
import { createRequestCache, getTelegramPushConfig } from './telegram-webhook/cache.ts';
import { checkUserPermission, verifyTelegramRequest } from './telegram-webhook/user-access.ts';
import { handleFileInput } from './telegram-webhook/file-input.ts';
import { handleNodeInput } from './telegram-webhook/node-input.ts';
import { handleCommand } from './telegram-webhook/dispatch.ts';
import { handleCallbackQuery } from './telegram-webhook/callback.ts';

// ==================== 主 Webhook 处理 ====================

/**
 * 主 Webhook 处理函数
 */
export async function handleTelegramWebhook(request, env) {
    try {
        const requestCache = createRequestCache();
        // 获取配置
        const config = await getTelegramPushConfig(env, requestCache);

        if (!config.enabled) {
            return createJsonResponse({ error: 'Bot disabled' }, 403);
        }

        // 验证请求来源
        if (!config.webhook_secret) {
            console.error('[Telegram Push] Missing webhook secret');
            return createJsonResponse({ error: 'Webhook secret required' }, 503);
        }

        if (!verifyTelegramRequest(request, config)) {
            console.error('[Telegram Push] Invalid webhook secret');
            return createJsonResponse({ error: 'Unauthorized' }, 401);
        }

        // 解析 Telegram Update
        const update = await readJsonWithLimit(request, JSON_BODY_LIMITS.small);

        // 处理 Callback Query（按钮回调）
        if (update.callback_query) {
            const userId = update.callback_query.from.id;
            const permissionCheck = checkUserPermission(userId, config);
            if (!permissionCheck.allowed) {
                await answerCallbackQuery(
                    update.callback_query.id,
                    permissionCheck.reason,
                    env,
                    true
                );
                return createJsonResponse({ ok: true });
            }
            return await handleCallbackQuery(update.callback_query, env, request, requestCache);
        }

        // 处理普通消息
        if (update.message) {
            const message = update.message;
            const userId = message.from.id;
            const chatId = message.chat.id;
            const text = message.text;

            // 检查用户权限（文件消息同样需要鉴权）
            const permissionCheck = checkUserPermission(userId, config);
            if (!permissionCheck.allowed) {
                await sendTelegramMessage(chatId, `❌ ${permissionCheck.reason}`, env);
                return createJsonResponse({ ok: true });
            }

            // 文件/文档消息：下载内容后走与文本相同的导入流程
            if (!text && (message.document || message.photo)) {
                return await handleFileInput(chatId, message, userId, config, env, requestCache);
            }

            if (!text) {
                return createJsonResponse({ ok: true });
            }

            // 处理命令或节点输入
            if (text.startsWith('/')) {
                return await handleCommand(chatId, text, userId, env, request, requestCache);
            } else {
                return await handleNodeInput(chatId, text, userId, env, requestCache);
            }
        }

        // 忽略其他类型的更新
        return createJsonResponse({ ok: true });
    } catch (error) {
        console.error('[Telegram Push] Webhook handler error:', error);
        return createJsonResponse(
            { error: error.status === 413 ? error.message : 'Internal server error' },
            error.status || 500
        );
    }
}
