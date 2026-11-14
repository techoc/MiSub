/**
 * 订阅渲染输出的 isolate 内短 TTL 缓存。
 *
 * 背景：/sub 是被客户端高频轮询的热路径，每次请求都要完整跑一遍
 * 「读 settings/订阅/分组 → 拉取与解析节点 → 渲染」管线（即便已有节点列表
 * KV 缓存，KV 读取与渲染本身仍然逐请求发生）。对同一 token + 输出形态，
 * 60 秒内的重复请求直接复用上一次渲染结果：
 *   - 省掉整条管线的 KV 读取与 CPU；
 *   - 支持 ETag/If-None-Match → 304，减少客户端流量。
 *
 * 边界（刻意为之）：
 *   - 只缓存 GET、200、非 text/html（伪装页/落地页不缓存）、非空响应；
 *   - 带 refresh/nocache/debug/callback_token 的请求永不读写缓存；
 *   - 已登录（管理端）请求的响应永不写入缓存，避免把管理员可见内容
 *     污染给匿名请求；
 *   - 缓存命中时仍会补记下载计数与访问日志（见 main-handler 编排器），
 *     但不再发送 Telegram 访问通知 —— 高频轮询场景下这本身就是降噪。
 *   - TTL 与容量上限保证内存占用有界；Map 按插入序淘汰最旧条目。
 */

export const OUTPUT_CACHE_TTL_MS = 60 * 1000;
export const OUTPUT_CACHE_MAX_ENTRIES = 50;
export const OUTPUT_CACHE_MAX_TOTAL_BYTES = 4 * 1024 * 1024;
export const OUTPUT_CACHE_MAX_ENTRY_BYTES = 512 * 1024;

// 这些参数表明请求方要绕过缓存或属于内部回调，永不作为缓存键的一部分命中
const BYPASS_PARAMS = ['refresh', 'nocache', 'debug', 'callback_token'];

const HINTS_PROP = '__misubOutputCacheHints';

/** key -> entry；value.hints 记录命中路径补记日志/计数所需的最小上下文 */
const outputCacheEntries = new Map();
let outputCacheTotalBytes = 0;

export function resetOutputCacheForTests() {
    outputCacheEntries.clear();
    outputCacheTotalBytes = 0;
}

/**
 * 让全部渲染输出缓存失效（生产路径）。
 *
 * 缓存键只含 method+path+query+UA，不含订阅数据版本；数据（订阅/订阅组/
 * 设置/规则模板）变更后必须显式调用本函数，否则 TTL 窗口内会继续返回
 * 旧配置。与 clearAllNodeCaches 在同样的数据变更点调用。
 */
export function invalidateOutputCache() {
    resetOutputCacheForTests();
}

/**
 * 管线在运行过程中把「命中路径补记」所需的字段挂到 context 上。
 * target-resolver 挂 downloadCountKey；编排器在访问日志分支挂
 * loggable/targetFormat/subName 等。
 */
export function setOutputCacheHints(context: any, partial: any) {
    if (!context) return;
    context[HINTS_PROP] = { ...(context[HINTS_PROP] || {}), ...partial };
}

export function getOutputCacheHints(context: any) {
    return context?.[HINTS_PROP] || null;
}

export function isCacheableRequest(request: any) {
    if (!request || request.method !== 'GET') return false;
    try {
        const url = new URL(request.url);
        return !BYPASS_PARAMS.some((name) => url.searchParams.has(name));
    } catch {
        return false;
    }
}

export function isCacheableResponse(response: any) {
    if (!response || response.status !== 200) return false;
    const contentType = response.headers?.get?.('Content-Type') || '';
    // 伪装页/浏览器落地页是 text/html；订阅输出永远是 yaml/json/纯文本
    if (contentType.includes('text/html')) return false;
    return true;
}

/**
 * 64-bit 指纹（FNV-1a + djb2 各 32 位），纯同步、跨 isolate 稳定，
 * 仅用于 304 协商，不需要加密强度。
 */
