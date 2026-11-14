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

    /** Cloudflare Pages Functions 请求上下文（官方 EventContext 的最小镜像） */
    interface EventContext<
        E = Env,
        Params extends string = string,
        Data extends Record<string, unknown> = Record<string, unknown>,
    > {
        request: Request;
        function: string;
        waitUntil: (promise: Promise<unknown>) => void;
        passThroughOnException: () => void;
        next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
        params: Params extends string
            ? Record<Params, string | string[]>
            : Record<string, string | string[]>;
        env: E;
        data: Data;
    }
}

export {};
