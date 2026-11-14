/**
 * 节点清洗与处理工具模块
 * 负责节点URL的解码、修复、重命名和过滤
 */

import type { SubscriptionItem } from '../../../types/models.ts';

/** 解析后的过滤规则集 */
interface ParsedRuleSet {
    protocols: Set<string>;
    nameRegex: RegExp | null;
    hasRules: boolean;
}

/** 过滤规则集（filterNodeObjects 需要的最小面） */
interface NodeFilterRules {
    hasRules?: boolean;
    protocols: Set<string>;
    nameRegex: RegExp | null;
}

/**
 * 修复节点URL编码问题（支持多种协议）
 * @param {string} nodeUrl
 * @returns {string}
 */
export function fixNodeUrlEncoding(nodeUrl: string, options: Record<string, unknown> = {}): string {
    if (!nodeUrl) return '';

    // 辅助函数：安全解码
    const safeDecode = (value: string): string => {
        try {
            return decodeURIComponent(value);
        } catch (e) {
            return value;
        }
    };

    const plusAsSpace = options.plusAsSpace === true;
    const normalizeFragment = (url: string): string => {
        const hashIndex = url.lastIndexOf('#');
        if (hashIndex === -1) return url;

        const base = url.substring(0, hashIndex + 1);
        const rawFragment = url.substring(hashIndex + 1);
        if (!rawFragment) return url;

        const fragmentToDecode = plusAsSpace ? rawFragment.replace(/\+/g, ' ') : rawFragment;
        try {
            const decoded = decodeRepeatedly(fragmentToDecode);
            return base + encodeURIComponent(decoded);
        } catch (e) {
            return url;
        }
    };

    // 辅助函数：最多解码两次，处理双重编码
    const decodeRepeatedly = (value: string, maxRounds = 2): string => {
        let current = value;
        for (let i = 0; i < maxRounds; i += 1) {
            const next = safeDecode(current);
            if (next === current) break;
            current = next;
        }
        return current;
    };

    let fixedUrl = nodeUrl;

    if (fixedUrl.startsWith('vmess://')) {
        return fixedUrl;
    }

    if (fixedUrl.startsWith('ss://')) {
        return fixSSEncoding(fixedUrl, options);
    }

    if (
        fixedUrl.startsWith('trojan://') ||
        fixedUrl.startsWith('vless://') ||
        fixedUrl.startsWith('hy2://') ||
        fixedUrl.startsWith('hysteria2://')
    ) {
        try {
            const urlObj = new URL(fixedUrl);

            // 修复 hash (节点名称)
            if (urlObj.hash) {
                const rawHash = urlObj.hash.substring(1);
                const normalizedHash = plusAsSpace ? rawHash.replace(/\+/g, ' ') : rawHash;
                const decodedHash = decodeRepeatedly(normalizedHash);
                urlObj.hash = '#' + encodeURIComponent(decodedHash);
            }

            // 修复 query params (参数)
            // 简单处理：hysteria2 特殊 fix
            /* ... kept simplified ... */

            return urlObj.toString();
        } catch (e) {
            return normalizeFragment(fixedUrl);
        }
    }

    return fixedUrl;
}

/**
 * 修复SS节点编码
 */
export function fixSSEncoding(nodeUrl: string, options: Record<string, unknown> = {}): string {
    if (!nodeUrl.startsWith('ss://')) return nodeUrl;

    const plusAsSpace = options.plusAsSpace === true;

    const safeDecode = (value: string): string => {
        try {
            return decodeURIComponent(value);
        } catch (e) {
            return value;
        }
    };

    const decodeRepeatedly = (value: string, maxRounds = 2): string => {
        let current = value;
        for (let i = 0; i < maxRounds; i += 1) {
            const next = safeDecode(current);
            if (next === current) break;
            current = next;
        }
        return current;
    };

    const payload = nodeUrl.slice('ss://'.length);
    const hashIndex = payload.indexOf('#');

    const beforeHash = hashIndex === -1 ? payload : payload.slice(0, hashIndex);
    const rawHash = hashIndex === -1 ? '' : payload.slice(hashIndex + 1);

    const atIndex = beforeHash.indexOf('@');
    let normalizedBeforeHash;

    if (atIndex !== -1) {
        const userInfo = beforeHash.slice(0, atIndex);
        const hostPart = beforeHash.slice(atIndex);
        normalizedBeforeHash = `${decodeRepeatedly(userInfo)}${hostPart}`;
    } else {
        normalizedBeforeHash = decodeRepeatedly(beforeHash);
    }

    if (!rawHash) {
        return `ss://${normalizedBeforeHash}`;
    }

    const normalizedHash = encodeURIComponent(
        decodeRepeatedly(plusAsSpace ? rawHash.replace(/\+/g, ' ') : rawHash)
    );
    return `ss://${normalizedBeforeHash}#${normalizedHash}`;
}

