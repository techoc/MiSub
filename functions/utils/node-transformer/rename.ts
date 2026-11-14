/**
 * 节点重命名/过滤（facade 拆分：正则过滤、伪装节点识别、正则/脚本重命名）。
 */

import { extractNodeRegion, getRegionEmoji } from '../../modules/utils/geo-utils.ts';
import { base64EncodeUtf8 } from '../../modules/utils.ts';
import { evaluateDslExpression, renderDslTemplate } from '../expression-dsl.ts';
import {
    warnInvalidRegex,
    normalizeProtocol,
    toRegionZh,
    toRegionCode,
    VIRTUAL_INFO_NODE_UUID,
} from './shared.ts';

// ============ 转换函数 ============

export function matchesRegexRules(name, rules) {
    const value = String(name || '');
    for (const rule of rules) {
        if (!rule) continue;

        // 兼容规则既可以是对象 {pattern: "...", flags: "..."} 也可以是纯字符串
        const pattern = typeof rule === 'string' ? rule : rule.pattern;
        const flags = typeof rule === 'string' ? 'i' : rule.flags || 'i';

        if (!pattern) continue;

        try {
            const re = new RegExp(pattern, flags);
            if (re.test(value)) return true;
        } catch (error) {
            warnInvalidRegex(typeof rule === 'string' ? { pattern: rule } : rule, error);
        }
    }
    return false;
}

export function ensureRegionInfo(record, enableEmoji = false) {
    if (record.regionZh) return record;

    // 优先使用预解析的元数据
    let regionZh = record.metadata?.regionZh || extractNodeRegion(record.name);
    let regionCode = record.metadata?.region || '';

    if (regionZh === '其他' && record.server) {
        regionZh = extractNodeRegion(record.server);
    }

    if (!regionCode) {
        regionCode = toRegionCode(regionZh);
    }

    const emoji = enableEmoji ? record.metadata?.flag || getRegionEmoji(regionZh) : '';
    return { ...record, region: regionCode, regionZh, emoji };
}

export function isUselessNode(record) {
    const name = String(record?.name || '').trim();
    const protocol = normalizeProtocol(record?.protocol);
    const server = String(record?.server || '')
        .trim()
        .toLowerCase();

    const isVirtualInfoNode =
        protocol === 'trojan' &&
        server === '127.0.0.1' &&
        Number(record?.port) === 443 &&
        String(record?.url || '').includes(`trojan://${VIRTUAL_INFO_NODE_UUID}@127.0.0.1:443#`) &&
        /(?:流量剩余|到期时间|您的订阅已到期)/.test(name);

    if (isVirtualInfoNode) return false;

    if (!name) return true;

    if (
        protocol === 'trojan' &&
        server === '127.0.0.1' &&
        /(?:流量剩余|剩余流量|订阅已失效|订阅已到期|已过期|到期提醒|到期时间|套餐到期|过期时间)/i.test(
            name
        )
    ) {
        return true;
    }

    return /(?:流量剩余|剩余流量|已用流量|总流量|套餐到期|到期时间|过期时间|订阅已失效|订阅已到期|已过期|官网|群组|频道|联系客服|测试节点|回车更新|点击订阅|剩余套餐|订阅信息)/i.test(
        name
    );
}

/**
 * [核心引擎] 将新名称写回不同协议的节点 URL
 * 支持 VMess (JSON-Base64)、VLESS/Trojan/SS (Fragment)
 */
export function setNodeName(url, protocol, newName) {
    if (!url || !newName) return url;
    const proto = String(protocol || '').toLowerCase();

    try {
        if (proto === 'vmess') {
            let base64Part = url.replace('vmess://', '');
            // 处理 URL-Safe Base64
            let safeBody = base64Part.replace(/-/g, '+').replace(/_/g, '/');
            while (safeBody.length % 4) safeBody += '=';

            const decoded = new TextDecoder().decode(
                Uint8Array.from(atob(safeBody), (c) => c.charCodeAt(0))
            );
            const config = JSON.parse(decoded);
            config.ps = newName;

            // 重新编码为标准 Base64 (非 URL-Safe 以保持最大兼容性)
            const newJson = JSON.stringify(config);
            const newBase64 = base64EncodeUtf8(newJson);
            return 'vmess://' + newBase64;
        } else {
            // VLESS / Trojan / SS / Shadowsocks / Hysteria2 / Snell
            // 处理 # 后缀即可
            const hashIndex = url.lastIndexOf('#');
            const baseUrl = hashIndex !== -1 ? url.substring(0, hashIndex) : url;
            return baseUrl + '#' + encodeURIComponent(newName);
        }
    } catch (e) {
        console.warn('[NodeUtils] setNodeName failed:', e);
        return url;
    }
}

