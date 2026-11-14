/**
 * Telegram Bot API 调用：发消息、编辑消息、回调应答
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { getTelegramPushConfig } from './cache.ts';

// ==================== Telegram API ====================

/**
 * 发送 Telegram 消息
 */
export async function sendTelegramMessage(chatId, text, env, options: Record<string, any> = {}) {
    try {
        const config = await getTelegramPushConfig(env, options.requestCache || null);
        if (!config.bot_token) {
            console.error('[Telegram Push] Bot token not configured');
            return;
        }

        const body = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            ...options,
        };

        const response = await fetch(
            `https://api.telegram.org/bot${config.bot_token}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            console.error('[Telegram Push] Failed to send message:', await response.clone().text());
        }

        return response;
    } catch (error) {
        console.error('[Telegram Push] Error sending message:', error);
    }
}

/**
 * 编辑 Telegram 消息
 */
export async function editTelegramMessage(
    chatId,
    messageId,
    text,
    env,
    options: Record<string, any> = {}
) {
    try {
        const config = await getTelegramPushConfig(env, options.requestCache || null);
        if (!config.bot_token) return;

        const body = {
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML',
            ...options,
        };

        await fetch(`https://api.telegram.org/bot${config.bot_token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (error) {
        console.error('[Telegram Push] Error editing message:', error);
    }
}

/**
 * 回答 Callback Query
 */
export async function answerCallbackQuery(callbackQueryId, text, env, showAlert = false) {
    try {
        const config = await getTelegramPushConfig(env);
        if (!config.bot_token) return;

        await fetch(`https://api.telegram.org/bot${config.bot_token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text,
                show_alert: showAlert,
            }),
        });
    } catch (error) {
        console.error('[Telegram Push] Error answering callback:', error);
    }
}
