/**
 * KV → D1 数据迁移（facade 拆分：原 storage-adapter.js 的 DataMigrator）。
 */

import {
    DATA_KEYS,
    STORAGE_TYPES,
    resolveKV,
    ensureD1Schema,
    invalidateD1CollectionCache,
} from './shared.ts';
import { KVStorageAdapter } from './kv-adapter.ts';
import { D1StorageAdapter } from './d1-adapter.ts';

/**
 * KV → D1 需要搬运的业务键。
 *
 * 原实现只搬 subscriptions / profiles / settings 三个键，其余业务数据（DNS 模板、
 * 规则模板、客户端、留言板……）留在 KV 里，迁移后按 storageType='d1' 读就全成空，
 * 而接口仍返回「数据已成功迁移」。用户照官方引导解绑 KV 后就再也取不回。
 *
 * 刻意不搬的键，各有原因：
 *   misub_webdav_backup_lock  —— 定时任务互斥锁，搬一个过期锁过去会挡住下次备份
 *   misub_system_logs         —— 诊断日志，体积可能很大，非业务数据
 *   misub_error_reports       —— 同上
 *   misub_data_v1             —— 更早的遗留格式，由 api-router 的独立升级路径处理
 */
export const D1_MIGRATION_KEYS = [
    DATA_KEYS.SUBSCRIPTIONS,
    DATA_KEYS.PROFILES,
    'misub_dns_templates_v1',
    'misub_rule_templates_v1',
    'misub_clients_v1',
    'misub_guestbook_v1',
    'misub_settings_v1',
    'misub_restore_snapshot_latest',
];

/** 需要按前缀枚举后逐条搬运的键 */
export const D1_MIGRATION_KEY_PREFIXES = [DATA_KEYS.PROFILE_DOWNLOAD_COUNT_PREFIX];

/**
 * 数据迁移工具
 */
export class DataMigrator {
    /**
     * 从 KV 迁移到 D1
     * @param {Object} env - Cloudflare 环境对象
     * @returns {Promise<Object>} 迁移结果
     */
    static async migrateKVToD1(env) {
        try {
            const kvNs = resolveKV(env);
            if (!kvNs) throw new Error('No KV binding found');
            const kvAdapter = new KVStorageAdapter(kvNs);
            const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
            await ensureD1Schema(d1Adapter.db);

            // keys: 逐键结果，'migrated' | 'empty' | 'failed'
            const results = {
                subscriptions: false,
                profiles: false,
                settings: false,
                keys: {},
                errors: [],
            };

            const copyKey = async (key) => {
                try {
                    const value = await kvAdapter.get(key);
                    if (value === null || value === undefined) {
                        results.keys[key] = 'empty';
                        return false;
                    }
                    await d1Adapter.put(key, value);
                    results.keys[key] = 'migrated';
                    return true;
                } catch (error) {
                    results.keys[key] = 'failed';
                    results.errors.push(`${key} 迁移失败: ${error.message}`);
                    return false;
                }
            };

            for (const key of D1_MIGRATION_KEYS) {
                const ok = await copyKey(key);
                if (key === DATA_KEYS.SUBSCRIPTIONS) results.subscriptions = ok;
                if (key === DATA_KEYS.PROFILES) results.profiles = ok;
            }

            // 前缀键：先枚举再逐条搬
            for (const prefix of D1_MIGRATION_KEY_PREFIXES) {
                try {
                    const listed = await kvAdapter.list(prefix);
                    for (const entry of listed) {
                        const key = typeof entry === 'string' ? entry : entry?.name;
                        if (key) await copyKey(key);
                    }
                } catch (error) {
                    results.errors.push(`前缀 ${prefix} 枚举失败: ${error.message}`);
                }
            }

            // settings 放在最后：storageType 要在其余数据都就位之后才翻成 d1，
            // 否则中途失败会留下「已切 d1、数据还在 kv」的半迁移状态。
            try {
                const settings = await kvAdapter.get(DATA_KEYS.SETTINGS);
                if (settings) {
                    settings.storageType = STORAGE_TYPES.D1;
                    await d1Adapter.put(DATA_KEYS.SETTINGS, settings);
                    results.settings = true;
                    results.keys[DATA_KEYS.SETTINGS] = 'migrated';
                } else {
                    results.keys[DATA_KEYS.SETTINGS] = 'empty';
                }
            } catch (error) {
                results.keys[DATA_KEYS.SETTINGS] = 'failed';
                results.errors.push(`设置迁移失败: ${error.message}`);
            }

            return results;
        } catch (error) {
            console.error('[Migration] Failed to migrate KV to D1:', error);
            throw error;
        }
    }

    static async migrateLegacyD1MainRows(env) {
        if (!env?.MISUB_DB) throw new Error('D1 database not available');

        const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
        await ensureD1Schema(d1Adapter.db);

        const results = {
            subscriptions: 0,
            profiles: 0,
            errors: [],
        };

        try {
            const legacySubs = await d1Adapter.get(DATA_KEYS.SUBSCRIPTIONS);
            if (Array.isArray(legacySubs)) {
                for (const item of legacySubs) {
                    if (!item?.id) continue;
                    await d1Adapter.putSubscription(item);
                    results.subscriptions += 1;
                }
                await d1Adapter.db
                    .prepare('DELETE FROM subscriptions WHERE id = ?')
                    .bind('main')
                    .run();
                invalidateD1CollectionCache(d1Adapter.db, 'subscriptions');
            }
        } catch (error) {
            results.errors.push(`订阅主行迁移失败: ${error.message}`);
        }

        try {
            const legacyProfiles = await d1Adapter.get(DATA_KEYS.PROFILES);
            if (Array.isArray(legacyProfiles)) {
                for (const item of legacyProfiles) {
                    if (!item?.id) continue;
                    await d1Adapter.putProfile(item);
                    results.profiles += 1;
                }
                await d1Adapter.db.prepare('DELETE FROM profiles WHERE id = ?').bind('main').run();
                invalidateD1CollectionCache(d1Adapter.db, 'profiles');
            }
        } catch (error) {
            results.errors.push(`订阅组主行迁移失败: ${error.message}`);
        }

        return results;
    }

    static async detectLegacyD1MainRows(env) {
        if (!env?.MISUB_DB) {
            return {
                hasLegacySubscriptions: false,
                hasLegacyProfiles: false,
                hasLegacyData: false,
            };
        }

        const d1Adapter = new D1StorageAdapter(env.MISUB_DB);
        const [legacySubs, legacyProfiles] = await Promise.all([
            d1Adapter.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind('main')
                .first(),
            d1Adapter.db.prepare('SELECT data FROM profiles WHERE id = ?').bind('main').first(),
        ]);

        const hasLegacySubscriptions = Array.isArray(
            legacySubs ? JSON.parse(legacySubs.data) : null
        );
        const hasLegacyProfiles = Array.isArray(
            legacyProfiles ? JSON.parse(legacyProfiles.data) : null
        );

        return {
            hasLegacySubscriptions,
            hasLegacyProfiles,
            hasLegacyData: hasLegacySubscriptions || hasLegacyProfiles,
        };
    }
}
