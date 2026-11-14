/**
 * 统一日志门控。
 *
 * functions/ 下有数百处 console.*，其中绝大多数是调试日志；在 Workers 日志流里
 * 是持续噪音。这里在入口按 MISUB_LOG_LEVEL 统一门控，不需要改动任何调用点：
 *
 *   - 未设置 / all（默认）：与原来完全一致，全部透传；
 *   - MISUB_LOG_LEVEL=warn：保留 warn / error，抑制 log / debug / info；
 *   - MISUB_LOG_LEVEL=error：仅保留 error。
 *
 * console.warn / console.error 永远不会被 error 级别以下的设置抑制。
 * installLogGate 每个请求调用一次，环境变量变化时自动重新应用（isolate 复用安全）。
 */

const CONSOLE_METHODS = ['log', 'debug', 'info', 'warn', 'error'];
const SUPPRESSED_BY_LEVEL = {
    warn: new Set(['log', 'debug', 'info']),
    error: new Set(['log', 'debug', 'info', 'warn']),
};

const originalConsole = {};
for (const method of CONSOLE_METHODS) {
    (originalConsole as Record<string, any>)[method] = (console as Record<string, any>)[
        method
    ]?.bind(console);
}

let appliedLevel: any = null;

function normalizeLevel(value: any) {
    const level = String(value ?? '')
        .trim()
        .toLowerCase();
    if (level === 'warn' || level === 'error') return level;
    // '' / all / debug / log / info / 未知值 → 不抑制（保持默认行为）
    return null;
}

export function installLogGate(env: any) {
    const level = normalizeLevel(env?.MISUB_LOG_LEVEL);
    if (level === appliedLevel) return;

    appliedLevel = level;
    // 先还原，再按需抑制，避免多次包装叠加
    for (const method of CONSOLE_METHODS) {
        (console as Record<string, any>)[method] = (originalConsole as Record<string, any>)[method];
    }
    if (!level) return;

    const suppressed = SUPPRESSED_BY_LEVEL[level];
    for (const method of CONSOLE_METHODS) {
        if (!suppressed.has(method)) continue;
        (console as Record<string, any>)[method] = () => {};
    }
}
