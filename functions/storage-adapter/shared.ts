/**
 * 存储层共享常量与基础工具。
 * 从 storage-adapter.js（facade）拆分而来；适配器与工厂见同级子模块。
 */

export const STORAGE_TYPES = {
    KV: 'kv',
    D1: 'd1',
};

// 数据键映射
export const DATA_KEYS = {
    SUBSCRIPTIONS: 'misub_subscriptions_v1',
    PROFILES: 'misub_profiles_v1',
    SETTINGS: 'worker_settings_v1',
    PROFILE_DOWNLOAD_COUNT_PREFIX: 'misub_profile_download_count_',
};

const D1_COLLECTION_CACHE_TTL_MS = 30 * 1000;

/** 单个 D1 database 上的集合缓存条目 */
interface D1CollectionCacheEntry {
    timestamp: number;
    promise: Promise<unknown>;
}

const d1CollectionCaches = new WeakMap<object, Map<string, D1CollectionCacheEntry>>();

function getD1CollectionCache(database: object): Map<string, D1CollectionCacheEntry> {
    let cache = d1CollectionCaches.get(database);
    if (!cache) {
        cache = new Map();
        d1CollectionCaches.set(database, cache);
    }
    return cache;
}

export function invalidateD1CollectionCache(database: object, table: string): void {
    getD1CollectionCache(database).delete(table);
}

export async function readCachedD1Collection<T>(
    database: object,
    table: string,
    loader: () => Promise<T>
): Promise<T> {
    const cache = getD1CollectionCache(database);
    const now = Date.now();
    const existing = cache.get(table);
    if (existing && now - existing.timestamp < D1_COLLECTION_CACHE_TTL_MS) {
        return structuredClone(await existing.promise) as T;
    }

    const promise = Promise.resolve().then(loader);
    cache.set(table, { timestamp: now, promise });
    try {
        return structuredClone(await promise);
    } catch (error) {
        if (cache.get(table)?.promise === promise) cache.delete(table);
        throw error;
    }
}

const D1_SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_at ON subscriptions(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);`,
];

/**
 * 以 settings 表为家的已知业务键。
 * D1StorageAdapter._parseKey 靠它区分「预期的业务键」与「真正的未知 key」，
 * 后者才告警。与 D1_MIGRATION_KEYS 保持一致。
 */
export const D1_KNOWN_SETTINGS_KEYS = new Set([
    'misub_dns_templates_v1',
    'misub_rule_templates_v1',
    'misub_clients_v1',
    'misub_guestbook_v1',
    'misub_settings_v1',
    'misub_restore_snapshot_latest',
]);

/**
 * 以 settings 表为家的业务键前缀（非 misub_*_v1 形式）。
 *
 * 这些键在生产路径高频读写（节点缓存）或按设计落在 settings 表（诊断日志、
 * 备份互斥锁、遗留数据），不应触发「未知 key 格式」告警——否则真正的异常键
 * 会被噪声淹没。
 */
export const D1_KNOWN_SETTINGS_PREFIXES = [
    'node_cache_',
    'misub_system_logs',
    'misub_error_reports',
    'misub_webdav_backup_lock',
    'misub_data_v1',
];

export async function ensureD1Schema(d1Db: D1Database): Promise<void> {
    for (const statement of D1_SCHEMA_STATEMENTS) {
        await d1Db.prepare(statement).run();
    }
}

/**
 * 判断一个值是否像 KV namespace（有 get/put/delete 方法）
 */
function isKVNamespace(val: unknown): val is KVNamespace {
    const record = val as Record<string, unknown> | null;
    return (
        !!record &&
        typeof record === 'object' &&
        typeof record.get === 'function' &&
        typeof record.put === 'function' &&
        typeof record.delete === 'function'
    );
}

/**
 * 解析 KV 命名空间。
 * 优先读取 Cloudflare Pages 的 env 绑定，并兼容其他 env 中的 KV 绑定。
 * @param {Object} env
 * @returns {Object|null}
 */
export function resolveKV(env: unknown): KVNamespace | null {
    const envRecord = (env || {}) as Record<string, unknown>;

    // 1. Cloudflare Pages 方式：env.MISUB_KV
    if (isKVNamespace(envRecord.MISUB_KV)) return envRecord.MISUB_KV;

    // 2. 自动探测 env 中其他 KV 绑定（仅允许变量名包含 KV，避免误识别）
    for (const key of Object.keys(envRecord)) {
        if (!String(key).toUpperCase().includes('KV')) continue;
        if (isKVNamespace(envRecord[key])) {
            console.log(`[Storage] Auto-detected KV in env: ${key}`);
            return envRecord[key];
        }
    }

    return null;
}
