import {
    getCache,
    triggerBackgroundRefresh,
    createCacheHeaders,
    isLikelyPartialAggregateNodeList,
} from '../../services/node-cache-service.ts';

/** 缓存的节点聚合记录 */
interface CacheEntryRecord {
    nodes: string;
    nodeCount?: number;
}

/** resolveNodeListWithCache 入参 */
interface ResolveNodeListOptions {
    storageAdapter: Parameters<typeof getCache>[0];
    cacheKey: string;
    forceRefresh?: boolean;
    refreshNodes: (force?: boolean) => Promise<string>;
    context?: unknown;
    targetMisubsCount?: number;
    expectedNodeCount?: number;
}

const refreshDebounce = new Map<string, number>();
const DEBOUNCE_TIME = 10000;

function countCachedNodes(cachedData: CacheEntryRecord | null | undefined): number {
    const declaredCount = Number(cachedData?.nodeCount);
    if (Number.isFinite(declaredCount)) return declaredCount;
    return String(cachedData?.nodes || '')
        .split('\n')
        .filter((line) => line.trim()).length;
}

function hasUsableCachedNodes(cachedData: CacheEntryRecord | null | undefined): boolean {
    return Boolean(String(cachedData?.nodes || '').trim()) && countCachedNodes(cachedData) > 0;
}

function isCacheFarBelowExpected(
    cachedData: CacheEntryRecord | null | undefined,
    expectedNodeCount: unknown
): boolean {
    const expected = Number(expectedNodeCount);
    if (!Number.isFinite(expected) || expected < 10) return false;
    const cached = countCachedNodes(cachedData);
    return cached / expected < 0.3;
}

function populateCachedStats(
    context: unknown,
    cachedNodeCount: number,
    targetMisubsCount: number | undefined
): void {
    const ctx = context as { generationStats?: Record<string, unknown> } | null | undefined;
    if (!ctx) return;
    ctx.generationStats = {
        totalNodes: cachedNodeCount,
        sourceCount: targetMisubsCount,
        successCount: cachedNodeCount,
        failCount: 0,
        duration: 0,
    };
}

export async function resolveNodeListWithCache({
    storageAdapter,
    cacheKey,
    forceRefresh,
    refreshNodes,
    context,
    targetMisubsCount,
    expectedNodeCount = 0,
}: ResolveNodeListOptions) {
    const { data: cachedData, status: cacheStatus } = forceRefresh
        ? { data: null, status: 'miss' }
        : await getCache(storageAdapter, cacheKey);

    let combinedNodeList = '';
    let cacheHeaders: Record<string, string> = {};
    const cacheLooksIncomplete =
        cachedData &&
        (isCacheFarBelowExpected(cachedData, expectedNodeCount) ||
            isLikelyPartialAggregateNodeList(cachedData.nodes));
    const canUseCachedData =
        cachedData && hasUsableCachedNodes(cachedData) && !cacheLooksIncomplete;

    if (cacheLooksIncomplete) {
        console.warn(
            `[Cache] Ignoring incomplete cache ${cacheKey} (${countCachedNodes(cachedData)} cached vs ${expectedNodeCount} expected nodes)`
        );
    }

    if (cacheStatus === 'fresh' && canUseCachedData) {
        const cachedNodeCount = countCachedNodes(cachedData);
        combinedNodeList = cachedData.nodes;
        cacheHeaders = createCacheHeaders('HIT', cachedNodeCount);
        populateCachedStats(context, cachedNodeCount, targetMisubsCount);
    } else if ((cacheStatus === 'stale' || cacheStatus === 'expired') && canUseCachedData) {
        const cachedNodeCount = countCachedNodes(cachedData);
        combinedNodeList = cachedData.nodes;
        cacheHeaders = createCacheHeaders('REFRESHING', cachedNodeCount);

        const lastRun = refreshDebounce.get(cacheKey);
        if (!lastRun || Date.now() - lastRun > DEBOUNCE_TIME) {
            refreshDebounce.set(cacheKey, Date.now());
            triggerBackgroundRefresh(context, () => refreshNodes(true));
        }

        populateCachedStats(context, cachedNodeCount, targetMisubsCount);
    } else {
        combinedNodeList = await refreshNodes(false);
        cacheHeaders = createCacheHeaders(
            'MISS',
            combinedNodeList.split('\n').filter((line: string) => line.trim()).length
        );
    }

    return { combinedNodeList, cacheHeaders, cacheStatus };
}
