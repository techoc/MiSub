/**
 * Shared HTTP helpers for API requests.
 * Centralizes JSON handling, credentials, and error normalization.
 */

/**
 * 后端错误体（createJsonResponse 的错误分支），已知字段精确 + 长尾 unknown。
 */
export interface APIErrorPayload {
    message?: string;
    error?: string;
    success?: boolean;
    code?: string;
    [key: string]: unknown;
}

export class APIError extends Error {
    status: number;
    data: APIErrorPayload | null;

    constructor(message: string, status = 500, data: APIErrorPayload | null = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

type UnauthorizedHandler = (info: { url: string; data: unknown }) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function configureUnauthorizedHandler(handler: unknown) {
    unauthorizedHandler = typeof handler === 'function' ? (handler as UnauthorizedHandler) : null;
}

const buildHeaders = (headers: HeadersInit | undefined, body: BodyInit | null | undefined) => {
    if (headers instanceof Headers) {
        return headers;
    }
    const resolved = new Headers(headers || {});
    if (!resolved.has('Content-Type') && body !== undefined) {
        resolved.set('Content-Type', 'application/json');
    }
    return resolved;
};

const parseJson = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API 边界逃生口：调用方遍布各 store/composable，待按端点定义响应类型后逐步替换
export async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const { headers, body, ...rest } = options;
    const response = await fetch(url, {
        credentials: 'include',
        ...rest,
        body,
        headers: buildHeaders(headers, body),
    });

    const data = await parseJson(response);
    if (!response.ok) {
        if (response.status === 401) {
            try {
                unauthorizedHandler?.({ url, data });
            } catch (error) {
                console.warn('[HTTP] Unauthorized handler failed:', error);
            }
        }
        const payload = (data ?? null) as APIErrorPayload | null;
        const message = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new APIError(message, response.status, payload);
    }

    return data as T;
}

const stringifyBody = (data: unknown) =>
    data === undefined ? undefined : JSON.stringify(data);

// 与 request 相同的边界逃生口：响应形状按端点逐步补类型，期间保持调用方零改动
export const api = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: <T = any>(url: string, options: RequestInit = {}) =>
        request<T>(url, { ...options, method: 'GET' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    post: <T = any>(url: string, data?: unknown, options: RequestInit = {}) =>
        request<T>(url, { ...options, method: 'POST', body: stringifyBody(data) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    put: <T = any>(url: string, data?: unknown, options: RequestInit = {}) =>
        request<T>(url, { ...options, method: 'PUT', body: stringifyBody(data) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch: <T = any>(url: string, data?: unknown, options: RequestInit = {}) =>
        request<T>(url, { ...options, method: 'PATCH', body: stringifyBody(data) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    del: <T = any>(url: string, options: RequestInit = {}) =>
        request<T>(url, { ...options, method: 'DELETE' }),
};
