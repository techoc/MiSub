/**
 * 模板重命名与去重键（facade 拆分：renderTemplate/applyModifier/makeDedupKey）。
 */

import { toRegionZh } from './shared.js';

export function makeDedupKey(record, cfg) {
    const server = String(record.server || '')
        .trim()
        .toLowerCase();
    const port = String(record.port || '').trim();
    if (!server || !port) return '';
    const base = `${server}:${port}`;
    return cfg.dedup.includeProtocol ? `${record.protocol}|${base}` : base;
}

export function choosePreferred(existing, candidate, protocolOrder) {
    if (!existing) return candidate;
    if (!protocolOrder?.length) return existing;
    const rank = (p) => {
        const idx = protocolOrder.indexOf(String(p || '').toLowerCase());
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return rank(candidate.protocol) < rank(existing.protocol) ? candidate : existing;
}

function applyModifier(key, value, modifier, record) {
    const val = value == null ? '' : String(value);
    switch (modifier) {
        case 'UPPER':
            return val.toUpperCase();
        case 'lower':
            return val.toLowerCase();
        case 'Title':
            return val.charAt(0).toUpperCase() + val.slice(1);
        case 'zh':
            // 对于 region:zh，直接返回 regionZh（中文地区名）
            if (key === 'region' && record && record.regionZh) {
                return record.regionZh;
            }
            return key === 'region' ? toRegionZh(val) : val;
        default:
            // 如果修饰符是数字且 key 是 index，进行补零
            if (key === 'index' && /^\d+$/.test(modifier)) {
                return String(value).padStart(parseInt(modifier), '0');
            }
            return val;
    }
}

export function renderTemplate(template, vars, record) {
    return String(template || '')
        .replace(/\{([a-zA-Z0-9_]+)(?::([a-zA-Z0-9]+))?\}/g, (_, key, modifier) => {
            let v;

            // 优先处理内置变量
            if (Object.prototype.hasOwnProperty.call(vars, key)) {
                v = vars[key];
            }
            // 其次处理正则捕获组变量 {g1}, {g2}, {g_name}
            else if (key.startsWith('g') && record?.regexGroups) {
                const gKey = key.slice(1); // 提取 1, 2, 或 _name
                const gKeyValid = gKey.startsWith('_') ? gKey.slice(1) : gKey;
                v = record.regexGroups[gKeyValid];
            }

            if (v === undefined) return '';

            if (modifier) v = applyModifier(key, v, modifier, record);
            return v == null ? '' : String(v);
        })
        .trim();
}

export function padIndex(n, width) {
    return width > 0 ? String(n).padStart(width, '0') : String(n);
}

export function getIndexGroupKey(record, scope) {
    switch (scope) {
        case 'region':
            return `r:${record.region}`;
        case 'protocol':
            return `p:${record.protocol}`;
        case 'regionProtocol':
            return `rp:${record.region}|${record.protocol}`;
        default:
            return 'global';
    }
}
