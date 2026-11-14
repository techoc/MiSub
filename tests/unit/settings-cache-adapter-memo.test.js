import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsCache, StorageFactory } from '../../functions/storage-adapter.ts';

function createKVMock(initialData = {}) {
    const store = new Map(Object.entries(initialData));
    let getCalls = 0;
    return {
        store,
        getGetCalls: () => getCalls,
        async get(key) {
            getCalls += 1;
            return store.has(key) ? store.get(key) : null;
        },
        async put(key, value) {
            store.set(key, value);
        },
        async delete(key) {
            store.delete(key);
        },
        async list({ prefix }) {
            return {
                keys: Array.from(store.keys())
                    .filter((key) => key.startsWith(prefix || ''))
                    .map((name) => ({ name })),
            };
        },
    };
}

describe('SettingsCache adapter-scoped memo', () => {
    beforeEach(() => {
        SettingsCache.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        SettingsCache.clear();
    });

    it('reuses the same settings within the TTL window for adapters on the same binding', async () => {
        const kv = createKVMock({ worker_settings_v1: { mytoken: 'first' } });
        const adapterA = StorageFactory.createAdapter({ MISUB_KV: kv }, 'kv');
        const adapterB = StorageFactory.createAdapter({ MISUB_KV: kv }, 'kv');

        const first = await SettingsCache.get({}, adapterA);
        const second = await SettingsCache.get({}, adapterB);

        expect(first).toEqual({ mytoken: 'first' });
        expect(second).toEqual({ mytoken: 'first' });
        // 两次请求（不同 adapter 实例、同一 KV 绑定）只触发一次存储读取
        expect(kv.getGetCalls()).toBe(1);
    });

    it('re-reads after the TTL window elapses', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const kv = createKVMock({ worker_settings_v1: { mytoken: 'first' } });
        const adapter = StorageFactory.createAdapter({ MISUB_KV: kv }, 'kv');

        await SettingsCache.get({}, adapter);
        kv.store.set('worker_settings_v1', { mytoken: 'updated' });
        vi.setSystemTime(new Date('2026-01-01T00:00:20Z'));

        const fresh = await SettingsCache.get({}, adapter);
        expect(fresh).toEqual({ mytoken: 'updated' });
        expect(kv.getGetCalls()).toBe(2);
    });

    it('clear() invalidates adapter-scoped memos immediately', async () => {
        const kv = createKVMock({ worker_settings_v1: { mytoken: 'first' } });
        const adapter = StorageFactory.createAdapter({ MISUB_KV: kv }, 'kv');
        await SettingsCache.get({}, adapter);

        kv.store.set('worker_settings_v1', { mytoken: 'updated' });
        SettingsCache.clear();

        const fresh = await SettingsCache.get({}, adapter);
        expect(fresh).toEqual({ mytoken: 'updated' });
    });

    it('trusts only the adapter data source and does not fall back to env-based reads', async () => {
        const emptyAdapter = {
            get: async () => null,
            kv: { get: async () => JSON.stringify({ mytoken: 'leaked' }) },
        };
        const result = await SettingsCache.get({}, emptyAdapter);
        expect(result).toBeNull();
    });
});
