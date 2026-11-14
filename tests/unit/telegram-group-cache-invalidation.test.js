import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearAllNodeCaches = vi.fn();
const invalidateOutputCache = vi.fn();
const putAllSubscriptions = vi.fn(async () => undefined);
const adapter = { putAllSubscriptions };

const subscriptions = [
    {
        id: 'node-1',
        name: 'Node 1',
        url: 'ss://YWVzLTI1Ni1nY206cGFzcw==@example.com:8388#Node-1',
        enabled: true,
        group: 'Group-A',
    },
];

vi.mock('../../functions/services/node-cache-service.ts', () => ({
    clearAllNodeCaches: (...args) => clearAllNodeCaches(...args),
}));

vi.mock('../../functions/modules/subscription/main-handler/output-cache.ts', () => ({
    invalidateOutputCache: (...args) => invalidateOutputCache(...args),
}));

vi.mock('../../functions/modules/handlers/telegram-webhook/cache.ts', () => ({
    createRequestCache: () => ({}),
    getCachedStorageAdapter: async () => adapter,
    getCachedSubscriptions: async () => subscriptions,
}));

vi.mock('../../functions/modules/handlers/telegram-webhook/telegram-api.ts', () => ({
    editTelegramMessage: vi.fn(),
    sendTelegramMessage: vi.fn(),
}));

vi.mock('../../functions/modules/handlers/telegram-webhook/user-access.ts', () => ({
    getUserNodes: async () => [],
}));

vi.mock('../../functions/modules/utils.ts', () => ({
    escapeHtml: (value = '') => String(value),
}));

import { applyGroupOperation } from '../../functions/modules/handlers/telegram-webhook/group-manage.ts';

describe('telegram group operation cache invalidation', () => {
    beforeEach(() => {
        clearAllNodeCaches.mockReset();
        clearAllNodeCaches.mockResolvedValue({ cleared: 1, failed: 0, skipped: 0 });
        invalidateOutputCache.mockReset();
        putAllSubscriptions.mockClear();
        subscriptions[0].group = 'Group-A';
    });

    it('clears node caches with the storage adapter (not env) after group rename', async () => {
        const changed = await applyGroupOperation(1, 1, {}, 'node', 'Group-A', 'rename', 'Group-B');

        expect(changed).toBe(1);
        expect(invalidateOutputCache).toHaveBeenCalledTimes(1);
        expect(clearAllNodeCaches).toHaveBeenCalledTimes(1);
        expect(clearAllNodeCaches).toHaveBeenCalledWith(adapter);
    });
});
