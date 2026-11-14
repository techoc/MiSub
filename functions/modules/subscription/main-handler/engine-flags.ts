/**
 * 转换引擎（内置 / 外部 subconverter）选择与内置请求参数解析
 * 从 main-handler.js 拆分而来；编排器见 ../main-handler.js。
 */

import { isHiddifyAgent } from '../user-agent-utils.ts';
import { resolveGeneratorOptions } from '../generator-options.ts';
import { normalizeDnsMode } from '../safe-dns.ts';

export function resolveBuiltinEngineFlags(config: Record<string, any> = {}, isExternalMode = false) {
    if (isExternalMode) {
        return {
            shouldSkipCertificateVerify: false,
            shouldEnableUdp: false,
        };
    }

    return {
        shouldSkipCertificateVerify: Boolean(config.builtinSkipCertVerify),
        shouldEnableUdp: Boolean(config.builtinEnableUdp),
    };
}

export function resolveEffectiveEngine({
    searchParams,
    userAgent = '',
    profileEngineMode = '',
    globalEngineMode = '',
} = {}) {
    const params = searchParams || new URLSearchParams('');
    const builtinParam = (params.get('builtin') || '').toLowerCase();
    const engineParam = (params.get('engine') || '').toLowerCase();
    const hasExplicitFormat = Boolean(
        params.get('target') ||
        params.has('clash') ||
        params.has('singbox') ||
        params.has('surge') ||
        params.has('loon') ||
        params.has('quanx') ||
        params.has('egern') ||
        params.has('base64') ||
        params.has('v2ray') ||
        params.has('trojan') ||
        params.has('nodes')
    );

    if (engineParam) return engineParam;
    if (builtinParam === 'external') return 'external';
    if (builtinParam === 'true' || builtinParam === '1' || builtinParam === 'builtin')
        return 'builtin';

    if (!hasExplicitFormat && isHiddifyAgent(userAgent)) {
        return 'builtin';
    }

    return profileEngineMode || globalEngineMode || 'builtin';
}

function parseToggleValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return null;
}

/**
 * 解析模板注入开关（URL 参数 > 配置值 > 默认值）。
 * 用于 AI 服务分组注入（ai-inject / aiInject）与 DNS 出口策略组注入（dns-inject / dnsInject）。
 * @param {URLSearchParams} searchParams - 请求 URL 参数
 * @param {string[]} paramNames - 支持的参数名（按优先级排列）
 * @param {boolean|string|undefined} configValue - 全局/Profile 配置里的开关值
 * @param {boolean} fallback - 都未设置时的默认值
 * @returns {boolean}
 */
export function resolveInjectionToggle(
    searchParams,
    paramNames = [],
    configValue,
    fallback = true
) {
    const params = searchParams || new URLSearchParams('');
    for (const name of paramNames) {
        if (!params.has(name)) continue;
        const fromParam = parseToggleValue(params.get(name));
        if (fromParam !== null) return fromParam;
    }
    const fromConfig = parseToggleValue(configValue);
    if (fromConfig !== null) return fromConfig;
    return fallback;
}

export function resolveBuiltinRequestOptions({
    searchParams,
    userAgent = '',
    generatorOptions = {},
} = {}) {
    const params = searchParams || new URLSearchParams('');
    const dnsMode = params.get('dns-mode') || params.get('dnsMode') || '';
    return {
        userAgent,
        searchParams: params,
        hiddifyCompatible: isHiddifyAgent(userAgent),
        dnsMode: normalizeDnsMode(dnsMode),
        generatorOptions: resolveGeneratorOptions(generatorOptions, params),
    };
}

export function shouldRenderClashYamlProfileTemplateLocally({
    isExternalMode = false,
    targetFormat = '',
    templateSource = {},
} = {}) {
    if (!isExternalMode || targetFormat !== 'clash' || templateSource?.kind !== 'remote')
        return false;
    try {
        const parsed = new URL(String(templateSource.value || '').trim());
        return /\.ya?ml$/i.test(parsed.pathname);
    } catch {
        return /\.ya?ml(?:[?#].*)?$/i.test(String(templateSource.value || '').trim());
    }
}
