import { StorageFactory } from '../storage-adapter.ts';
import { KV_KEY_SETTINGS } from './config.ts';
import { createJsonResponse, JSON_BODY_LIMITS, readJsonWithLimit } from './utils.ts';

/** 外部 API 用到的存储适配器面（KV/D1 实现；无存储降级时部分方法缺失） */
export interface ExternalStorageAdapter {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    getAllSubscriptions(): Promise<unknown[]>;
    getAllProfiles(): Promise<unknown[]>;
    getProfileById(id: string): Promise<Record<string, unknown> | null>;
    putProfile(profile: unknown): Promise<unknown>;
    putSubscription(subscription: unknown): Promise<unknown>;
    deleteProfileById(id: string): Promise<unknown>;
    deleteSubscriptionById(id: string): Promise<unknown>;
    getSubscriptionsByIds(ids: string[]): Promise<unknown[]>;
    updateSubscriptionById(
        id: string,
        updater: (current: Record<string, unknown>) => Record<string, unknown>
    ): Promise<unknown>;
}

/** 外部 API 设置（worker_settings_v1.externalApi） */
export interface ExternalApiSettings {
    enabled?: boolean;
    tokens?: unknown[];
    [key: string]: unknown;
}

export async function getExternalStorageAdapter<T = ExternalStorageAdapter>(env: Env): Promise<T> {
    const testAdapter = (env as { __TEST_STORAGE_ADAPTER?: T }).__TEST_STORAGE_ADAPTER;
    if (testAdapter) return testAdapter;
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType) as unknown as T;
}

export function createRequestId() {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `req_${crypto.randomUUID()}`;
        }
    } catch {}
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createExternalSuccess(data: unknown, status = 200, meta: unknown = undefined) {
    const body: Record<string, unknown> = { success: true, data };
    if (meta) body.meta = meta;
    return createJsonResponse(body, status);
}

export function createExternalError(
    code: string,
    message: string,
    status = 400,
    details: unknown = undefined
) {
    const error: Record<string, unknown> = { code, message };
    if (details !== undefined) error.details = details;
    return createJsonResponse({ success: false, error }, status);
}

export function parseBooleanParam(value: unknown): boolean | undefined {
    if (value == null || value === '') return undefined;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return undefined;
}

export function parsePagination(url: URL): { page: number; pageSize: number } {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
    return { page, pageSize };
}

export function buildListMeta({
    page,
    pageSize,
    total,
}: {
    page: number;
    pageSize: number;
    total: number;
}) {
    return { page, pageSize, total, requestId: createRequestId() };
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
}

export async function readExternalJson(request: Request): Promise<Record<string, unknown>> {
    try {
        return (await readJsonWithLimit(request, JSON_BODY_LIMITS.normal)) as Record<
            string,
            unknown
        >;
    } catch (error) {
        throw Object.assign(new Error((error as Error | undefined)?.message || 'Invalid JSON'), {
            status: (error as { status?: number } | undefined)?.status || 400,
            code: 'invalid_json',
        });
    }
}

export async function getExternalApiSettings(
    env: Env,
    storageAdapter: ExternalStorageAdapter | null = null
): Promise<ExternalApiSettings> {
    const adapter =
        storageAdapter || (await getExternalStorageAdapter<ExternalStorageAdapter>(env));
    const rawSettings = await adapter.get(KV_KEY_SETTINGS);
    const settings =
        rawSettings && typeof rawSettings === 'object'
            ? (rawSettings as Record<string, unknown>)
            : {};
    const externalApi = settings.externalApi;
    return externalApi && typeof externalApi === 'object'
        ? (externalApi as ExternalApiSettings)
        : {};
}

export function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
}

export function sortBySortIndex<T>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        const aIndex = Number((a as { sortIndex?: unknown } | null)?.sortIndex) || 0;
        const bIndex = Number((b as { sortIndex?: unknown } | null)?.sortIndex) || 0;
        return aIndex - bIndex;
    });
}