export function computeOutputEtag(body: any) {
    const text = String(body ?? '');
    let fnv = 0x811c9dc5;
    let djb = 5381;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        fnv = Math.imul(fnv ^ code, 0x01000193) >>> 0;
        djb = (Math.imul(djb, 33) + code) >>> 0;
    }
    return `W/"misub-${fnv.toString(16).padStart(8, '0')}${djb.toString(16).padStart(8, '0')}"`;
}

function buildCacheKey(request: any) {
    let url;
    try {
        url = new URL(request.url);
    } catch {
        return null;
    }
    const ua = request.headers.get('User-Agent') || '';
    return `${request.method} ${url.pathname}${url.search} ua=${ua}`;
}

function dropEntry(key: any) {
    const entry = outputCacheEntries.get(key);
    if (entry) {
        outputCacheTotalBytes -= entry.bytes;
        outputCacheEntries.delete(key);
    }
}

function purgeExpired(now: any) {
    for (const [key, entry] of outputCacheEntries) {
        if (now - entry.storedAt > OUTPUT_CACHE_TTL_MS) dropEntry(key);
    }
}

function evictIfNeeded(incomingBytes: any) {
    while (
        outputCacheEntries.size > 0 &&
        (outputCacheEntries.size >= OUTPUT_CACHE_MAX_ENTRIES ||
            outputCacheTotalBytes + incomingBytes > OUTPUT_CACHE_MAX_TOTAL_BYTES)
    ) {
        const oldestKey = outputCacheEntries.keys().next().value;
        if (oldestKey === undefined) break;
        dropEntry(oldestKey);
    }
}

/**
 * 命中查询。返回 Response 或 null。onHit(entry) 供编排器补记日志/计数。
 */
export function matchCachedOutput(request: any, { onHit }: Record<string, any> = {}) {
    if (!isCacheableRequest(request)) return null;
    const key = buildCacheKey(request);
    if (!key) return null;
    const entry = outputCacheEntries.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.storedAt > OUTPUT_CACHE_TTL_MS) {
        dropEntry(key);
        return null;
    }
    // 触摸一次，把条目移到插入序尾部（简单 LRU）
    dropEntry(key);
    outputCacheEntries.set(key, entry);
    outputCacheTotalBytes += entry.bytes;

    const headers = new Headers(entry.headers);
    headers.set('ETag', entry.etag);
    headers.set('Cache-Control', 'no-store, no-cache');
    headers.set('X-MiSub-Output-Cache', 'hit');

    if (typeof onHit === 'function') onHit(entry);

    if ((request.headers.get('If-None-Match') || '').trim() === entry.etag) {
        return new Response(null, { status: 304, headers });
    }
    return new Response(entry.body, { status: entry.status, headers });
}

/**
 * 把管线产出写入缓存；返回可能补上 ETag 的新 Response（调用方直接透传给客户端）。
 * 不满足缓存条件的响应原样返回。
 */
export async function storeOutput(context: any, response: any) {
    if (!context || !isCacheableRequest(context.request)) return response;
    if (!isCacheableResponse(response)) return response;
    // 登录态响应永不入缓存：同一 URL+UA 下管理员看到的内容可能与匿名不同（伪装）
    if (context.isAuthenticated) return response;

    const body = await response.text();
    const bytes = new TextEncoder().encode(body).length;
    if (!body || bytes > OUTPUT_CACHE_MAX_ENTRY_BYTES) return response;

    const key = buildCacheKey(context.request);
    if (!key) return response;

    purgeExpired(Date.now());
    evictIfNeeded(bytes);
    dropEntry(key); // 覆盖旧条目时先释放其容量

    const etag = computeOutputEtag(body);
    const entry = {
        storedAt: Date.now(),
        status: response.status,
        bytes,
        etag,
        headers: Array.from(response.headers.entries()),
        body,
        hints: getOutputCacheHints(context) || {},
    };
    outputCacheEntries.set(key, entry);
    outputCacheTotalBytes += bytes;

    const headers = new Headers(response.headers);
    headers.set('ETag', etag);
    return new Response(body, { status: response.status, headers });
}
