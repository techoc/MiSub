//
// src/lib/api.js
//

import { api, APIError } from './http.ts';
import { t } from '../i18n/index.ts';

/**
 * 端点到调用方的统一结果形状：成功带 data，失败带 error/errorType/status。
 * 用可选字段而非判别联合：调用方（composable/组件）已按这个约定读取，
 * 逐个加判别只会引来大量无意义窄化分支。
 */
export interface ApiResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    errorType?: string;
    status?: number | null;
}

/** /api/subconverter/test 的结果（后端附加可用性/耗时字段） */
export interface SubconverterTestResult extends ApiResult {
    available?: boolean;
    message?: string;
    endpoint?: string;
    elapsedMs?: number;
}

/** /api/github/release 的结果（GitHub Release 字段） */
export interface GithubReleaseResult extends ApiResult {
    tag_name?: string;
    html_url?: string;
    name?: string;
}

/** /api/batch_update_nodes 的结果（逐订阅明细） */
export interface BatchUpdateResult extends ApiResult {
    message?: string;
    results?: Array<{
        subscriptionId?: string;
        id?: string;
        success?: boolean;
        nodeCount?: number;
    }>;
}

/**
 * 统一的 API 错误处理辅助函数
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文
 * @returns {Object} 标准错误响应
 */
function handleApiError(error: unknown, context = ''): ApiResult {
    console.error(`[API Error - ${context}]`, error);

    const err = (error ?? {}) as { name?: string; message?: string };
    let errorType = 'unknown';
    let errorMessage;

    let status: number | null = null;

    if (error instanceof APIError) {
        status = error.status;
        if (error.status === 401) {
            errorType = 'auth';
            errorMessage = t('settings.authFailedRelogin');
        } else {
            errorType = 'server';
            const message = error.message || `HTTP ${error.status}`;
            errorMessage = formatHttpErrorMessage(error.status, message);
        }
    } else if (err.name === 'AbortError') {
        errorType = 'timeout';
        errorMessage = t('settings.requestTimeout');
    } else if (err.name === 'TypeError' && String(err.message).includes('fetch')) {
        errorType = 'network';
        errorMessage = t('settings.networkFailedGeneric');
    } else if (err.message === 'UNAUTHORIZED') {
        errorType = 'auth';
        errorMessage = t('settings.authFailedRelogin');
    } else if (String(err.message).includes('HTTP')) {
        errorType = 'server';
        errorMessage = err.message;
    } else if (err.name === 'SyntaxError') {
        errorType = 'server';
        errorMessage = t('settings.serverResponseInvalid');
    } else {
        errorMessage = err.message || t('settings.operationFailed');
    }

    return {
        success: false,
        error: errorMessage,
        errorType: errorType,
        status,
    };
}

function extractHttpStatus(message = '') {
    const match = String(message).match(/HTTP\s+(\d{3})/i);
    return match ? Number(match[1]) : null;
}

function formatHttpErrorMessage(status: number | null | undefined, message = '') {
    const normalizedMessage = String(message || '').trim();
    if (!status) return normalizedMessage;
    if (new RegExp(`^HTTP\\s+${status}\\b`, 'i').test(normalizedMessage)) {
        return normalizedMessage;
    }
    return `HTTP ${status}: ${normalizedMessage || `HTTP ${status}`}`;
}

