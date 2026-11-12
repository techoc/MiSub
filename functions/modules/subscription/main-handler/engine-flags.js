/**
 * 转换引擎（内置 / 外部 subconverter）选择与内置请求参数解析
 * 从 main-handler.js 拆分而来；编排器见 ../main-handler.js。
 */

import { isHiddifyAgent } from '../user-agent-utils.js';
import { resolveGeneratorOptions } from '../generator-options.js';

export function resolveBuiltinEngineFlags(config = {}, isExternalMode = false) {
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
        dnsMode: dnsMode.toLowerCase() === 'polluted' ? 'polluted' : 'clean',
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
