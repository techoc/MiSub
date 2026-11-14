/**
 * 支持特殊参数：dialer-proxy、reality-opts 等
 *
 * 协议解析器已按协议族拆分至 ./url-to-clash/ 子模块（共享工具见
 * parse-shared.js）；本文件保留对外 API（urlToClashProxy /
 * urlsToClashProxies / generateClashConfig）与 mierus:// 的内联处理，
 * 既有 import 路径不变。
 */

import { extractNodeMetadata } from '../modules/utils/metadata-extractor.ts';
import { isLocalProxyEndpoint } from './node-utils.ts';
import { extractName, isVirtualInfoProxy } from './url-to-clash/parse-shared.ts';
import { parseTrojanUrl, parseVlessUrl, parseVmessUrl } from './url-to-clash/parse-v2ray-family.ts';
import { parseSsdUrl, parseSsUrl, parseSsrUrl } from './url-to-clash/parse-shadowsocks-family.ts';
import {
    parseAnytlsUrl,
    parseHysteria2Url,
    parseSnellUrl,
    parseTuicUrl,
    parseWireguardUrl,
} from './url-to-clash/parse-modern-protocols.ts';
import { parseHttpsUrl, parseSocks5Url } from './url-to-clash/parse-legacy-schemes.ts';
import type { ProxyNode } from '../../types/models.ts';

/** 各协议解析器返回宽松对象，这里统一收窄为 ProxyNode */
function asProxyNode(proxy: unknown): ProxyNode | null {
    return (proxy as ProxyNode | null) ?? null;
}

export function urlToClashProxy(url: unknown): ProxyNode | null {
    if (!url || typeof url !== 'string') return null;

    if (/^mierus:\/\//i.test(url)) {
        try {
            const body = url.slice(url.indexOf('//') + 2);
            const hashIndex = body.indexOf('#');
            const beforeHash = hashIndex < 0 ? body : body.slice(0, hashIndex);
            const queryIndex = beforeHash.indexOf('?');
            const authority = queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex);
            const query = new URLSearchParams(
                queryIndex < 0 ? '' : beforeHash.slice(queryIndex + 1)
            );
            let server;
            let port;
            if (authority.startsWith('[')) {
                const end = authority.indexOf(']');
                server = authority.slice(1, end);
                port = Number(authority.slice(end + 2));
            } else {
                const split = authority.lastIndexOf(':');
                server = authority.slice(0, split);
                port = Number(authority.slice(split + 1));
            }
            const proxy: ProxyNode = {
                name: extractName(url) || `Mieru-${server}`,
                type: 'mieru',
                server,
                port,
            };
            for (const key of ['username', 'password', 'transport', 'handshake-mode', 'profile'])
                if (query.has(key)) proxy[key] = query.get(key);
            for (const key of ['udp', 'multiplexing'])
                if (query.has(key)) proxy[key] = query.get(key) === 'true';
            if (query.has('mtu')) proxy.mtu = Number(query.get('mtu'));
            return proxy;
        } catch {
            return null;
        }
    }

    const lowerUrl = url.toLowerCase();

    if (lowerUrl.startsWith('vless://')) {
        return asProxyNode(parseVlessUrl(url));
    } else if (lowerUrl.startsWith('trojan://')) {
        return asProxyNode(parseTrojanUrl(url));
    } else if (lowerUrl.startsWith('vmess://')) {
        return asProxyNode(parseVmessUrl(url));
    } else if (lowerUrl.startsWith('ssr://')) {
        return asProxyNode(parseSsrUrl(url));
    } else if (lowerUrl.startsWith('ssd://')) {
        return asProxyNode(parseSsdUrl(url));
    } else if (lowerUrl.startsWith('ss://')) {
        return asProxyNode(parseSsUrl(url));
    } else if (lowerUrl.startsWith('hysteria2://') || lowerUrl.startsWith('hy2://')) {
        return asProxyNode(parseHysteria2Url(url));
    } else if (lowerUrl.startsWith('tuic://')) {
        return asProxyNode(parseTuicUrl(url));
    } else if (lowerUrl.startsWith('snell://')) {
        return asProxyNode(parseSnellUrl(url));
    } else if (lowerUrl.startsWith('wireguard://')) {
        return asProxyNode(parseWireguardUrl(url));
    } else if (lowerUrl.startsWith('anytls://')) {
        return asProxyNode(parseAnytlsUrl(url));
    } else if (lowerUrl.startsWith('https://')) {
        return asProxyNode(parseHttpsUrl(url));
    } else if (lowerUrl.startsWith('http://')) {
        return asProxyNode(parseHttpsUrl(url, false));
    } else if (lowerUrl.startsWith('socks5://')) {
        return asProxyNode(parseSocks5Url(url));
    }

    // 不支持的协议
    return null;
}