/**
 * ArrayBuffer -> Base64
 */
export function encodeArrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

// --- Rule Helpers (Exported) ---

/**
 * 将多行规则文本解析为规则对象
 * @param {string|string[]} lines
 * @param {boolean} stripKeepPrefix
 */
export function buildRuleSet(lines: unknown, stripKeepPrefix = false): ParsedRuleSet {
    const protocols = new Set<string>();
    const patterns: string[] = [];

    const lineArray: string[] = Array.isArray(lines)
        ? lines.map((line) => String(line))
        : typeof lines === 'string'
          ? lines.split('\n')
          : [];

    for (const rawLine of lineArray) {
        let line = rawLine.trim();
        if (!line || line === '---') continue;

        if (stripKeepPrefix && line.toLowerCase().startsWith('keep:')) {
            line = line.substring('keep:'.length).trim();
        }
        if (!line) continue;

        if (line.toLowerCase().startsWith('proto:')) {
            const parts = line
                .substring('proto:'.length)
                .split(',')
                .map((p) => p.trim().toLowerCase())
                .filter(Boolean);
            parts.forEach((p) => protocols.add(p));
            continue;
        }

        patterns.push(line);
    }

    const nameRegex = buildSafeRegex(patterns);
    return {
        protocols,
        nameRegex,
        hasRules: protocols.size > 0 || Boolean(nameRegex),
    };
}

export function buildSafeRegex(patterns: string[]): RegExp | null {
    if (!patterns || patterns.length === 0) return null;
    try {
        return new RegExp(patterns.join('|'), 'i');
    } catch (e) {
        console.warn('Invalid include/exclude regex, skipped:', (e as Error).message);
        return null;
    }
}

export function parseFilterRuleText(ruleText: unknown): {
    includeLines: string[];
    excludeLines: string[];
    includeRules: ParsedRuleSet;
    excludeRules: ParsedRuleSet;
} {
    const lines = Array.isArray(ruleText)
        ? ruleText.map((line) => String(line || '').trim()).filter(Boolean)
        : String(ruleText || '')
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean);

    const includeLines: string[] = [];
    const excludeLines: string[] = [];
    let afterDivider = false;

    for (const line of lines) {
        if (line === '---') {
            afterDivider = true;
            continue;
        }

        if (line.toLowerCase().startsWith('keep:')) {
            includeLines.push(line);
            continue;
        }

        if (afterDivider) {
            includeLines.push(line);
        } else {
            excludeLines.push(line);
        }
    }

    return {
        includeLines,
        excludeLines,
        includeRules: buildRuleSet(includeLines, true),
        excludeRules: buildRuleSet(excludeLines),
    };
}

/**
 * 过滤节点对象列表 (用于 preview/node-fetcher)
 * @param {Array<Object>} nodes
 * @param {Object} rules
 * @param {string} mode 'include' | 'exclude'
 */
export function filterNodeObjects<T extends { protocol?: string; name?: string }>(
    nodes: T[],
    rules: NodeFilterRules | null | undefined,
    mode = 'exclude'
): T[] {
    if (!rules || !rules.hasRules) return nodes;
    const isInclude = mode === 'include';

    return nodes.filter((node) => {
        const protocol = String(node.protocol || '').toLowerCase();
        const name = node.name || '';

        const protocolHit = protocol && rules.protocols.has(protocol);
        const nameHit = rules.nameRegex ? rules.nameRegex.test(name) : false;

        if (isInclude) {
            return Boolean(protocolHit || nameHit);
        }
        return !(protocolHit || nameHit);
    });
}

