import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createAdapter = vi.fn();
const getStorageType = vi.fn();
let authed = false;
const authMiddlewareMock = vi.fn(async (...args) => {
    console.error('PROBE mock invoked, authed=', authed, 'args=', args.length);
    return authed;
});

vi.mock('../../functions/storage-adapter.js', () => ({
    StorageFactory: {
        createAdapter: (...args) => createAdapter(...args),
        getStorageType: (...args) => getStorageType(...args),
        resolveKV: (env) => env?.MISUB_KV || null,
    },
    STORAGE_TYPES: { KV: 'kv', D1: 'd1' },
    // 与真实实现一致的转发语义：设置读取走 adapter，命中内存缓存则直接返回
    SettingsCache: {
        get: async (_env, adapter) =>
            adapter && typeof adapter.get === 'function' ? adapter.get('worker_settings_v1') : null,
        clear: () => {},
    },
}));

vi.mock('../../functions/modules/auth-middleware.js', () => ({
    authMiddleware: (...args) => authMiddlewareMock(...args),
}));

const DOWNLOAD_COUNT_PREFIX = 'misub_profile_download_count_';

function createStorageAdapter({ settings = {}, subscriptions = [], profiles = [] } = {}) {
    const store = new Map([
        ['worker_settings_v1', settings],
        ['misub_subscriptions_v1', subscriptions],
        ['misub_profiles_v1', profiles],
    ]);

    return {
        store,
        get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
        put: vi.fn(async (key, value) => {
            store.set(key, value);
            return true;
        }),
        getAllSubscriptions: vi.fn(async () => subscriptions),
        getAllProfiles: vi.fn(async () => profiles),
        getSubscriptionsByIds: vi.fn(async (ids) =>
            subscriptions.filter((item) => ids.includes(item.id))
        ),
    };
}

const baseSettings = {
    mytoken: 'stable-token',
    profileToken: 'profiles',
    enableFlagEmoji: false,
    enableTrafficNode: false,
};

const baseSubscription = {
    id: 'sub-a',
    name: 'Airport A',
    url: 'https://airport.example/sub',
    enabled: true,
};

const baseProfile = {
    id: 'profile_abc',
    customId: 'mygroup',
    name: 'My Group',
    enabled: true,
    subscriptions: ['sub-a'],
    manualNodes: [],
};

function silenceRequestLogs() {
    return vi.spyOn(console, 'log').mockImplementation(() => {});
}

