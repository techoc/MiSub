/**
 * 存储工厂（facade 拆分：原 storage-adapter.js 的 StorageFactory）。
 */

import { DATA_KEYS, STORAGE_TYPES, resolveKV } from './shared.js';
import { KVStorageAdapter } from './kv-adapter.js';
import { D1StorageAdapter } from './d1-adapter.js';
import { NoopStorageAdapter } from './noop-adapter.js';
import { SettingsCache } from './settings-cache.js';

/**
 * 存储工厂类
 * 根据配置创建相应的存储适配器
 */
export class StorageFactory {
    /**
     * 解析 KV 命名空间（委托顶层函数）
     */
    static resolveKV(env) {
        return resolveKV(env);
    }

    /**
     * 创建存储适配器
     * @param {Object} env - Cloudflare 环境对象
     * @param {string} storageType - 存储类型 ('kv' | 'd1')
     * @returns {KVStorageAdapter|D1StorageAdapter}
     */
    static createAdapter(env, storageType = STORAGE_TYPES.KV) {
        switch (storageType) {
            case STORAGE_TYPES.D1:
                if (!env.MISUB_DB) {
                    console.warn('[Storage] D1 database not available, falling back to KV');
                    const kvFallback = StorageFactory.resolveKV(env);
                    if (!kvFallback) {
                        console.warn('[Storage] KV not available either, using noop adapter');
                        return new NoopStorageAdapter();
                    }
                    return new KVStorageAdapter(kvFallback);
                }
                return new D1StorageAdapter(env.MISUB_DB);

            case STORAGE_TYPES.KV:
            default: {
                const kv = StorageFactory.resolveKV(env);
                if (!kv) {
                    console.warn('[Storage] No KV binding found, using noop adapter');
                    return new NoopStorageAdapter();
                }
                return new KVStorageAdapter(kv);
            }
        }
    }

    /**
     * 获取当前存储类型设置
     * @param {Object} env - Cloudflare 环境对象
     * @returns {Promise<string>} 存储类型
     */
    static async getStorageType(env) {
        try {
            const settings = await SettingsCache.get(env);
            if (settings?.storageType) {
                return settings.storageType;
            }
            return STORAGE_TYPES.KV;
        } catch (error) {
            console.error('[Storage] Failed to get storage type:', error);
            return STORAGE_TYPES.KV;
        }
    }

    /**
     * 将 KV Settings 同步到 D1（当 D1 为空时）
     */
    static async ensureD1Settings(env) {
        if (!env?.MISUB_DB) return false;
        try {
            const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
            const existing = await d1Adapter.get(DATA_KEYS.SETTINGS);
            if (existing) return true;
            const kvNs = resolveKV(env);
            if (!kvNs) return false;
            const raw = await kvNs.get(DATA_KEYS.SETTINGS);
            if (!raw) return false;
            const settings = JSON.parse(raw);
            if (settings?.storageType !== STORAGE_TYPES.D1) {
                settings.storageType = STORAGE_TYPES.D1;
            }
            await d1Adapter.put(DATA_KEYS.SETTINGS, settings);
            return true;
        } catch (error) {
            console.warn('[Storage] ensureD1Settings failed:', error?.message || error);
            return false;
        }
    }

    /**
     * 检查是否配置了双重存储
     * @param {Object} env - Cloudflare环境对象
     * @returns {boolean} 是否配置了双重存储
     */
    static hasDualStorage(env) {
        return !!(StorageFactory.resolveKV(env) && env.MISUB_DB);
    }
}
