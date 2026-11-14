/**
 * 地理识别工具模块
 * 提供节点地区识别和相关功能
 * 数据表见 ./geo-data.js
 */

import { REGION_EMOJI, REGION_KEYWORDS } from './geo-data.ts';

// 数据表已拆分至 geo-data.js；这里原样重新导出，保持既有 import 路径不变。
export { REGION_KEYWORDS, REGION_EMOJI } from './geo-data.ts';

function normalizeBase64(input) {
    let s = String(input || '')
        .trim()
        .replace(/\s+/g, '');
    if (!s) return '';
    if (s.includes('%')) {
        try {
            s = decodeURIComponent(s);
        } catch {
            // keep raw when decode fails
        }
    }
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
}

function isLikelyBase64(input) {
    const s = String(input || '').trim();
    if (!s) return false;
    if (!/^[A-Za-z0-9+/=_-]+$/.test(s)) return false;
    return s.length >= 6;
}

function tryDecodeBase64(input) {
    if (!isLikelyBase64(input)) return null;
    try {
        return atob(normalizeBase64(input));
    } catch {
        return null;
    }
}

function parseHostPort(value) {
    let segment = String(value || '');
    if (!segment) return { server: '', port: '' };
    const cut = segment.search(/[/?#]/);
    if (cut !== -1) segment = segment.slice(0, cut);

    if (segment.startsWith('[')) {
        const closeBracket = segment.indexOf(']');
        if (closeBracket !== -1) {
            const server = segment.slice(1, closeBracket);
            const after = segment.slice(closeBracket + 1);
            const port = after.startsWith(':') ? after.slice(1).split('/')[0] : '';
            return { server, port };
        }
    }

    const parts = segment.split(':');
    if (parts.length >= 2) {
        return { server: parts[0], port: parts[1].split('/')[0] };
    }
    return { server: segment, port: '' };
}

/**
 * 从节点名称中识别地区
 * @param {string} nodeName - 节点名称
 * @returns {string} 识别出的地区，如未识别返回"其他"
 */
export function extractNodeRegion(nodeName) {
    if (!nodeName || typeof nodeName !== 'string') {
        return '其他';
    }

    const normalizedNodeName = nodeName.toLowerCase();

    // 遍历所有地区关键词
    for (const [regionName, keywords] of Object.entries(REGION_KEYWORDS)) {
        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();

            // 对于短关键词（2-3个字符的纯英文），要求匹配独立单词边界
            // 避免 "kristi" 匹配 "kr"，"user" 匹配 "us" 等误匹配
            if (lowerKeyword.length <= 3 && /^[a-z]+$/i.test(lowerKeyword)) {
                // 使用更兼容的方式检查单词边界（不使用 lookbehind）
                const idx = normalizedNodeName.indexOf(lowerKeyword);
                if (idx !== -1) {
                    // 检查前一个字符
                    const charBefore = idx > 0 ? normalizedNodeName[idx - 1] : '';
                    const isLetterBefore = charBefore && /[a-z]/i.test(charBefore);

                    // 检查后一个字符
                    const charAfter = normalizedNodeName[idx + lowerKeyword.length] || '';
                    const isLetterAfter = charAfter && /[a-z]/i.test(charAfter);

                    // 只有当前后都不是字母时才匹配
                    if (!isLetterBefore && !isLetterAfter) {
                        return regionName;
                    }
                }
            } else {
                // 对于长关键词或中文，直接使用 includes
                if (normalizedNodeName.includes(lowerKeyword)) {
                    return regionName;
                }
            }
        }
    }

    return '其他';
}

/**
 * 获取所有支持的地区列表
 * @returns {string[]} 支持的地区名称数组
 */
export function getSupportedRegions() {
    return Object.keys(REGION_KEYWORDS);
}

/**
 * 获取指定地区的所有关键词
 * @param {string} region - 地区名称
 * @returns {string[]} 该地区的所有关键词，如地区不存在返回空数组
 */
export function getRegionKeywords(region) {
    return REGION_KEYWORDS[region] || [];
}

/**
 * [新增] 获取地区 Emoji
 * @param {string} region - 地区名称
 * @returns {string} 对应的 Emoji，如果未找到则返回空字符串
 */
export function getRegionEmoji(region) {
    return REGION_EMOJI[region] || (region === '其他' || !region ? '🌍' : '');
}

/**
 * 检查节点名称是否包含指定地区
 * @param {string} nodeName - 节点名称
 * @param {string} region - 要检查的地区
 * @returns {boolean} 是否包含该地区
 */
export function containsRegion(nodeName, region) {
    if (!nodeName || !region || !REGION_KEYWORDS[region]) {
        return false;
    }

    const normalizedNodeName = nodeName.toLowerCase();
    const keywords = REGION_KEYWORDS[region];

    for (const keyword of keywords) {
        if (normalizedNodeName.includes(keyword.toLowerCase())) {
            return true;
        }
    }

    return false;
}

/**
 * 获取节点的详细信息（协议、名称、地区等）
 * @param {string} nodeUrl - 节点URL
 * @returns {Object} 节点详细信息
 */
export function parseNodeInfo(nodeUrl) {
    if (!nodeUrl || typeof nodeUrl !== 'string') {
        return {
            protocol: 'unknown',
            name: '未命名节点',
            region: '其他',
            url: nodeUrl,
        };
    }

    // 提取协议
    const protocolMatch = nodeUrl.match(/^(.*?):\/\//);
    const protocol = protocolMatch ? protocolMatch[1].toLowerCase() : 'unknown';

    // 提取节点名称
    let nodeName = '';
    const hashIndex = nodeUrl.lastIndexOf('#');
    if (hashIndex !== -1) {
        try {
            nodeName = decodeURIComponent(nodeUrl.substring(hashIndex + 1));
        } catch (e) {
            nodeName = nodeUrl.substring(hashIndex + 1);
        }
    }

    // [增强] 如果 Hash 中没有名称，尝试从 URL 参数中提取 (支持 remarks, des, remark)
    if (!nodeName) {
        const paramsMatch = nodeUrl.match(/[?&](remarks|des|remark)=([^&#]+)/);
        if (paramsMatch && paramsMatch[2]) {
            try {
                nodeName = decodeURIComponent(paramsMatch[2]);
            } catch (e) {
                nodeName = paramsMatch[2];
            }
        }
    }

    // 如果没有名称，从URL生成一个
    if (!nodeName) {
        // 从URL中提取一些信息作为名称
        const urlWithoutProtocol = nodeUrl.replace(/^[^:]*:\/\//, '');
        const urlParts = urlWithoutProtocol.split(/[:@?#]/);
        nodeName = urlParts[0] || '未命名节点';
    }

    // [修复] 将台湾旗帜替换为中国国旗
    nodeName = nodeName.replace(/🇹🇼/g, '🇨🇳');

    // [新增] 提取服务器地址和端口
    let server = '';
    let port = '';

    try {
        if (protocol === 'vmess') {
            const base64Part = nodeUrl.replace('vmess://', '').split('#')[0].split('?')[0].trim();
            if (base64Part && !base64Part.includes('@')) {
                // 排除可能是明文的情况(虽然vmess少见)
                try {
                    // 处理 URL-safe Base64 字符
                    let safeBody = base64Part.replace(/-/g, '+').replace(/_/g, '/');
                    // 补全 Padding
                    while (safeBody.length % 4) {
                        safeBody += '=';
                    }
                    const jsonStr = atob(safeBody); // 使用 decodeURIComponent(escape(atob(safeBody))) 处理中文?
                    // 不, atob 解码后通常是 UTF-8 字节流乱码 if directly used as string for Chinese
                    // 需要用 TextDecoder
                    const binaryString = atob(safeBody);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const decodedStr = new TextDecoder('utf-8').decode(bytes);

                    const config = JSON.parse(decodedStr);
                    server = config.add || config.host || '';
                    port = config.port || '';
                    // [Fix] 提取名称
                    if (config.ps) {
                        nodeName = config.ps;
                    }
                } catch (e) {
                    console.debug('[GeoUtils] VMess base64 decode failed:', e);
                }
            }
        } else if (protocol === 'ss') {
            // ss://base64(user:pass@host:port)#name
            // 或者 ss://base64(user:pass)@host:port#name
            let body = nodeUrl.substring(5); // remove ss://
            const hIndex = body.indexOf('#');
            if (hIndex !== -1) body = body.substring(0, hIndex);
            const qIndex = body.indexOf('?');
            if (qIndex !== -1) body = body.substring(0, qIndex);

            const atLast = body.lastIndexOf('@');
            let serverPart = '';
            if (atLast !== -1) {
                // 明文或 SIP002 (base64 userinfo)
                serverPart = body.substring(atLast + 1);
            } else {
                const decoded = tryDecodeBase64(body);
                if (decoded && decoded.includes('@')) {
                    serverPart = decoded.substring(decoded.lastIndexOf('@') + 1);
                } else {
                    serverPart = body;
                }
            }

            const parsed = parseHostPort(serverPart);
            server = parsed.server;
            port = parsed.port;
        } else if (protocol === 'ssr') {
            // SSR 格式: ssr://base64(server:port:protocol:method:obfs:base64(password)/?params)
            // params 中包含 remarks=base64(name), obfsparam=..., protoparam=...
            try {
                let payload = nodeUrl.substring(6); // 去掉 ssr://
                // 去掉可能存在的 # fragment
                const hIdx = payload.indexOf('#');
                if (hIdx !== -1) payload = payload.substring(0, hIdx);
                // 去掉外层查询参数（不常见但防御性处理）
                const qIdx = payload.indexOf('?');
                if (qIdx !== -1) payload = payload.substring(0, qIdx);

                const decoded = tryDecodeBase64(payload);
                if (decoded) {
                    // 解析 server:port:protocol:method:obfs:password_base64/?params
                    // server 可能是 IPv6 [::1]
                    let ssrServer = '',
                        ssrPort = '';
                    if (decoded.startsWith('[')) {
                        // IPv6 格式: [ipv6]:port:...
                        const closeBracket = decoded.indexOf(']');
                        if (closeBracket !== -1) {
                            ssrServer = decoded.substring(1, closeBracket);
                            const afterBracket = decoded.substring(closeBracket + 1);
                            const portMatch = afterBracket.match(/^:(\d+):/);
                            if (portMatch) ssrPort = portMatch[1];
                        }
                    } else {
                        // IPv4/domain 格式: host:port:...
                        const colonParts = decoded.split(':');
                        if (colonParts.length >= 2) {
                            ssrServer = colonParts[0];
                            ssrPort = colonParts[1];
                        }
                    }
                    server = ssrServer;
                    port = ssrPort;

                    // 提取 remarks 名称（SSR 名称在 Base64 编码的 remarks 参数中）
                    const slashQ = decoded.indexOf('/?');
                    const paramStart =
                        slashQ !== -1
                            ? slashQ + 2
                            : decoded.indexOf('?') !== -1
                              ? decoded.indexOf('?') + 1
                              : -1;
                    if (paramStart !== -1) {
                        const paramStr = decoded.substring(paramStart);
                        const remarksMatch = paramStr.match(/(?:^|&)remarks=([^&]*)/);
                        if (remarksMatch && remarksMatch[1]) {
                            const remarksB64 = remarksMatch[1].replace(/\s+/g, '');
                            // remarks 通常包含中文，需要 UTF-8 安全解码
                            try {
                                const normalized = normalizeBase64(remarksB64);
                                const binaryString = atob(normalized);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                const remarksDecoded = new TextDecoder('utf-8').decode(bytes);
                                if (remarksDecoded) {
                                    nodeName = remarksDecoded.trim();
                                }
                            } catch (e) {
                                // Base64 解码失败，尝试使用原始值
                                const fallback = tryDecodeBase64(remarksB64);
                                if (fallback) nodeName = fallback.trim();
                            }
                        }
                    }
                }
            } catch (e) {
                console.debug('[GeoUtils] SSR decode failed:', e);
            }
        } else if (protocol === 'wireguard') {
            // WireGuard 格式: wireguard://privatekey@server:port?params#name
            let body = nodeUrl.substring('wireguard://'.length);

            // 提取名称
            const hIndex = body.indexOf('#');
            if (hIndex !== -1) {
                try {
                    nodeName = decodeURIComponent(body.substring(hIndex + 1));
                } catch (e) {
                    nodeName = body.substring(hIndex + 1);
                }
                body = body.substring(0, hIndex);
            }

            // 提取服务器和端口
            const atIndex = body.lastIndexOf('@');
            if (atIndex !== -1) {
                const serverPart = body.substring(atIndex + 1);
                const qIndex = serverPart.indexOf('?');
                const addrPart = qIndex !== -1 ? serverPart.substring(0, qIndex) : serverPart;

                // 处理 IPv6
                if (addrPart.startsWith('[')) {
                    const closeBracket = addrPart.indexOf(']');
                    if (closeBracket !== -1) {
                        server = addrPart.substring(1, closeBracket);
                        const afterBracket = addrPart.substring(closeBracket + 1);
                        if (afterBracket.startsWith(':')) {
                            port = afterBracket.substring(1);
                        }
                    }
                } else {
                    const parts = addrPart.split(':');
                    if (parts.length >= 2) {
                        server = parts[0];
                        port = parts[1];
                    }
                }
            }
        } else {
            // 通用格式: protocol://user@host:port... 或 protocol://host:port...
            // vless, trojan, hysteria2, socks5, http 等
            // 去掉 protocol://
            let body = nodeUrl.substring(nodeUrl.indexOf('://') + 3);
            const hIndex = body.indexOf('#');
            if (hIndex !== -1) body = body.substring(0, hIndex);

            const qIndex = body.indexOf('?');
            if (qIndex !== -1) body = body.substring(0, qIndex);

            const atIndex = body.lastIndexOf('@');
            let serverPart = atIndex !== -1 ? body.substring(atIndex + 1) : body;

            // [新增] 检测 Base64 编码的用户信息（某些非标准 VLESS URL）
            // 格式：vless://Base64(auto:uuid@host:port)?params
            if (atIndex === -1 && protocol === 'vless' && body.length > 20) {
                try {
                    // 尝试 Base64 解码
                    let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
                    while (b64.length % 4) b64 += '=';
                    const binaryString = atob(b64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const decoded = new TextDecoder('utf-8').decode(bytes);
                    // 检查解码结果是否包含 @ 符号（形如 auto:uuid@host:port）
                    if (decoded.includes('@')) {
                        const decodedAtIndex = decoded.lastIndexOf('@');
                        serverPart = decoded.substring(decodedAtIndex + 1);
                    }
                } catch (e) {
                    // Base64 解码失败，继续使用原逻辑
                    console.debug(
                        '[GeoUtils] VLESS base64 decode attempt failed (expected for standard format)'
                    );
                }
            }

            // 处理 IPv6 [::1]:port
            if (serverPart.startsWith('[')) {
                const closeBracket = serverPart.indexOf(']');
                if (closeBracket !== -1) {
                    server = serverPart.substring(1, closeBracket);
                    const afterBracket = serverPart.substring(closeBracket + 1);
                    if (afterBracket.startsWith(':')) {
                        port = afterBracket.substring(1).split('/')[0];
                    }
                }
            } else {
                const parts = serverPart.split(':');
                if (parts.length >= 2) {
                    server = parts[0];
                    port = parts[1].split('/')[0];
                }
            }
        }
    } catch (e) {
        console.error('Error extracting server/port:', e);
    }

    // 识别地区
    const region = extractNodeRegion(nodeName);

    return {
        protocol,
        name: nodeName,
        region,
        server,
        port,
        url: nodeUrl,
    };
}

/**
 * 统计节点地区分布
 * @param {Array} nodes - 节点数组
 * @returns {Object} 地区统计信息
 */
export function calculateRegionStats(nodes) {
    const stats = {};
    const total = nodes.length;

    nodes.forEach((node) => {
        const region = extractNodeRegion(node.name || '');
        stats[region] = (stats[region] || 0) + 1;
    });

    // 添加百分比信息
    for (const [region, count] of Object.entries(stats) as [string, number][]) {
        stats[region] = {
            count,
            percentage: Math.round((count / total) * 100),
        };
    }

    return stats;
}
