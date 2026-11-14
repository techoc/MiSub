import { getCache } from '../../services/node-cache-service.ts';
import { assertPublicNetworkUrl } from '../security-utils.ts';

/** 模板缓存用到的存储适配器最小面 */
interface TemplateCacheStorage {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    kv?: KVNamespace;
    env?: Record<string, unknown>;
}

/** 模板缓存条目 */
interface TemplateCacheEntry {
    nodes?: string;
    timestamp?: number;
    nodeCount?: number;
    sources?: string[];
    etag?: string;
    lastModified?: string;
}

const TEMPLATE_CACHE_PREFIX = 'transform_template_';
const DEFAULT_REVALIDATE_INTERVAL_SECONDS = 5 * 60;
const DEFAULT_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60;
const MIN_REVALIDATE_INTERVAL_SECONDS = 0;
const MAX_REVALIDATE_INTERVAL_SECONDS = 24 * 60 * 60;
const MIN_CACHE_MAX_AGE_SECONDS = 5 * 60;
const MAX_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function makeTemplateCacheKey(url: string): string {
    return `${TEMPLATE_CACHE_PREFIX}${btoa(url).replace(/=+$/g, '')}`;
}

function readNumericSetting(name: string, storageAdapter: TemplateCacheStorage): number | null {
    const value = storageAdapter?.env?.[name] ?? (globalThis as Record<string, unknown>)[name];
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getTemplateCacheConfig(storageAdapter: TemplateCacheStorage) {
    const revalidateSetting = readNumericSetting(
        'TEMPLATE_REVALIDATE_INTERVAL_SECONDS',
        storageAdapter
    );
    const maxAgeSetting = readNumericSetting('TEMPLATE_CACHE_MAX_AGE_SECONDS', storageAdapter);

    return {
        revalidateIntervalMs:
            clampNumber(
                revalidateSetting ?? DEFAULT_REVALIDATE_INTERVAL_SECONDS,
                MIN_REVALIDATE_INTERVAL_SECONDS,
                MAX_REVALIDATE_INTERVAL_SECONDS
            ) * 1000,
        maxAgeSeconds: clampNumber(
            maxAgeSetting ?? DEFAULT_CACHE_MAX_AGE_SECONDS,
            MIN_CACHE_MAX_AGE_SECONDS,
            MAX_CACHE_MAX_AGE_SECONDS
        ),
    };
}

function isCacheYoungerThan(cacheEntry: TemplateCacheEntry | null, maxAgeMs: number): boolean {
    if (!cacheEntry?.timestamp) return false;
    return Date.now() - cacheEntry.timestamp < maxAgeMs;
}

function buildFetchHeaders(cacheEntry: TemplateCacheEntry | null): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': 'MiSub-Template-Fetch/1.0',
    };

    if (cacheEntry?.etag) {
        headers['If-None-Match'] = cacheEntry.etag;
    }
    if (cacheEntry?.lastModified) {
        headers['If-Modified-Since'] = cacheEntry.lastModified;
    }

    return headers;
}

function getHeader(response: Response, name: string): string | null {
    return response.headers?.get?.(name) || response.headers?.get?.(name.toLowerCase()) || null;
}

async function putTemplateCache(
    storageAdapter: TemplateCacheStorage,
    cacheKey: string,
    cacheEntry: TemplateCacheEntry,
    maxAgeSeconds: number
) {
    if (storageAdapter?.kv && typeof storageAdapter.kv.put === 'function') {
        await storageAdapter.kv.put(cacheKey, JSON.stringify(cacheEntry), {
            expirationTtl: maxAgeSeconds,
        });
    } else if (storageAdapter && typeof storageAdapter.put === 'function') {
        await storageAdapter.put(cacheKey, cacheEntry);
    }
}

function createCacheEntry(
    templateUrl: string,
    nodes: string,
    response: Response,
    previousEntry: TemplateCacheEntry | null = null
): TemplateCacheEntry {
    return {
        nodes,
        timestamp: Date.now(),
        nodeCount: previousEntry?.nodeCount || 0,
        sources: previousEntry?.sources?.length ? previousEntry.sources : [templateUrl],
        etag: getHeader(response, 'etag') || previousEntry?.etag,
        lastModified: getHeader(response, 'last-modified') || previousEntry?.lastModified,
    };
}

export async function fetchTransformTemplate(
    storageAdapter: TemplateCacheStorage,
    templateUrl: string,
    forceRefresh = false
): Promise<string | null> {
    if (!templateUrl) return null;

    const safeTemplateUrl = assertPublicNetworkUrl(templateUrl).toString();
    const cacheKey = makeTemplateCacheKey(safeTemplateUrl);
    const cacheConfig = getTemplateCacheConfig(storageAdapter);
    const { data: cachedEntry } = await getCache(storageAdapter, cacheKey);
    const cachedTemplate: TemplateCacheEntry | null = cachedEntry;

    if (
        !forceRefresh &&
        cachedTemplate?.nodes &&
        isCacheYoungerThan(cachedTemplate, cacheConfig.revalidateIntervalMs)
    ) {
        return cachedTemplate.nodes;
    }

    let response: Response;
    try {
        response = await fetch(safeTemplateUrl, {
            headers: forceRefresh
                ? { 'User-Agent': 'MiSub-Template-Fetch/1.0' }
                : buildFetchHeaders(cachedTemplate),
        });
    } catch (error) {
        if (
            cachedTemplate?.nodes &&
            isCacheYoungerThan(cachedTemplate, cacheConfig.maxAgeSeconds * 1000)
        ) {
            console.warn(
                `[TemplateCache] Revalidation failed, falling back to cached template: ${(error as Error).message}`
            );
            return cachedTemplate.nodes;
        }
        throw error;
    }

    if (response.status === 304 && cachedTemplate?.nodes) {
        const refreshedCacheEntry = createCacheEntry(
            safeTemplateUrl,
            cachedTemplate.nodes,
            response,
            cachedTemplate
        );
        await putTemplateCache(
            storageAdapter,
            cacheKey,
            refreshedCacheEntry,
            cacheConfig.maxAgeSeconds
        );
        return cachedTemplate.nodes;
    }

    if (!response.ok) {
        if (
            cachedTemplate?.nodes &&
            isCacheYoungerThan(cachedTemplate, cacheConfig.maxAgeSeconds * 1000)
        ) {
            console.warn(
                `[TemplateCache] Template fetch failed with HTTP ${response.status}, falling back to cached template`
            );
            return cachedTemplate.nodes;
        }
        throw new Error(`Template fetch failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    const cacheEntry = createCacheEntry(safeTemplateUrl, text, response, cachedTemplate);
    await putTemplateCache(storageAdapter, cacheKey, cacheEntry, cacheConfig.maxAgeSeconds);

    return text;
}