export function filterNodeUrls(
    nodeUrls: unknown,
    rules: NodeFilterRules | null | undefined,
    mode = 'exclude'
): string[] {
    if (!rules || !rules.hasRules || !Array.isArray(nodeUrls)) return nodeUrls as string[];

    const urls = nodeUrls as string[];
    const nodes = urls.map((url) => ({
        url,
        protocol:
            String(url || '')
                .match(/^(.*?):\/\//)?.[1]
                ?.toLowerCase() || '',
        name: parseNodeUrlName(url),
    }));
    const keptUrls = new Set(filterNodeObjects(nodes, rules, mode).map((node) => node.url));
    return urls.filter((url) => keptUrls.has(url));
}

function parseNodeUrlName(nodeUrl: unknown): string {
    if (!nodeUrl || typeof nodeUrl !== 'string') return '';
    const hashIndex = nodeUrl.lastIndexOf('#');
    if (hashIndex === -1) return nodeUrl;
    try {
        return decodeURIComponent(nodeUrl.substring(hashIndex + 1));
    } catch {
        return nodeUrl.substring(hashIndex + 1);
    }
}

/**
 * 将手动节点的自定义名称应用到节点链接中
 */
export function applyManualNodeName(nodeUrl: string, customName: string): string {
    if (!customName || !nodeUrl) return nodeUrl;

    const encodedName = encodeURIComponent(customName);

    if (nodeUrl.startsWith('vmess://')) {
        try {
            const base64Part = nodeUrl.substring(8);
            const jsonStr = atob(base64Part);
            const config = JSON.parse(jsonStr);
            config.ps = customName;
            return 'vmess://' + btoa(JSON.stringify(config));
        } catch (e) {
            return nodeUrl;
        }
    }

    if (nodeUrl.startsWith('ss://')) {
        const hashIndex = nodeUrl.indexOf('#');
        const baseUrl = hashIndex === -1 ? nodeUrl : nodeUrl.substring(0, hashIndex);
        return `${baseUrl}#${encodedName}`;
    }

    if (
        nodeUrl.startsWith('trojan://') ||
        nodeUrl.startsWith('vless://') ||
        nodeUrl.startsWith('hysteria2://') ||
        nodeUrl.startsWith('hy2://') ||
        nodeUrl.startsWith('tuic://')
    ) {
        try {
            const urlObj = new URL(nodeUrl);
            urlObj.hash = '#' + encodedName;
            return urlObj.toString();
        } catch (e) {
            const hashIndex = nodeUrl.indexOf('#');
            const baseUrl = hashIndex === -1 ? nodeUrl : nodeUrl.substring(0, hashIndex);
            return `${baseUrl}#${encodedName}`;
        }
    }

    // 通用 fallback：对所有其他协议（socks5/http/snell/socks 等）通过 #fragment 写入名称
    const hashIndex = nodeUrl.indexOf('#');
    const baseUrl = hashIndex === -1 ? nodeUrl : nodeUrl.substring(0, hashIndex);
    return `${baseUrl}#${encodedName}`;
}

/**
 * 应用过滤规则 (针对 URL string 列表)
 * @param {Array} validNodes
 * @param {Object} sub
 * @returns {Array} filtered nodes
 */
export function applyFilterRules(
    validNodes: unknown,
    sub: SubscriptionItem | null | undefined
): string[] {
    if (!sub || !Array.isArray(validNodes)) return (validNodes as string[]) ?? [];

    let filteredNodes: string[] = [...(validNodes as string[])];

    // 1. 包含关键词 (Include)
    if (sub.filterInclude && String(sub.filterInclude).trim() !== '') {
        const { includeRules, excludeRules } = parseFilterRuleText(sub.filterInclude);
        if (includeRules.hasRules) {
            filteredNodes = filterNodeUrls(filteredNodes, includeRules, 'include');
        }
        if (excludeRules.hasRules) {
            filteredNodes = filterNodeUrls(filteredNodes, excludeRules, 'exclude');
        }
    }

    // 2. 排除关键词 (Exclude)
    if (sub.filterExclude && String(sub.filterExclude).trim() !== '') {
        const { includeRules, excludeRules } = parseFilterRuleText(sub.filterExclude);
        if (includeRules.hasRules) {
            filteredNodes = filterNodeUrls(filteredNodes, includeRules, 'include');
        }
        if (excludeRules.hasRules) {
            filteredNodes = filterNodeUrls(filteredNodes, excludeRules, 'exclude');
        }
    }

    return filteredNodes;
}
