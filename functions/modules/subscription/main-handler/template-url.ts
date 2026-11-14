/**
 * 模板 URL / 外部转换后端地址的解析与规范化
 * 从 main-handler.js 拆分而来；编排器见 ../main-handler.js。
 */

import { DEFAULT_SUBCONVERTER_BACKEND } from '../../config.ts';
import { assertPublicNetworkUrl } from '../../security-utils.ts';
import { isMetaCore } from '../user-agent-utils.ts';

export function resolveTemplateUrl(mode: any, value: any, fallbackUrl = '') {
    const normalizedMode = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    const normalizedFallback = typeof fallbackUrl === 'string' ? fallbackUrl.trim() : '';

    if (normalizedMode === 'builtin') return '';
    if (normalizedMode === 'global') return normalizedFallback;
    if (normalizedMode === 'custom_template') {
        return normalizedValue.startsWith('custom:') ? normalizedValue : '';
    }
    if (normalizedMode === 'preset' || normalizedMode === 'custom') return normalizedValue;

    return normalizedValue;
}

export function resolveTemplateSource(value: any) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue) return { kind: 'none', value: '' };
    if (normalizedValue.startsWith('builtin:')) {
        return { kind: 'builtin', value: normalizedValue.slice('builtin:'.length) };
    }
    if (normalizedValue.startsWith('custom:')) {
        return { kind: 'custom', value: normalizedValue.slice('custom:'.length) };
    }
    return { kind: 'remote', value: normalizedValue };
}

export function resolveExternalTemplateConfigUrl(templateSource: any) {
    if (!templateSource || typeof templateSource !== 'object') return '';
    if (templateSource.kind !== 'remote') return '';
    return normalizeExternalTemplateConfigUrl(String(templateSource.value || '').trim());
}

export function normalizeExternalTemplateConfigUrl(input: any) {
    const raw = typeof input === 'string' ? input.trim() : '';
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        if (parsed.hostname.toLowerCase() !== 'github.com') {
            return raw;
        }

        const parts = parsed.pathname.split('/').filter(Boolean);
        const markerIndex = parts.findIndex((part) => part === 'blob' || part === 'raw');
        if (parts.length < 5 || markerIndex !== 2) {
            return raw;
        }

        const [owner, repo, , branch, ...fileParts] = parts;
        if (!owner || !repo || !branch || fileParts.length === 0) {
            return raw;
        }

        const rawUrl = new URL(
            `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fileParts.join('/')}`
        );
        rawUrl.search = parsed.search;
        return rawUrl.toString();
    } catch {
        return raw;
    }
}

export function normalizeSubconverterBackend(input: any, fallback = DEFAULT_SUBCONVERTER_BACKEND) {
    let backend = String(input || fallback || DEFAULT_SUBCONVERTER_BACKEND).trim();

    // 防止历史 UI 文案或标签被误保存为后端地址。
    if (!backend || backend.includes('后端') || backend.includes('参数')) {
        backend = fallback || DEFAULT_SUBCONVERTER_BACKEND;
    }

    // 用户只需填写 host，例如 subapi.cmliussss.net 或 api.v1.mk。
    // 兼容历史完整 URL，但统一规范为 https://<host>/sub。
    backend = backend.replace(/\s+/g, '');
    if (!/^https?:\/\//i.test(backend)) {
        backend = `https://${backend}`;
    }

    const externalUrl = assertPublicNetworkUrl(backend);
    if (externalUrl!.pathname === '/' || !externalUrl!.pathname) {
        externalUrl!.pathname = '/sub';
    }
    if (externalUrl!.pathname !== '/sub') {
        externalUrl!.pathname = '/sub';
    }

    // 历史默认值可能保存为 /sub?；URL 会自动消除空 query。
    externalUrl!.hash = '';
    return externalUrl;
}

export function buildExternalSubconverterUrl({
    backend,
    targetFormat,
    nodeList,
    requestUrl,
    profileSub = {},
    globalSub = {},
    userAgent = '',
    searchParams,
    templateSource,
    subName = '',
}: Record<string, any> = {}) {
    const externalUrl = normalizeSubconverterBackend(backend);
    const params = searchParams || new URLSearchParams('');

    // [优化] 解析 targetFormat，支持带参数的格式（如 surge&ver=4）
    const [targetBase, ...targetParams] = String(targetFormat || '').split('&');
    externalUrl!.searchParams.set('target', targetBase || 'clash');
    targetParams.forEach((p) => {
        const [k, v] = p.split('=');
        if (k && v) externalUrl!.searchParams.set(k, v);
    });

    if (requestUrl) {
        const dataSourceUrl = new URL(requestUrl);
        const paramsToClear = [
            'target',
            'engine',
            'builtin',
            'clash',
            'singbox',
            'surge',
            'loon',
            'quanx',
            'egern',
            'base64',
            'v2ray',
            'trojan',
            'nodes',
            'list',
            'backend',
            'refresh',
            'nocache',
            'debug',
        ];
        paramsToClear.forEach((p) => dataSourceUrl.searchParams.delete(p));
        dataSourceUrl.searchParams.set('base64', '');
        dataSourceUrl.searchParams.set('callback_token', 'external');
        externalUrl!.searchParams.set('url', dataSourceUrl.toString());
    } else {
        const normalizedNodeList = String(nodeList || '').trim();
        if (normalizedNodeList) {
            const inlineNodeList = normalizedNodeList
                .split(/\r?\n+/)
                .map((line) => line.trim())
                .filter(Boolean)
                .join('|');
            externalUrl!.searchParams.set('url', inlineNodeList);
        }
    }

    const effectiveOptions = {
        ...((globalSub as Record<string, any>).defaultOptions || {}),
        ...((profileSub as Record<string, any>).options || {}),
    };
    const flagMap = {
        udp: 'udp',
        emoji: 'emoji',
        scv: 'scv',
        sort: 'sort',
        tfo: 'tfo',
        list: 'list',
    };

    if (isMetaCore(userAgent, params)) {
        externalUrl!.searchParams.set('meta', 'true');
    }

    Object.entries(flagMap).forEach(([key, paramName]) => {
        const val = params.has(paramName)
            ? params.get(paramName) === 'true'
            : effectiveOptions[key];
        externalUrl!.searchParams.set(paramName, val ? 'true' : 'false');
    });

    const externalTemplateConfigUrl = resolveExternalTemplateConfigUrl(templateSource);
    if (externalTemplateConfigUrl) {
        externalUrl!.searchParams.set('config', externalTemplateConfigUrl);
    }

    externalUrl!.searchParams.set('filename', subName);
    return externalUrl;
}
