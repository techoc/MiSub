/**
 * 带内存缓存的设置读取（facade 拆分：原 storage-adapter.js 的 SettingsCache）。
 */

import { DATA_KEYS, resolveKV } from './shared.ts';
import { D1StorageAdapter } from './d1-adapter.ts';

let _globalSettingsCache = {
    data: null,
    timestamp: 0,
};
const SETTINGS_CACHE_TTL_MS = 10 * 1000; // 10秒缓存过时

/**
 * adapter 作用域的 settings memo：按底层绑定（KV namespace / D1 database）
 * 缓存，同一 isolate 内 10 秒窗口内的重复 settings 读取不再打存储。
 * 与模块级 _globalSettingsCache 分开：env 直读路径和 adapter 路径的数据源
 * 可能不同（双存储迁移残留），不能互相污染。
 * 用普通 Map（而非 WeakMap）以便 clear() 能一并失效；键是 env 绑定对象，
 * 在 isolate 生命周期内稳定，不会累积。
 */
const adapterSettingsMemos = new Map();

export class SettingsCache {
    /**
     * 带内存缓存的设置读取
     *
     * @param {Object} env - Cloudflare 环境
     * @param {Object} [adapter] - 可选：当前请求的存储适配器。传入时按其底层
     *   绑定做 memo，且只信任 adapter 读取结果（保证与 storageType 一致的数据源）。
     */
    static async get(env, adapter = null) {
        const now = Date.now();
        if (adapter) {
            const scope = adapter.kv || adapter.db || null;
            let settings = null;
            if (scope) {
                const memo = adapterSettingsMemos.get(scope);
                if (memo && now - memo.timestamp < SETTINGS_CACHE_TTL_MS) {
                    return memo.data;
                }
            }
            if (typeof adapter.get === 'function') {
                try {
                    settings = await adapter.get(DATA_KEYS.SETTINGS);
                } catch (adapterError) {
                    console.warn('[Storage Cache] Adapter read failed:', adapterError.message);
                }
            }
            if (settings && scope) {
                adapterSettingsMemos.set(scope, { data: settings, timestamp: now });
            }
            return settings || null;
        }

        if (
            _globalSettingsCache.data &&
            now - _globalSettingsCache.timestamp < SETTINGS_CACHE_TTL_MS
        ) {
            return _globalSettingsCache.data;
        }

        try {
            let settings = null;
            if (env.MISUB_DB) {
                try {
                    const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
                    settings = await d1Adapter.get(DATA_KEYS.SETTINGS);
                } catch (d1Error) {
                    console.warn('[Storage Cache] Failed to read from D1:', d1Error.message);
                }
            }

            const kvNs = resolveKV(env);
            if (!settings && kvNs) {
                try {
                    const raw = await kvNs.get(DATA_KEYS.SETTINGS);
                    settings = raw ? JSON.parse(raw) : null;
                } catch (kvError) {
                    console.warn('[Storage Cache] Failed to read from KV:', kvError.message);
                }
            }

            if (settings) {
                _globalSettingsCache.data = settings;
                _globalSettingsCache.timestamp = now;
                return settings;
            }
        } catch (error) {
            console.error('[Storage Cache] Failed to read settings:', error);
        }

        return null;
    }

    /**
     * 在更新设置后主动清除缓存
     */
    static clear() {
        _globalSettingsCache = { data: null, timestamp: 0 };
        for (const memo of adapterSettingsMemos.values()) {
            memo.timestamp = 0;
        }
    }
}
