import { StorageFactory, STORAGE_TYPES } from '../storage-adapter.ts';

const DEFAULT_EXTERNAL_NODES_TTL_SECONDS = 120;
const DEFAULT_MAX_INLINE_URL_LENGTH = 6000;
const DEFAULT_MAX_INLINE_NODE_COUNT = 80;
const MEMORY_CACHE_SYMBOL = '__misubExternalNodesCallbackCache';

/** 内存回退缓存条目 */
interface MemoryEntry {
    value: string;
    expiresAt: number;
}

/** 外部节点回调 token 载荷 */
interface ExternalNodesTokenPayload {
    profileId?: string;
    nodeHash?: string;
    exp?: number;
}

interface PutExternalNodesOptions {
    env?: Env;
    profileId?: string;
    nodesText?: string;
    ttlSeconds?: number;
}

interface GetExternalNodesOptions {
    env?: Env;
    profileId?: string;
    nodeHash?: string;
}

interface CreateExternalNodesTokenOptions {
    profileId?: string;
    nodeHash?: string;
    secret?: string;
    expiresInSeconds?: number;
}

interface PrepareExternalNodesCallbackOptions {
    env?: Env;
    requestUrl?: string | URL;
    profileId?: string;
    nodesText?: string;
    ttlSeconds?: number;
    encoding?: string;
}

function getCrypto() {
    const cryptoImpl = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (!cryptoImpl?.subtle) {
        throw new Error('WebCrypto subtle API is unavailable');
    }
    return cryptoImpl;
}

function bytesToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    const base64 =
        typeof btoa === 'function'
            ? btoa(binary)
            : Buffer.from(binary, 'binary').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeUtf8Base64(text: unknown): string {
    const bytes = new TextEncoder().encode(String(text || ''));
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(binary, 'binary').toString('base64');
}

function base64UrlToBytes(value: unknown): Uint8Array {
    const base64 = String(value || '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary =
        typeof atob === 'function'
            ? atob(padded)
            : Buffer.from(padded, 'base64').toString('binary');
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodePayload(payload: unknown): string {
    return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(encoded: string): ExternalNodesTokenPayload {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded));
    return JSON.parse(json);
}

async function hmacSha256Base64Url(data: string, secret: string): Promise<string> {
    const cryptoImpl = getCrypto();
    const key = await cryptoImpl.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await cryptoImpl.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return bytesToBase64Url(new Uint8Array(signature));
}

async function sha256Hex(text: string): Promise<string> {
    const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(text));
    return bytesToHex(digest);
}

function timingSafeEqualString(a: unknown, b: unknown): boolean {
    const left = String(a || '');
    const right = String(b || '');
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) {
        diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return diff === 0;
}

function getMemoryCache(): Map<string, MemoryEntry> {
    const scope = globalThis as unknown as Record<string, Map<string, MemoryEntry> | undefined>;
    if (!scope[MEMORY_CACHE_SYMBOL]) {
        scope[MEMORY_CACHE_SYMBOL] = new Map();
    }
    return scope[MEMORY_CACHE_SYMBOL]!;
}

function resolveExternalNodesKv(env: Env) {
    try {
        return StorageFactory.resolveKV(env);
    } catch {
        return null;
    }
}

function resolveExternalNodesD1Adapter(env: Env) {
    if (!env?.MISUB_DB) return null;
    try {
        return StorageFactory.createAdapter(env, STORAGE_TYPES.D1);
    } catch (error) {
        console.warn(
            '[ExternalNodesCallback] D1 storage unavailable:',
            (error as Error | undefined)?.message || error
        );
        return null;
    }
}

function normalizeDurableStoredNodes(stored: unknown): string | null {
    if (stored === null || stored === undefined) return null;
    if (typeof stored === 'string') return stored;
    if (typeof stored === 'object') {
        const record = stored as { expiresAt?: number; value?: unknown };
        if (Number(record.expiresAt || 0) && Number(record.expiresAt) <= Date.now()) {
            return null;
        }
        if (typeof record.value === 'string') return record.value;
    }
    return null;
}

