/**
 * D1 存储适配器（facade 拆分：原 storage-adapter.js 的 D1StorageAdapter）。
 */

import {
    DATA_KEYS,
    STORAGE_TYPES,
    D1_KNOWN_SETTINGS_KEYS,
    invalidateD1CollectionCache,
    readCachedD1Collection,
} from './shared.js';

/**
 * D1 存储适配器
 */
export class D1StorageAdapter {
    constructor(d1Database) {
        this.db = d1Database;
        this.type = STORAGE_TYPES.D1;
    }

    async get(key, type = 'json') {
        try {
            // 根据 key 确定查询的表和字段
            const { table, queryField, queryValue } = this._parseKey(key);

            const result = await this.db
                .prepare(
                    `SELECT ${table === 'settings' ? 'value as data' : 'data'} FROM ${table} WHERE ${queryField} = ?`
                )
                .bind(queryValue)
                .first();

            if (!result) return null;

            return type === 'json' ? JSON.parse(result.data) : result.data;
        } catch (error) {
            // 如果是表不存在的错误，说明 D1 还未初始化或未被使用，直接返回 null
            if (error.message && error.message.includes('no such table')) {
                return null;
            }
            console.error(`[D1] Failed to get key ${key}:`, error);
            return null;
        }
    }

    async put(key, value) {
        try {
            const { table, queryField, queryValue } = this._parseKey(key);
            const data = typeof value === 'string' ? value : JSON.stringify(value);

            if (table === 'settings') {
                // settings 表使用 key-value 结构
                await this.db
                    .prepare(
                        `
                    INSERT OR REPLACE INTO ${table} (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `
                    )
                    .bind(queryValue, data)
                    .run();
            } else {
                // subscriptions 和 profiles 表使用 id-data 结构
                await this.db
                    .prepare(
                        `
                    INSERT OR REPLACE INTO ${table} (id, data, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `
                    )
                    .bind(queryValue, data)
                    .run();
            }

            if (table === 'subscriptions' || table === 'profiles') {
                invalidateD1CollectionCache(this.db, table);
            }
            return true;
        } catch (error) {
            console.error(`[D1] Failed to put key ${key}:`, error);
            throw error;
        }
    }

    async delete(key) {
        try {
            const { table, queryField, queryValue } = this._parseKey(key);

            await this.db
                .prepare(`DELETE FROM ${table} WHERE ${queryField} = ?`)
                .bind(queryValue)
                .run();

            if (table === 'subscriptions' || table === 'profiles') {
                invalidateD1CollectionCache(this.db, table);
            }
            return true;
        } catch (error) {
            console.error(`[D1] Failed to delete key ${key}:`, error);
            throw error;
        }
    }

    async list(prefix) {
        try {
            // D1 中的 list 操作需要根据前缀查询相应的表
            const tables = [
                { name: 'subscriptions', keyField: 'id' },
                { name: 'profiles', keyField: 'id' },
                { name: 'settings', keyField: 'key' },
            ];
            const keys = [];
            const effectivePrefix = prefix || '';
            const matchesKnownKey =
                DATA_KEYS.SUBSCRIPTIONS.startsWith(effectivePrefix) ||
                DATA_KEYS.PROFILES.startsWith(effectivePrefix) ||
                DATA_KEYS.SETTINGS.startsWith(effectivePrefix) ||
                effectivePrefix.startsWith(DATA_KEYS.SUBSCRIPTIONS) ||
                effectivePrefix.startsWith(DATA_KEYS.PROFILES) ||
                effectivePrefix.startsWith(DATA_KEYS.SETTINGS);

            const shouldQuerySubscriptions =
                !effectivePrefix || effectivePrefix.startsWith(DATA_KEYS.SUBSCRIPTIONS);
            const shouldQueryProfiles =
                !effectivePrefix || effectivePrefix.startsWith(DATA_KEYS.PROFILES);
            const shouldQuerySettings =
                !effectivePrefix ||
                !matchesKnownKey ||
                effectivePrefix.startsWith(DATA_KEYS.SETTINGS);

            for (const table of tables) {
                if (table.name === 'subscriptions' && !shouldQuerySubscriptions) continue;
                if (table.name === 'profiles' && !shouldQueryProfiles) continue;
                if (table.name === 'settings' && !shouldQuerySettings) continue;

                let results;
                if (table.name === 'settings' && effectivePrefix) {
                    results = await this.db
                        .prepare(
                            `SELECT ${table.keyField} FROM ${table.name} WHERE ${table.keyField} LIKE ?`
                        )
                        .bind(`${effectivePrefix}%`)
                        .all();
                } else {
                    results = await this.db
                        .prepare(`SELECT ${table.keyField} FROM ${table.name}`)
                        .all();
                }

                results.results.forEach((row) => {
                    const key = this._buildKey(table.name, row[table.keyField]);
                    if (key.startsWith(effectivePrefix)) {
                        keys.push({ name: key });
                    }
                });
            }

            return keys;
        } catch (error) {
            console.error(`[D1] Failed to list keys with prefix ${prefix}:`, error);
            return [];
        }
    }

