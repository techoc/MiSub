/**
 * 节点转换共享基础：解析/编码工具、正则告警去重、配置归一化、地区映射。
 * 从 utils/node-transformer.js（facade）拆分而来。
 */

import { REGION_KEYWORDS } from '../../modules/utils/geo-utils.ts';

// ============ 默认配置 ============

const DEFAULT_SORT_KEYS = [
    {
        key: 'region',
        order: 'asc',
        customOrder: [
            '香港',
            '台湾',
            '日本',
            '新加坡',
            '美国',
            '韩国',
            '英国',
            '德国',
            '法国',
            '加拿大',
        ],
    },
    {
        key: 'protocol',
        order: 'asc',
        customOrder: ['vless', 'trojan', 'vmess', 'hysteria2', 'ss', 'ssr', 'anytls'],
    },
    { key: 'name', order: 'asc' },
];

const REGION_CODE_TO_ZH = buildRegionCodeToZhMap();
const REGION_ZH_TO_CODE = buildZhToCodeMap();
export const warnedRegexRules = new Set<string>();
export const VIRTUAL_INFO_NODE_UUID = '00000000-0000-0000-0000-000000000000';

/** 归一化任意值为普通对象（非对象则为空对象） */
function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function warnInvalidRegex(
    rule: { pattern?: string; flags?: string },
    error: unknown
) {
    const key = `${rule.pattern || ''}|${rule.flags || ''}`;
    if (warnedRegexRules.has(key)) return;
    warnedRegexRules.add(key);
    console.warn('[NodeTransform] Invalid rename regex:', {
        pattern: rule.pattern,
        flags: rule.flags,
        error: (error as { message?: string } | undefined)?.message || String(error),
    });
}

// ============ 工具函数 ============

