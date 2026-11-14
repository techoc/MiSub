/**
 * Telegram 文件/文档消息导入：下载文件内容后复用文本导入链路
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

import { createJsonResponse } from '../../utils.ts';
import { extractValidNodes } from '../../utils/node-parser.ts';
import { extractSubscriptionUrls } from './message-text.ts';
import { handleNodeInput } from './node-input.ts';
import { sendTelegramMessage } from './telegram-api.ts';

import type { KvRecord } from '../../../../types/models.ts';

/** Telegram 单文件下载大小上限（字节），防止大文件拖垮 Worker */
const TG_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** 文件/照片附件的公共字段 */
interface TelegramFileDoc {
    file_id?: string;
    file_name?: string;
    file_size?: number;
}

/** Telegram message（仅声明本模块用到的字段） */
interface TelegramFileMessage {
    document?: TelegramFileDoc | null;
    photo?: TelegramFileDoc[] | null;
}

/** getFile 响应 */
interface TelegramFileResponse {
    ok?: boolean;
    result?: { file_path?: string };
}

/** 机器人配置（需含 bot_token） */
interface TelegramFileConfig {
    bot_token?: string;
}

/**
 * 下载 Telegram 消息中的文件/文档内容。
 *
 * 流程：getFile 拿 file_path → 从 file 接口拉取正文。
 * 复用配置里的 bot token，与 webhook 同一来源。
 *
 * @param {Object} message Telegram message 对象
 * @param {Object} config  机器人配置（需含 bot_token）
 * @returns {Promise<{text: string, fileName: string}>}
 */
async function downloadTelegramFile(
    message: TelegramFileMessage | null | undefined,
    config: TelegramFileConfig
): Promise<{ text: string; fileName: string }> {
    const doc =
        message?.document || (message?.photo ? message.photo[message.photo.length - 1] : null);
    if (!doc) return { text: '', fileName: '' };

    // 体积限制
    const size = Number(doc.file_size || 0);
    if (size > TG_MAX_FILE_BYTES) {
        throw new Error(`文件过大（${(size / 1024 / 1024).toFixed(1)}MB），上限 5MB`);
    }

    const token = config.bot_token;
    if (!token) throw new Error('未配置 Bot Token');

    // 1. getFile
    const fileRes = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(String(doc.file_id || ''))}`
    );
    const fileData = (await fileRes.json()) as TelegramFileResponse | null;
    const filePath = fileData?.result?.file_path;
    if (!fileData?.ok || !filePath) {
        throw new Error('获取文件路径失败（文件可能已过期）');
    }

    // 2. 下载正文
    const contentRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!contentRes.ok) {
        throw new Error(`下载文件失败（HTTP ${contentRes.status}）`);
    }

    const text = await contentRes.text();
    return {
        text,
        fileName: doc.file_name || filePath.split('/').pop() || 'file',
    };
}

/**
 * 处理 Telegram 文件消息：下载文件 → 提取节点/订阅链接 → 导入。
 *
 * 复用 handleNodeInput 的处理链路：把文件内容当作「用户发送的文本」交给它，
 * 因此订阅链接、节点链接、Clash YAML、sing-box JSON 等全部格式都自动支持。
 *
 * @param {number} chatId
 * @param {Object} message  Telegram message（含 document/photo）
 * @param {number} userId
 * @param {Object} config
 * @param {Object} env
 * @param {Object|null} requestCache
 */
export async function handleFileInput(
    chatId: string | number,
    message: TelegramFileMessage | null | undefined,
    userId: string | number,
    config: TelegramFileConfig,
    env: Env,
    requestCache: KvRecord | null = null
) {
    try {
        await sendTelegramMessage(chatId, '📥 正在读取文件…', env);

        const { text, fileName } = await downloadTelegramFile(message, config);
        if (!text || !text.trim()) {
            await sendTelegramMessage(chatId, '❌ 文件内容为空', env);
            return createJsonResponse({ ok: true });
        }

        // 优先按「解析出节点」处理；若文件里是订阅链接，则由 handleNodeInput 识别
        const nodes: unknown[] = extractValidNodes(text);
        if (nodes.length > 0) {
            // extractValidNodes 返回节点链接字符串数组
            const nodeLines = nodes
                .map((n) =>
                    typeof n === 'string' ? n : String((n as { url?: unknown } | null)?.url || '')
                )
                .filter(Boolean)
                .join('\n');
            await sendTelegramMessage(
                chatId,
                `📄 解析文件 <b>${fileName}</b>，识别到 <b>${nodes.length}</b> 个节点，正在导入…`,
                env
            );
            return await handleNodeInput(chatId, nodeLines, userId, env, requestCache, {
                source: 'file',
                fileName,
            });
        }

        // 没有节点：可能是订阅链接列表
        const subs = extractSubscriptionUrls(text);
        if (subs.length > 0) {
            await sendTelegramMessage(
                chatId,
                `📄 解析文件 <b>${fileName}</b>，识别到 <b>${subs.length}</b> 个订阅链接，正在导入…`,
                env
            );
            return await handleNodeInput(chatId, subs.join('\n'), userId, env, requestCache, {
                source: 'file',
                fileName,
            });
        }

        await sendTelegramMessage(
            chatId,
            `❌ 未能从文件 <b>${fileName}</b> 中识别到节点或订阅链接\n\n` +
                '支持的格式：\n' +
                '1. 节点链接文本（每行一个）\n' +
                '2. Base64 订阅内容\n' +
                '3. Clash / Mihomo YAML\n' +
                '4. sing-box JSON',
            env
        );
        return createJsonResponse({ ok: true });
    } catch (error) {
        console.error('[Telegram Push] File handling error:', error);
        await sendTelegramMessage(chatId, `❌ 处理文件失败：${(error as Error).message}`, env);
        return createJsonResponse({ ok: true });
    }
}