    async getSubscriptionById(id) {
        try {
            const result = await this.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind(id)
                .first();
            if (result) return JSON.parse(result.data);

            const legacyMain = await this.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind('main')
                .first();
            if (!legacyMain) return null;
            const parsed = JSON.parse(legacyMain.data);
            return Array.isArray(parsed) ? parsed.find((item) => item.id === id) || null : null;
        } catch (error) {
            console.error(`[D1] Failed to get subscription ${id}:`, error);
            return null;
        }
    }

    async getAllSubscriptions() {
        return readCachedD1Collection(this.db, 'subscriptions', async () => {
            try {
                const results = await this.db.prepare('SELECT data FROM subscriptions').all();
                if (!Array.isArray(results?.results)) return [];

                const all = [];
                results.results.forEach((row) => {
                    const parsed = JSON.parse(row.data);
                    if (Array.isArray(parsed)) {
                        all.push(...parsed);
                    } else if (parsed) {
                        all.push(parsed);
                    }
                });

                const deduped = new Map();
                all.forEach((item) => {
                    if (item?.id) deduped.set(item.id, item);
                });
                return Array.from(deduped.values()).sort(
                    (a, b) => (a.sortIndex || 0) - (b.sortIndex || 0)
                );
            } catch (error) {
                invalidateD1CollectionCache(this.db, 'subscriptions');
                console.error('[D1] Failed to get all subscriptions:', error);
                return [];
            }
        });
    }

    async getProfileById(id) {
        try {
            const result = await this.db
                .prepare('SELECT data FROM profiles WHERE id = ?')
                .bind(id)
                .first();
            if (result) return JSON.parse(result.data);

            const legacyMain = await this.db
                .prepare('SELECT data FROM profiles WHERE id = ?')
                .bind('main')
                .first();
            const allProfiles = legacyMain
                ? JSON.parse(legacyMain.data)
                : await this.get(DATA_KEYS.PROFILES);
            return Array.isArray(allProfiles)
                ? allProfiles.find((item) => item.id === id || item.customId === id) || null
                : null;
        } catch (error) {
            console.error(`[D1] Failed to get profile ${id}:`, error);
            return null;
        }
    }

    async getAllProfiles() {
        return readCachedD1Collection(this.db, 'profiles', async () => {
            try {
                const results = await this.db.prepare('SELECT data FROM profiles').all();
                if (!Array.isArray(results?.results)) return [];

                const all = [];
                results.results.forEach((row) => {
                    const parsed = JSON.parse(row.data);
                    if (Array.isArray(parsed)) {
                        all.push(...parsed);
                    } else if (parsed) {
                        all.push(parsed);
                    }
                });

                const deduped = new Map();
                all.forEach((item) => {
                    if (item?.id) deduped.set(item.id, item);
                });
                return Array.from(deduped.values()).sort(
                    (a, b) => (a.sortIndex || 0) - (b.sortIndex || 0)
                );
            } catch (error) {
                invalidateD1CollectionCache(this.db, 'profiles');
                console.error('[D1] Failed to get all profiles:', error);
                return [];
            }
        });
    }

    async updateSubscriptionById(id, updater) {
        const existing = await this.getSubscriptionById(id);
        if (!existing) return null;
        const updated = updater({ ...existing });
        await this.db
            .prepare(
                `
            INSERT OR REPLACE INTO subscriptions (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `
            )
            .bind(id, JSON.stringify(updated))
            .run();
        invalidateD1CollectionCache(this.db, 'subscriptions');
        return updated;
    }

    async putSubscription(item) {
        await this.db
            .prepare(
                `
            INSERT OR REPLACE INTO subscriptions (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `
            )
            .bind(item.id, JSON.stringify(item))
            .run();
        invalidateD1CollectionCache(this.db, 'subscriptions');
        return item;
    }