export function safeDecodeURI(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function normalizeBase64(input: unknown): string {
    let s = String(input || '')
        .trim()
        .replace(/\s+/g, '');
    if (!s) return '';
    // 处理可能被 URL 编码的 Base64
    if (s.includes('%')) {
        try {
            s = decodeURIComponent(s);
        } catch (error) {
            console.debug('[NodeTransform] Failed to decode base64 segment:', error);
        }
    }
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    return s;
}

export function base64UrlEncode(text: unknown): string {
    return base64Encode(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getSchemePayload(url: unknown, prefixLen: number): string {
    const rest = String(url || '').slice(prefixLen);
    const cut = rest.search(/[?#]/);
    return (cut === -1 ? rest : rest.slice(0, cut)).trim();
}

export function splitSchemeQueryAndFragment(
    url: unknown,
    prefixLen: number
): { payload: string; query: string; hasFragment: boolean } {
    const rest = String(url || '').slice(prefixLen);
    const hashIdx = rest.indexOf('#');
    const queryIdx = rest.indexOf('?');
    const queryActive = queryIdx !== -1 && (hashIdx === -1 || queryIdx < hashIdx);
    let payloadEnd = -1;
    if (hashIdx !== -1) payloadEnd = hashIdx;
    if (queryActive) payloadEnd = payloadEnd === -1 ? queryIdx : Math.min(payloadEnd, queryIdx);
    const payload = (payloadEnd === -1 ? rest : rest.slice(0, payloadEnd)).trim();
    const query = queryActive ? rest.slice(queryIdx, hashIdx === -1 ? undefined : hashIdx) : '';
    return { payload, query, hasFragment: hashIdx !== -1 };
}

export function base64Decode(base64: unknown): string {
    const binary = atob(normalizeBase64(base64));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
}

export function base64Encode(text: unknown): string {
    const bytes = new TextEncoder().encode(String(text));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export function getProtocol(url: unknown): string {
    const m = String(url || '').match(/^([a-zA-Z0-9+.-]+):\/\//);
    return m ? m[1].toLowerCase() : 'unknown';
}

/**
 * 归一化协议名称，将别名统一为标准名
 */
export function normalizeProtocol(proto: unknown): string {
    const p = String(proto || 'unknown').toLowerCase();
    if (p === 'hy' || p === 'hy2' || p === 'hysteria') return 'hysteria2';
    return p;
}

export function getFragment(url: string): string {
    const idx = String(url || '').lastIndexOf('#');
    if (idx === -1) return '';
    return safeDecodeURI(url.slice(idx + 1)).trim();
}

export function setFragment(url: string, name: unknown): string {
    const s = String(url || '');
    const idx = s.lastIndexOf('#');
    const base = idx === -1 ? s : s.slice(0, idx);
    return `${base}#${encodeURIComponent(String(name || ''))}`;
}

export function parseHostPort(hostPort: unknown): { server: string; port: string } {
    const s = String(hostPort || '').trim();
    if (!s) return { server: '', port: '' };
    if (s.startsWith('[') && s.includes(']')) {
        const end = s.indexOf(']');
        const host = s.slice(1, end);
        const rest = s.slice(end + 1);
        return { server: host, port: rest.startsWith(':') ? rest.slice(1) : '' };
    }
    const lastColon = s.lastIndexOf(':');
    if (lastColon === -1) return { server: s, port: '' };
    const host = s.slice(0, lastColon);
    if (host.includes(':')) return { server: s, port: '' };
    return { server: host, port: s.slice(lastColon + 1) };
}

// ============ 节点解析 ============

export function stripLeadingEmoji(name: unknown): string {
    return String(name || '')
        .replace(/^[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]\s*/g, '')
        .trim();
}

// ============ 配置标准化 ============

export function normalizeConfig(cfg: unknown) {
    const config = asRecord(cfg);
    const filter = asRecord(config.filter);
    const rename = asRecord(config.rename);
    const regex = asRecord(rename.regex);
    const template = asRecord(rename.template);
    const dedup = asRecord(config.dedup);
    const sort = asRecord(config.sort);
    const include = asRecord(filter.include);
    const exclude = asRecord(filter.exclude);
    const protocols = asRecord(filter.protocols);
    const regions = asRecord(filter.regions);
    const filterScript = asRecord(filter.script);
    const useless = asRecord(filter.useless);
    const renameScript = asRecord(rename.script);
    const dedupPrefer = asRecord(dedup.prefer);

    return {
        enabled: Boolean(config.enabled),
        enableEmoji: config.enableEmoji !== false,
        filter: {
            include: {
                enabled: Boolean(include.enabled),
                rules: Array.isArray(include.rules) ? include.rules : [],
            },
            exclude: {
                enabled: Boolean(exclude.enabled),
                rules: Array.isArray(exclude.rules) ? exclude.rules : [],
            },
            protocols: {
                enabled: Boolean(protocols.enabled),
                values: Array.isArray(protocols.values)
                    ? protocols.values.map((value) => normalizeProtocol(value)).filter(Boolean)
                    : [],
            },
            regions: {
                enabled: Boolean(regions.enabled),
                values: Array.isArray(regions.values)
                    ? regions.values.map((value) => toRegionZh(value)).filter(Boolean)
                    : [],
            },
            script: {
                enabled: Boolean(filterScript.enabled),
                expression: String(filterScript.expression || '').trim(),
            },
            useless: {
                enabled: Boolean(useless.enabled),
            },
        },
        rename: {
            regex: {
                enabled: Boolean(regex.enabled),
                rules: Array.isArray(regex.rules) ? regex.rules : [],
            },
            script: {
                enabled: Boolean(renameScript.enabled),
                expression: String(renameScript.expression || '').trim(),
            },
            template: {
                enabled: Boolean(template.enabled),
                template: String(template.template || '{emoji}{region}-{protocol}-{index}'),
                indexStart:
                    typeof template.indexStart === 'number' && Number.isFinite(template.indexStart)
                        ? template.indexStart
                        : 1,
                indexPad:
                    typeof template.indexPad === 'number' && Number.isFinite(template.indexPad)
                        ? template.indexPad
                        : 2,
                indexScope: String(template.indexScope || 'regionProtocol'),
                regionAlias: asRecord(template.regionAlias),
                protocolAlias: asRecord(template.protocolAlias),
            },
        },
        dedup: {
            enabled: Boolean(dedup.enabled),
            mode: dedup.mode === 'url' ? 'url' : 'serverPort',
            includeProtocol: Boolean(dedup.includeProtocol),
            prefer: {
                protocolOrder: Array.isArray(dedupPrefer.protocolOrder)
                    ? dedupPrefer.protocolOrder.map((s) => String(s).toLowerCase())
                    : [],
            },
        },
        sort: {
            enabled: Boolean(sort.enabled),
            nameIgnoreEmoji: sort.nameIgnoreEmoji !== false,
            keys: Array.isArray(sort.keys) && sort.keys.length > 0 ? sort.keys : DEFAULT_SORT_KEYS,
        },
    };
}

// ============ 转换函数 ============

function buildRegionCodeToZhMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [zhName, keywords] of Object.entries(REGION_KEYWORDS || {})) {
        if (!Array.isArray(keywords)) continue;
        for (const keyword of keywords) {
            const code = String(keyword || '').trim();
            if (/^[A-Za-z]{2,3}$/.test(code)) {
                const upper = code.toUpperCase();
                if (!map[upper]) map[upper] = zhName;
            }
        }
    }
    if (map['GB'] && !map['UK']) map['UK'] = map['GB'];
    return map;
}

/**
 * 构建中文地区名到地区代码的映射
 * 例如: { '美国': 'US', '香港': 'HK' }
 */
function buildZhToCodeMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [zhName, keywords] of Object.entries(REGION_KEYWORDS || {})) {
        if (!Array.isArray(keywords)) continue;
        // 取第一个符合地区代码格式的关键词作为该地区的代码
        for (const keyword of keywords) {
            const code = String(keyword || '').trim();
            if (/^[A-Za-z]{2,3}$/.test(code)) {
                map[zhName] = code.toUpperCase();
                break;
            }
        }
    }
    return map;
}

/**
 * 将中文地区名转换为地区代码
 * @param {string} zhRegion - 中文地区名 (如 '美国')
 * @returns {string} 地区代码 (如 'US')，如未找到则返回原值
 */
export function toRegionCode(zhRegion: unknown): string {
    const region = String(zhRegion || '').trim();
    if (!region) return '';
    // 如果已经是地区代码格式，直接返回大写
    if (/^[A-Za-z]{2,3}$/.test(region)) return region.toUpperCase();
    // 从映射表中查找
    return REGION_ZH_TO_CODE[region] || region;
}

export function toRegionZh(value: unknown): string {
    const region = String(value || '').trim();
    if (!region) return '';
    if (/[\u4e00-\u9fa5]/.test(region)) return region;
    const upper = region.toUpperCase();
    return REGION_CODE_TO_ZH[upper] || region;
}