describe('subscription rendered-output cache (isolate-level)', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        authed = false;
        getStorageType.mockResolvedValue('kv');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function callHandler(adapter, requestUrl, headers = {}) {
        const { handleMisubRequest } =
            await import('../../functions/modules/subscription/main-handler.ts');
        const waitUntilPromises = [];
        const response = await handleMisubRequest({
            request: new Request(requestUrl, { headers }),
            env: {},
            waitUntil: (promise) => waitUntilPromises.push(promise),
            __waitUntilPromises: waitUntilPromises,
        });
        return { response, waitUntilPromises };
    }

    it('serves the second identical request from cache without re-rendering', async () => {
        const adapter = createStorageAdapter({
            settings: baseSettings,
            subscriptions: [baseSubscription],
        });
        createAdapter.mockReturnValue(adapter);
        const fetchMock = vi.fn(
            async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);
        const logSpy = silenceRequestLogs();

        try {
            const url = 'https://misub.example/stable-token?target=nodes';
            const first = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            const firstText = await first.response.text();
            expect(first.response.status).toBe(200);
            expect(firstText).toContain('trojan://pass@example.com:443#');
            expect(first.response.headers.get('ETag')).toBeTruthy();

            const second = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            const secondText = await second.response.text();
            expect(second.response.status).toBe(200);
            expect(secondText).toBe(firstText);
            expect(second.response.headers.get('ETag')).toBe(first.response.headers.get('ETag'));
            expect(second.response.headers.get('X-MiSub-Output-Cache')).toBe('hit');
            // 第二次请求命中输出缓存：不再重跑管线（以 getAllSubscriptions 的读取次数为观测）
            expect(adapter.getAllSubscriptions).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            logSpy.mockRestore();
        }
    });

    it('replies 304 when the client sends a matching If-None-Match', async () => {
        const adapter = createStorageAdapter({
            settings: baseSettings,
            subscriptions: [baseSubscription],
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }))
        );
        const logSpy = silenceRequestLogs();

        try {
            const url = 'https://misub.example/stable-token?target=nodes';
            const first = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            await first.response.text();
            const etag = first.response.headers.get('ETag');
            expect(etag).toBeTruthy();

            const second = await callHandler(adapter, url, {
                'User-Agent': 'ClashMeta',
                'If-None-Match': etag,
            });
            expect(second.response.status).toBe(304);
            expect(await second.response.text()).toBe('');
        } finally {
            logSpy.mockRestore();
        }
    });

    it('treats different user agents as different cache entries', async () => {
        const adapter = createStorageAdapter({
            settings: baseSettings,
            subscriptions: [baseSubscription],
        });
        createAdapter.mockReturnValue(adapter);
        const fetchMock = vi.fn(
            async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);
        const logSpy = silenceRequestLogs();

        try {
            const url = 'https://misub.example/stable-token?target=nodes';
            await (await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' })).response.text();
            await (await callHandler(adapter, url, { 'User-Agent': 'Surge/5' })).response.text();
            // 两次都是完整管线（无跨 UA 共享缓存）
            expect(adapter.getAllSubscriptions).toHaveBeenCalledTimes(2);
        } finally {
            logSpy.mockRestore();
        }
    });

    it('never caches requests that carry refresh/nocache/debug/callback_token params', async () => {
        const adapter = createStorageAdapter({
            settings: baseSettings,
            subscriptions: [baseSubscription],
        });
        createAdapter.mockReturnValue(adapter);
        const fetchMock = vi.fn(
            async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);
        const logSpy = silenceRequestLogs();

        try {
            for (const param of ['refresh', 'nocache', 'debug', 'callback_token']) {
                const url = `https://misub.example/stable-token?target=nodes&${param}=1`;
                await (
                    await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' })
                ).response.text();
                await (
                    await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' })
                ).response.text();
            }
            // 每个参数对都完整跑两次管线（这些参数永不写缓存、也永不命中缓存）
            expect(adapter.getAllSubscriptions).toHaveBeenCalledTimes(8);
        } finally {
            logSpy.mockRestore();
        }
    });

    it('does not store outputs for authenticated admin requests', async () => {
        authed = true;
        const adapter = createStorageAdapter({
            settings: baseSettings,
            subscriptions: [baseSubscription],
        });
        createAdapter.mockReturnValue(adapter);
        const fetchMock = vi.fn(
            async () => new Response('trojan://pass@example.com:443#HK', { status: 200 })
        );
        vi.stubGlobal('fetch', fetchMock);
        const logSpy = silenceRequestLogs();

        try {
            const url = 'https://misub.example/stable-token?target=nodes';
            const first = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            await first.response.text();
            const second = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            await second.response.text();
            expect(authMiddlewareMock).toHaveBeenCalled();
            expect(second.response.headers.get('X-MiSub-Output-Cache')).toBeNull();
            // 管线每次都完整执行（登录态响应不写入缓存）
            expect(adapter.getAllSubscriptions).toHaveBeenCalledTimes(2);
        } finally {
            logSpy.mockRestore();
        }
    });

    it('still increments the download counter on cache hits', async () => {
        const adapter = createStorageAdapter({
            settings: { ...baseSettings, enableAccessLog: true },
            subscriptions: [baseSubscription],
            profiles: [baseProfile],
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }))
        );
        const logSpy = silenceRequestLogs();

        try {
            const url = 'https://misub.example/profiles/mygroup?target=nodes';
            const first = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            await first.response.text();
            await Promise.all(first.waitUntilPromises);
            const downloadKey = `${DOWNLOAD_COUNT_PREFIX}mygroup`;
            expect(adapter.store.get(downloadKey)).toBe(1);

            const second = await callHandler(adapter, url, { 'User-Agent': 'ClashMeta' });
            await second.response.text();
            expect(second.response.headers.get('X-MiSub-Output-Cache')).toBe('hit');
            await Promise.all(second.waitUntilPromises);
            expect(adapter.store.get(downloadKey)).toBe(2);
        } finally {
            logSpy.mockRestore();
        }
    });
});

describe('download counter stays off the response hot path', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        authed = false;
        getStorageType.mockResolvedValue('kv');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('resolves the subscription response while the counter read is still pending', async () => {
        let resolveCount;
        const pendingCount = new Promise((resolve) => {
            resolveCount = resolve;
        });

        const adapter = createStorageAdapter({
            settings: { ...baseSettings, enableAccessLog: true },
            subscriptions: [baseSubscription],
            profiles: [baseProfile],
        });
        const originalGet = adapter.get;
        const downloadKey = `${DOWNLOAD_COUNT_PREFIX}mygroup`;
        adapter.get = vi.fn(async (key) => {
            if (key === downloadKey) return pendingCount;
            return originalGet(key);
        });
        createAdapter.mockReturnValue(adapter);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('trojan://pass@example.com:443#HK', { status: 200 }))
        );
        const logSpy = silenceRequestLogs();

        try {
            const { handleMisubRequest } =
                await import('../../functions/modules/subscription/main-handler.ts');
            const waitUntilPromises = [];
            const response = await handleMisubRequest({
                request: new Request('https://misub.example/profiles/mygroup?target=nodes', {
                    headers: { 'User-Agent': 'ClashMeta' },
                }),
                env: {},
                waitUntil: (promise) => waitUntilPromises.push(promise),
            });
            const text = await response.text();
            expect(response.status).toBe(200);
            expect(text).toContain('trojan://pass@example.com:443#');

            resolveCount(5);
            await Promise.all(waitUntilPromises);
            expect(adapter.put).toHaveBeenCalledWith(downloadKey, 6);
        } finally {
            logSpy.mockRestore();
        }
    });
});
