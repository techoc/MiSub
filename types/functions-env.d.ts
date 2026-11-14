/**
 * Cloudflare Pages Functions 环境类型（ambient declarations）。
 *
 * @cloudflare/workers-types 提供 KVNamespace/D1Database/Fetcher 等运行时类型，
 * 但不包含 Pages 的 EventContext / Env 包装；这里按官方 Pages 文档的形状
 * 声明最小接口，供 functions/ 下的 TS 模块使用。
 */

import type { D1Database, Fetcher, KVNamespace } from '@cloudflare/workers-types';

declare global {
    interface Env {
        /** 必需：主 KV 命名空间 */
        MISUB_KV: KVNamespace;
        /** 可选：D1 数据库（storage-adapter 按设置选择） */
        MISUB_DB?: D1Database;
        /** Pages 静态资源绑定 */
        ASSETS: Fetcher;
        /** 测试注入：强制指定 storage adapter 类型（kv / d1 / noop） */
        __TEST_STORAGE_ADAPTER?: string;

        ADMIN_PASSWORD?: string;
        COOKIE_SECRET?: string;
        CRON_SECRET?: string;
        CORS_ORIGINS?: string;
        MISUB_PUBLIC_URL?: string;
        MISUB_CALLBACK_URL?: string;

        TELEGRAM_BOT_TOKEN?: string;
        TELEGRAM_CHAT_ID?: string;
        TELEGRAM_PUSH_BOT_TOKEN?: string;
        TELEGRAM_PUSH_WEBHOOK_SECRET?: string;
        TELEGRAM_PUSH_ALLOWED_USERS?: string;

        CRON_TYPE?: string;
        ENABLE_CRON?: string;
        CRON_SYNC_TIMEOUT?: string;
        CRON_MAX_SYNC_COUNT?: string;
        CRON_ENABLE_PARALLEL?: string;

        [key: string]: unknown;
    }

    /**
     * Pages Functions 请求上下文简写。
     * 底层形状来自 @cloudflare/workers-types 自带的
     * `EventContext<Env, P, Data>`（type alias），这里固定泛型参数方便使用；
     * 不要再声明同名 interface——会与该 type alias 冲突。
     */
    type PagesEventContext = EventContext<Env, string, Record<string, unknown>>;
}

export {};