    async deleteSubscriptionById(id) {
        const result = await this.db
            .prepare('DELETE FROM subscriptions WHERE id = ?')
            .bind(id)
            .run();
        invalidateD1CollectionCache(this.db, 'subscriptions');
        return Boolean(result?.success);
    }

    async putProfile(item) {
        await this.db
            .prepare(
                `
            INSERT OR REPLACE INTO profiles (id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `
            )
            .bind(item.id, JSON.stringify(item))
            .run();
        invalidateD1CollectionCache(this.db, 'profiles');
        return item;
    }

    async deleteProfileById(id) {
        const result = await this.db.prepare('DELETE FROM profiles WHERE id = ?').bind(id).run();
        invalidateD1CollectionCache(this.db, 'profiles');
        return Boolean(result?.success);
    }

    async getSubscriptionsByIds(ids = []) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        // D1 单条 SQL 绑定变量上限为 100，超过会报
        // "too many SQL variables" 而整条查询失败。
        // 因此按 90 一批分片查询，再合并结果（同时保留原有 legacy 'main' 回退）。
        const CHUNK_SIZE = 90;
        const uniqueIds = Array.from(new Set(ids));
        try {
            const directHits = [];
            for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
                const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
                const placeholders = chunk.map(() => '?').join(',');
                const results = await this.db
                    .prepare(`SELECT data FROM subscriptions WHERE id IN (${placeholders})`)
                    .bind(...chunk)
                    .all();
                if (Array.isArray(results?.results)) {
                    directHits.push(...results.results.map((row) => JSON.parse(row.data)));
                }
            }
            const foundIds = new Set(directHits.map((item) => item?.id).filter(Boolean));
            const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

            if (missingIds.length === 0) return directHits;

            const legacyMain = await this.db
                .prepare('SELECT data FROM subscriptions WHERE id = ?')
                .bind('main')
                .first();
            if (!legacyMain) return directHits;

            const parsed = JSON.parse(legacyMain.data);
            if (!Array.isArray(parsed)) return directHits;

            const legacyHits = parsed.filter((item) => missingIds.includes(item.id));
            return [...directHits, ...legacyHits];
        } catch (error) {
            console.error('[D1] Failed to get subscriptions by ids:', error);
            return [];
        }
    }

    async putAllSubscriptions(items) {
        if (!Array.isArray(items)) return false;
        // 使用并行 Promise 提高效率
        await Promise.all(items.map((item) => this.putSubscription(item)));
        return true;
    }

    async putAllProfiles(items) {
        if (!Array.isArray(items)) return false;
        await Promise.all(items.map((item) => this.putProfile(item)));
        return true;
    }

    /**
     * 解析 key，确定对应的表、查询字段和查询值
     */
    _parseKey(key) {
        if (key === DATA_KEYS.SUBSCRIPTIONS) {
            return { table: 'subscriptions', queryField: 'id', queryValue: 'main' };
        } else if (key === DATA_KEYS.PROFILES) {
            return { table: 'profiles', queryField: 'id', queryValue: 'main' };
        } else if (key === DATA_KEYS.SETTINGS) {
            return { table: 'settings', queryField: 'key', queryValue: 'main' };
        } else {
            if (String(key).startsWith(DATA_KEYS.PROFILE_DOWNLOAD_COUNT_PREFIX)) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            if (String(key).startsWith('tmp_external_nodes:')) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            if (String(key).startsWith('misub_guestbook_v1')) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            // 这些业务键本来就以 settings 表为家（KV→D1 迁移会主动写它们），
            // 不该走下面那条「未知格式」告警，否则真正的异常 key 会被噪声淹掉。
            if (D1_KNOWN_SETTINGS_KEYS.has(String(key))) {
                return { table: 'settings', queryField: 'key', queryValue: key };
            }
            // 处理其他格式的 key，默认作为 settings 表的 key，但记录警告
            console.warn(`[D1 Storage] Unknown key format: ${key}, treating as settings key`);
            return { table: 'settings', queryField: 'key', queryValue: key };
        }
    }

    /**
     * 构建 key
     */
    _buildKey(table, keyValue) {
        if (table === 'subscriptions' && keyValue === 'main') {
            return DATA_KEYS.SUBSCRIPTIONS;
        } else if (table === 'profiles' && keyValue === 'main') {
            return DATA_KEYS.PROFILES;
        } else if (table === 'settings' && keyValue === 'main') {
            return DATA_KEYS.SETTINGS;
        } else {
            return keyValue;
        }
    }
}