function purgeExpiredMemoryEntries(now = Date.now()) {
    const cache = getMemoryCache();
    for (const [key, entry] of cache.entries()) {
        if (!entry || entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
}

export function countNodeLines(nodesText = '') {
    return String(nodesText || '')
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean).length;
}

export function shouldUseExternalNodesCallback({
    inlineUrlLength = 0,
    nodeCount = 0,
    maxInlineUrlLength = DEFAULT_MAX_INLINE_URL_LENGTH,
    maxInlineNodeCount = DEFAULT_MAX_INLINE_NODE_COUNT,
} = {}) {
    return Number(inlineUrlLength) > maxInlineUrlLength || Number(nodeCount) > maxInlineNodeCount;
}

export function buildExternalNodesCacheKey(profileId: unknown, nodeHash: unknown) {
    const safeProfileId = String(profileId || 'default').replace(/[^a-zA-Z0-9._:-]/g, '_');
    return `tmp_external_nodes:${safeProfileId}:${nodeHash}`;
}

export async function hashExternalNodes(nodesText: unknown) {
    return sha256Hex(String(nodesText || ''));
}

export async function putExternalNodes({
    env = {} as Env,
    profileId = 'default',
    nodesText = '',
    ttlSeconds = DEFAULT_EXTERNAL_NODES_TTL_SECONDS,
}: PutExternalNodesOptions = {}) {
    const normalizedNodes = String(nodesText || '');
    const nodeHash = await hashExternalNodes(normalizedNodes);
    const cacheKey = buildExternalNodesCacheKey(profileId, nodeHash);
    const kv = resolveExternalNodesKv(env);

    if (kv?.get && kv?.put) {
        const existing = await kv.get(cacheKey);
        if (existing !== null && existing !== undefined) {
            return { cacheKey, nodeHash, reused: true, storage: 'kv' };
        }
        await kv.put(cacheKey, normalizedNodes, { expirationTtl: ttlSeconds });
        return { cacheKey, nodeHash, reused: false, storage: 'kv' };
    }

    const d1Adapter = resolveExternalNodesD1Adapter(env);
    if (d1Adapter?.get && d1Adapter?.put) {
        const existing = normalizeDurableStoredNodes(await d1Adapter.get(cacheKey));
        if (existing !== null && existing !== undefined) {
            return { cacheKey, nodeHash, reused: true, storage: 'd1' };
        }
        await d1Adapter.put(cacheKey, {
            value: normalizedNodes,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return { cacheKey, nodeHash, reused: false, storage: 'd1' };
    }

    purgeExpiredMemoryEntries();
    const cache = getMemoryCache();
    const existing = cache.get(cacheKey);
    if (existing && existing.expiresAt > Date.now()) {
        return { cacheKey, nodeHash, reused: true, storage: 'memory' };
    }
    cache.set(cacheKey, {
        value: normalizedNodes,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return { cacheKey, nodeHash, reused: false, storage: 'memory' };
}

export async function getExternalNodes({
    env = {} as Env,
    profileId = 'default',
    nodeHash,
}: GetExternalNodesOptions = {}) {
    const cacheKey = buildExternalNodesCacheKey(profileId, nodeHash);
    const kv = resolveExternalNodesKv(env);
    if (kv?.get) {
        return normalizeDurableStoredNodes(await kv.get(cacheKey));
    }

    const d1Adapter = resolveExternalNodesD1Adapter(env);
    if (d1Adapter?.get) {
        const stored = await d1Adapter.get(cacheKey);
        const nodes = normalizeDurableStoredNodes(stored);
        if (nodes === null && stored && d1Adapter?.delete) {
            await d1Adapter.delete(cacheKey).catch(() => undefined);
        }
        return nodes;
    }

    purgeExpiredMemoryEntries();
    const entry = getMemoryCache().get(cacheKey);
    return entry && entry.expiresAt > Date.now() ? entry.value : null;
}

export async function createExternalNodesToken({
    profileId,
    nodeHash,
    secret,
    expiresInSeconds = DEFAULT_EXTERNAL_NODES_TTL_SECONDS,
}: CreateExternalNodesTokenOptions = {}) {
    if (!secret) {
        throw new Error('external nodes callback secret is missing');
    }
    const payload = {
        profileId: String(profileId || 'default'),
        nodeHash: String(nodeHash || ''),
        exp: Math.floor(Date.now() / 1000) + Number(expiresInSeconds),
    };
    const encodedPayload = encodePayload(payload);
    const signature = await hmacSha256Base64Url(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

export async function verifyExternalNodesToken(
    token: unknown,
    secret: unknown
): Promise<ExternalNodesTokenPayload> {
    const secretValue = String(secret ?? '');
    if (!secretValue) {
        throw new Error('external nodes callback secret is missing');
    }
    const [encodedPayload, signature, extra] = String(token || '').split('.');
    if (!encodedPayload || !signature || extra !== undefined) {
        throw new Error('invalid external nodes callback token');
    }
    const expectedSignature = await hmacSha256Base64Url(encodedPayload, secretValue);
    if (!timingSafeEqualString(signature, expectedSignature)) {
        throw new Error('invalid external nodes callback token');
    }

    let payload: ExternalNodesTokenPayload;
    try {
        payload = decodePayload(encodedPayload);
    } catch {
        throw new Error('invalid external nodes callback token');
    }
    if (!payload?.profileId || !/^[a-f0-9]{64}$/i.test(String(payload.nodeHash || ''))) {
        throw new Error('invalid external nodes callback token');
    }
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) {
        throw new Error('expired external nodes callback token');
    }
    return payload;
}

export function resolveExternalNodesCallbackSecret(env: Env = {} as Env) {
    return String(env?.CALLBACK_TOKEN_SECRET || env?.COOKIE_SECRET || '');
}

export function buildExternalNodesCallbackUrl(
    requestUrl: string | URL,
    token: string,
    { encoding }: { encoding?: string } = {}
) {
    const callbackUrl = new URL('/api/external-nodes-callback', requestUrl);
    callbackUrl.searchParams.set('token', token);
    if (encoding) {
        callbackUrl.searchParams.set('encoding', encoding);
    }
    return callbackUrl.toString();
}

export async function prepareExternalNodesCallback({
    env = {} as Env,
    requestUrl,
    profileId = 'default',
    nodesText = '',
    ttlSeconds = DEFAULT_EXTERNAL_NODES_TTL_SECONDS,
    encoding,
}: PrepareExternalNodesCallbackOptions = {}) {
    const secret = resolveExternalNodesCallbackSecret(env);
    const stored = await putExternalNodes({ env, profileId, nodesText, ttlSeconds });
    const token = await createExternalNodesToken({
        profileId,
        nodeHash: stored.nodeHash,
        secret,
        expiresInSeconds: ttlSeconds,
    });
    return {
        ...stored,
        token,
        callbackUrl: buildExternalNodesCallbackUrl(requestUrl as string, token, { encoding }),
    };
}

export async function handleExternalNodesCallbackRequest(
    request: Request,
    env: Env = {} as Env
) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
        return new Response('Missing callback token', { status: 400 });
    }

    let payload: ExternalNodesTokenPayload;
    try {
        payload = await verifyExternalNodesToken(token, resolveExternalNodesCallbackSecret(env));
    } catch (err) {
        const message = (err as Error | undefined)?.message || 'Invalid callback token';
        const status = /expired/i.test(message) ? 410 : 403;
        return new Response(message, { status });
    }

    const nodesText = await getExternalNodes({
        env,
        profileId: payload.profileId,
        nodeHash: payload.nodeHash,
    });
    if (nodesText === null || nodesText === undefined) {
        return new Response('External nodes callback cache expired or missing', { status: 410 });
    }

    const encoding = (url.searchParams.get('encoding') || '').toLowerCase();
    const responseText = encoding === 'base64' ? encodeUtf8Base64(nodesText) : nodesText;
    const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
        'X-MiSub-Mode': 'external-nodes-callback',
    };
    if (encoding === 'base64') {
        headers['X-MiSub-Callback-Encoding'] = 'base64';
    }

    return new Response(responseText, {
        headers,
    });
}