export function applyRegexRename(name, rules, record = null) {
    let result = String(name || '');
    if (!Array.isArray(rules)) return result;

    const regexGroups = record?.regexGroups || {};

    for (const rule of rules) {
        if (!rule) continue;

        // 兼容规则既可以是对象 {pattern: "...", flags: "...", replacement: "..."} 也可以是纯字符串
        const pattern = typeof rule === 'string' ? rule : rule.pattern;
        const replacement = typeof rule === 'string' ? '' : rule.replacement || '';
        const flags = typeof rule === 'string' ? 'gi' : rule.flags || 'gi';

        if (!pattern) continue;

        try {
            const re = new RegExp(pattern, flags);

            // 提取捕获组：只对第一次匹配到的内容进行组提取
            const matchMatch = String(result).match(new RegExp(pattern, flags.replace(/g/g, '')));
            if (matchMatch) {
                // 索引组
                matchMatch.forEach((val, i) => {
                    if (i > 0) regexGroups[i] = val || '';
                });
                // 命名组
                if (matchMatch.groups) {
                    for (const [gName, gVal] of Object.entries(matchMatch.groups)) {
                        regexGroups[gName] = gVal || '';
                    }
                }
            }

            result = result.replace(re, replacement);
        } catch (error) {
            warnInvalidRegex(typeof rule === 'string' ? { pattern: rule } : rule, error);
        }
    }

    if (record) {
        record.regexGroups = regexGroups;
    }

    return result.trim();
}

function safeTitle(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function safeContains(value, keyword) {
    return String(value || '')
        .toLowerCase()
        .includes(String(keyword || '').toLowerCase());
}

function safeMatch(value, pattern, flags = 'i') {
    try {
        return new RegExp(pattern, flags).test(String(value || ''));
    } catch {
        return false;
    }
}

function safeFallback(...values) {
    for (const value of values) {
        if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return '';
}

function safePick(condition, truthyValue, falsyValue = '') {
    return condition ? truthyValue : falsyValue;
}

function safeRegionAlias(regionValue) {
    const region = toRegionZh(regionValue);
    const aliases = {
        香港: 'HK',
        台湾: 'TW',
        日本: 'JP',
        新加坡: 'SG',
        美国: 'US',
        韩国: 'KR',
        英国: 'UK',
    };
    return aliases[region] || toRegionCode(region);
}

function safeProtocolAlias(protocolValue) {
    const protocol = normalizeProtocol(protocolValue);
    const aliases = {
        hysteria2: 'hy2',
        shadowsocks: 'ss',
    };
    return aliases[protocol] || protocol;
}

function buildDslContext(record) {
    return {
        name: record.name,
        originalName: record.originalName,
        protocol: record.protocol,
        region: record.region,
        regionZh: record.regionZh,
        emoji: record.emoji,
        server: record.server,
        port: record.port,
        index: record.index ?? '',
        regionAlias: safeRegionAlias(record.regionZh || record.region),
        protocolAlias: safeProtocolAlias(record.protocol),
    };
}

export function applyScriptRename(record, expression) {
    if (!expression) return record.name;
    try {
        const result = renderDslTemplate(
            String(expression).includes('{') ? expression : `{${expression}}`,
            buildDslContext(record)
        );
        return String(result ?? '').trim() || record.name;
    } catch (error) {
        console.warn(
            '[NodeTransform] Invalid rename DSL expression:',
            error?.message || String(error)
        );
        return record.name;
    }
}

export function evaluateScriptExpression(record, expression) {
    if (!expression) return true;
    try {
        return evaluateDslExpression(expression, buildDslContext(record));
    } catch (error) {
        console.warn(
            '[NodeTransform] Invalid filter DSL expression:',
            error?.message || String(error)
        );
        return true;
    }
}
