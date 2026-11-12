/**
 * 上游订阅拉取：带重试的 fetch、并发限制器与小工具
 * 从 subscription-service.js 拆分而来；编排器见 ../subscription-service.js。
 */

import { createTimeoutFetch } from '../../modules/utils.js';

/**
 * 订阅获取配置常量
 */
export const FETCH_CONFIG = {
    TIMEOUT: 18000, // 单次请求超时 18 秒
    MAX_RETRIES: 2, // 最多重试 2 次
    BASE_DELAY: 1000, // 重试基础延迟 1 秒
    CONCURRENCY: 4, // 最大并发数
    RETRYABLE_STATUS: [500, 502, 503, 504, 429], // 可重试的 HTTP 状态码
};

export async function fetchWithRetry(url, init = {}, options = {}) {
    const {
        timeout = FETCH_CONFIG.TIMEOUT,
        maxRetries = FETCH_CONFIG.MAX_RETRIES,
        baseDelay = FETCH_CONFIG.BASE_DELAY,
        retryableStatus = FETCH_CONFIG.RETRYABLE_STATUS,
    } = options;

    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await createTimeoutFetch(url, init, timeout);

            // 检查是否需要重试（可重试的 HTTP 状态码）
            if (!response.ok && retryableStatus.includes(response.status)) {
                if (attempt < maxRetries) {
                    // 计算延迟：优先使用 Retry-After 头，否则使用指数退避
                    let delay = baseDelay * Math.pow(2, attempt);
                    const retryAfter = response.headers.get('Retry-After');
                    if (retryAfter) {
                        const retryAfterSeconds = parseInt(retryAfter, 10);
                        if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                            delay = Math.min(retryAfterSeconds * 1000, 30000); // 最多等待 30 秒
                        }
                    }

                    console.warn(
                        `[Retry] HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`
                    );

                    // 释放响应体，避免连接占用
                    try {
                        await response.body?.cancel();
                    } catch (cancelError) {
                        console.debug('[Retry] Failed to cancel response body:', cancelError);
                    }

                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                // 最后一次重试仍失败，保存响应供上层处理
                lastResponse = response;
            }

            return response;
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) {
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(
                `[Retry] ${error.message} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // 如果有最后的响应（可重试状态码耗尽），返回它
    if (lastResponse) {
        return lastResponse;
    }

    throw lastError;
}

/**
 * 确保配置是数组格式（处理 D1 数据库可能返回的 JSON 字符串）
 */
export function ensureArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

/**
 * 并发控制器 - 限制同时进行的请求数量
 * @param {number} limit - 最大并发数
 * @returns {Function} - 包装函数
 */
export function createConcurrencyLimiter(limit) {
    const safeLimit = Math.max(1, limit || 1); // 防御性检查，确保至少为 1
    let running = 0;
    const queue = [];

    const runNext = () => {
        if (running >= safeLimit || queue.length === 0) return;
        running++;
        const { task, resolve, reject } = queue.shift();
        // 使用 Promise.resolve().then() 包装，确保同步异常也能被捕获
        Promise.resolve()
            .then(task)
            .then(resolve)
            .catch(reject)
            .finally(() => {
                running--;
                runNext();
            });
    };

    return (task) =>
        new Promise((resolve, reject) => {
            queue.push({ task, resolve, reject });
            runNext();
        });
}
