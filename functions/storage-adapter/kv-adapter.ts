/**
 * KV 存储适配器（facade 拆分：原 storage-adapter.js 的 KVStorageAdapter）。
 */

import { DATA_KEYS, STORAGE_TYPES } from './shared.ts';

/**
 * KV 存储适配器
 */
export class KVStorageAdapter {
    kv: KVNamespace;
    type: string;

    constructor(kvNamespace: KVNamespace) {
        this.kv = kvNamespace;
        this.type = STORAGE_TYPES.KV;
    }

    async get(key: any) {
        try {
            const raw = await (this.kv as Record<string, any>).get(key);
            if (raw === null || raw === undefined) return null;
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
        } catch (error) {
            console.error(`[KV] Failed to get key ${key}:`, error);
            return null;
        }
    }

    async put(key: any, value: any) {
        try {
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            await (this.kv as Record<string, any>).put(key, data);
            return true;
        } catch (error) {
            console.error(`[KV] Failed to put key ${key}:`, error);
            throw error;
        }
    }

    async delete(key: any) {
        try {
            await (this.kv as Record<string, any>).delete(key);
            return true;
        } catch (error) {
            console.error(`[KV] Failed to delete key ${key}:`, error);
            throw error;
        }
    }

    async list(prefix: any) {
        try {
            const result = await (this.kv as Record<string, any>).list({ prefix });
            return result.keys || [];
        } catch (error) {
            console.error(`[KV] Failed to list keys with prefix ${prefix}:`, error);
            return [];
        }
    }

    async getSubscriptionById(id: any) {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS);
        return Array.isArray(all) ? all.find((item) => item.id === id) || null : null;
    }

    async getAllSubscriptions() {
        const all = await this.get(DATA_KEYS.SUBSCRIPTIONS);
        return Array.isArray(all) ? all : [];
    }

    async getProfileById(id: any) {
        const all = await this.get(DATA_KEYS.PROFILES);
        return Array.isArray(all)
            ? all.find((item) => item.id === id || item.customId === id) || null
            : null;
    }

    async getAllProfiles() {
        const all = await this.get(DATA_KEYS.PROFILES);
        return Array.isArray(all) ? all : [];
    }

    async updateSubscriptionById(id: any, updater: any) {
        const all = (await this.get(DATA_KEYS.SUBSCRIPTIONS)) || [];
        const index = all.findIndex((item: any) => item.id === id);
        if (index === -1) return null;
        const updated = updater({ ...all[index] });
        all[index] = updated;
        await this.put(DATA_KEYS.SUBSCRIPTIONS, all);
        return updated;
    }

    async putSubscription(item: any) {
        const all = await this.getAllSubscriptions();
        const index = all.findIndex((entry) => entry.id === item.id);
        if (index === -1) {
            all.push(item);
        } else {
            all[index] = item;
        }
        await this.put(DATA_KEYS.SUBSCRIPTIONS, all);
        return item;
    }

    async deleteSubscriptionById(id: any) {
        const all = await this.getAllSubscriptions();
        const filtered = all.filter((item) => item.id !== id);
        await this.put(DATA_KEYS.SUBSCRIPTIONS, filtered);
        return filtered.length !== all.length;
    }

    async putProfile(item: any) {
        const all = await this.getAllProfiles();
        const index = all.findIndex((entry) => entry.id === item.id);
        if (index === -1) {
            all.push(item);
        } else {
            all[index] = item;
        }
        await this.put(DATA_KEYS.PROFILES, all);
        return item;
    }

    async deleteProfileById(id: any) {
        const all = await this.getAllProfiles();
        const filtered = all.filter((item) => item.id !== id);
        await this.put(DATA_KEYS.PROFILES, filtered);
        return filtered.length !== all.length;
    }

    async getSubscriptionsByIds(ids: any[] = []) {
        const all = (await this.get(DATA_KEYS.SUBSCRIPTIONS)) || [];
        const idSet = new Set(ids);
        return all.filter((item: any) => idSet.has(item.id));
    }

    async putAllSubscriptions(items: any) {
        return this.put(DATA_KEYS.SUBSCRIPTIONS, items);
    }

    async putAllProfiles(items: any) {
        return this.put(DATA_KEYS.PROFILES, items);
    }
}