function normalizeApiFailure(
    data: unknown,
    fallbackMessage = t('settings.operationFailed')
): ApiResult {
    const payload = (data ?? {}) as {
        error?: string;
        message?: string;
        status?: number;
        errorType?: string;
    };
    const error = payload.error || payload.message || fallbackMessage;
    const status = payload.status || extractHttpStatus(error);
    return {
        success: false,
        error,
        errorType: payload.errorType || (status ? 'server' : 'unknown'),
        status,
        data,
    };
}
export async function fetchInitialData(): Promise<ApiResult> {
    let timeoutId;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

        const data = await api.get('/api/data', { signal: controller.signal });

        // 检查新的认证状态响应 (200 OK with authenticated: false)
        if (data && data.authenticated === false) {
            return { success: false, error: t('settings.authFailedRelogin'), errorType: 'auth' };
        }

        return { success: true, data };
    } catch (error) {
        return handleApiError(error, 'fetchInitialData');
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function login(password: string): Promise<ApiResult> {
    try {
        const data = await api.post('/api/login', { password });
        return { success: true, data };
    } catch (error) {
        if (error instanceof APIError && error.status === 401) {
            return {
                success: false,
                error: error.data?.message || error.data?.error || t('settings.loginFailed'),
                errorType: 'auth',
            };
        }
        return handleApiError(error, 'login');
    }
}

// [核心修改] saveMisubs 现在接收并发送 profiles
export async function saveMisubs(misubs: unknown, profiles: unknown): Promise<ApiResult> {
    try {
        // 数据预验证
        if (!Array.isArray(misubs) || !Array.isArray(profiles)) {
            return {
                success: false,
                error: t('settings.dataFormatInvalid'),
                errorType: 'validation',
            };
        }

        return await api.post('/api/misubs', { misubs, profiles });
    } catch (error) {
        return handleApiError(error, 'saveMisubs');
    }
}

export async function fetchNodeCount(
    subUrl: string,
    fetchProxy = '',
    plusAsSpace = false,
    userAgent = ''
): Promise<ApiResult> {
    let timeoutId;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

        const payload: Record<string, unknown> = { url: subUrl };
        if (fetchProxy) {
            payload.fetchProxy = fetchProxy;
        }
        if (plusAsSpace) {
            payload.plusAsSpace = true;
        }
        if (userAgent) {
            payload.userAgent = userAgent;
        }

        const data = await api.post('/api/node_count', payload, { signal: controller.signal });

        if (data?.success === false) {
            return normalizeApiFailure(data, t('settings.updateNodeInfoFailed'));
        }

        return { success: true, data }; // data 包含 { count, userInfo }
    } catch (error) {
        return handleApiError(error, 'fetchNodeCount');
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function fetchSettings() {
    try {
        const data = await api.get(`/api/settings?t=${Date.now()}`);
        return { success: true, data };
    } catch (error) {
        return handleApiError(error, 'fetchSettings');
    }
}

export async function fetchPublicConfig() {
    let timeoutId;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 8000);
        const headers =
            typeof window !== 'undefined' && window.location?.pathname
                ? { 'X-MiSub-Path': window.location.pathname }
                : undefined;
        const data = await api.get('/api/public_config', {
            signal: controller.signal,
            headers,
        });
        return { success: true, data };
    } catch (error) {
        return handleApiError(error, 'fetchPublicConfig');
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function saveSettings(settings: Record<string, unknown>) {
    try {
        return await api.post('/api/settings', settings);
    } catch (error) {
        return handleApiError(error, 'saveSettings');
    }
}

/**
 * 恢复出厂设置（仅限设置项，不删除节点和订阅组）
 * @returns {Promise<Object>} - 重置结果
 */
export async function resetSettings() {
    try {
        return await api.post('/api/settings/reset');
    } catch (error) {
        return handleApiError(error, 'resetSettings');
    }
}

/**
 * 批量更新订阅的节点信息
 * @param {string[]} subscriptionIds - 要更新的订阅ID数组
 * @returns {Promise<Object>} - 更新结果
 */
export async function batchUpdateNodes(subscriptionIds: string[]): Promise<BatchUpdateResult> {
    let timeoutId;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时

        const result = await api.post(
            '/api/batch_update_nodes',
            { subscriptionIds },
            { signal: controller.signal }
        );

        if (result?.success === false) {
            return normalizeApiFailure(result, '批量更新节点信息失败');
        }

        return result;
    } catch (error) {
        return handleApiError(error, 'batchUpdateNodes');
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 数据迁移：从 KV 迁移到 D1 数据库
 * @returns {Promise<Object>} - 迁移结果
 */
export async function migrateToD1() {
    try {
        return await api.post('/api/migrate_to_d1');
    } catch (error) {
        if (error instanceof APIError) {
            return {
                success: false,
                error: error.message,
                errorType: 'server',
                details: error.data?.details || error.data?.errors,
            };
        }
        return handleApiError(error, 'migrateToD1');
    }
}

export async function detectLegacyD1() {
    try {
        return await api.get('/api/detect_legacy_d1');
    } catch (error) {
        return handleApiError(error, 'detectLegacyD1');
    }
}

export async function migrateLegacyD1() {
    try {
        return await api.post('/api/migrate_legacy_d1');
    } catch (error) {
        if (error instanceof APIError) {
            return {
                success: false,
                error: error.message,
                errorType: 'server',
                details: error.data?.details || error.data?.errors,
            };
        }
        return handleApiError(error, 'migrateLegacyD1');
    }
}

export async function fetchGithubLatestRelease(repo: string): Promise<GithubReleaseResult> {
    try {
        return await api.get(`/api/github/release?repo=${encodeURIComponent(repo)}`);
    } catch (error) {
        return handleApiError(error, 'fetchGithubLatestRelease');
    }
}

export async function testSubconverterBackend(
    backend: string,
    target = 'clash'
): Promise<SubconverterTestResult> {
    let timeoutId;
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 30000);
        const data = await api.post(
            '/api/subconverter/test',
            { backend, target },
            { signal: controller.signal }
        );
        return data;
    } catch (error) {
        return handleApiError(error, 'testSubconverterBackend');
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 测试订阅链接内容
 * @param {string} url - 订阅URL
 * @param {string} userAgent - User-Agent
 * @returns {Promise<Object>} - 测试结果
 */
export async function testSubscription(url: string, userAgent: string): Promise<ApiResult> {
    try {
        return await api.post('/api/debug_subscription', { url, userAgent });
    } catch (error) {
        return handleApiError(error, 'testSubscription');
    }
}