/**
 * 批量将节点 URL 转换为 Clash 代理列表
 * @param {string[]} urls - 节点 URL 数组
 * @param {Object} options - 参数增强选项 (tfo, udp, scv 等)
 * @returns {Object[]} Clash 代理对象数组
 */
export function urlsToClashProxies(
    urls: unknown,
    options: Record<string, unknown> = {}
): ProxyNode[] {
    if (!Array.isArray(urls)) return [];

    return urls
        .map((url: unknown) => {
            const proxy = urlToClashProxy(url);
            if (!proxy) return null;

            // [URL 参数覆盖] 补全对 TFO/UDP/SCV 的映射
            if (options.enableTfo !== undefined) proxy.tfo = options.enableTfo;

            if (options.enableUdp !== undefined) {
                const type = (proxy.type || '').toLowerCase();
                const isNativeUdp = ['hysteria2', 'hy2', 'tuic', 'hysteria', 'wireguard'].includes(
                    type
                );

                if (options.enableUdp) {
                    proxy.udp = true;
                } else if (!isNativeUdp) {
                    proxy.udp = false;
                } else {
                    proxy.udp = true; // 原生 UDP 协议即便开关关闭也保持开启
                }
            }

            if (options.skipCertVerify) proxy['skip-cert-verify'] = true;

            if (options.supportX25519mlkem768 !== undefined && proxy['reality-opts']) {
                if (options.supportX25519mlkem768) {
                    proxy['reality-opts']['support-x25519mlkem768'] = true;
                } else {
                    delete proxy['reality-opts']['support-x25519mlkem768'];
                }
            }

            // [智能增强] 注入元数据
            const metadata = extractNodeMetadata(proxy.name);
            proxy.metadata = metadata;

            // [自动补全] 仅在名称中完全没有国旗/地球 Emoji 时才尝试补全，避免重复添加或干扰用户重命名
            const HAS_EMOJI_REGEX = /([\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F30D}-\u{1F30F}])/u;
            if (
                options.addFlagEmoji !== false &&
                metadata.flag &&
                !HAS_EMOJI_REGEX.test(proxy.name)
            ) {
                proxy.name = `${metadata.flag} ${proxy.name}`;
            }

            return proxy;
        })
        .filter(
            (proxy): proxy is ProxyNode =>
                proxy !== null && (isVirtualInfoProxy(proxy) || !isLocalProxyEndpoint(proxy))
        );
}

/**
 * 生成完整的 Clash 配置
 * @param {string[]} urls - 节点 URL 数组
 * @param {Object} options - 配置选项
 * @returns {string} Clash YAML 配置
 */
export function generateClashConfig(urls: unknown, options: Record<string, unknown> = {}): string {
    const proxies = urlsToClashProxies(urls, options);

    if (proxies.length === 0) {
        return '';
    }

    // 构建 YAML（简化版，不使用 js-yaml 以减少依赖）
    let yaml = 'proxies:\n';

    for (const proxy of proxies) {
        // [元数据清理] 移除内部元数据字段，避免污染 YAML
        const { metadata, ...rest } = proxy;
        yaml += `  - ${JSON.stringify(rest)}\n`;
    }

    return yaml;
}
