/**
 * V2Ray 系协议（vless / trojan / vmess）URL → Clash 代理解析
 * 从 url-to-clash.js 拆分而来；调度器见 ../url-to-clash.js。
 */

import { extractName, parseHostPort, parseQueryParams } from './parse-shared.ts';
import { applyDownloadInheritanceGuard, parseXhttpExtra } from '../xhttp-extra.ts';

export function parseVlessUrl(url) {
    try {
        // vless://uuid@server:port?params#name
        const body = url.substring(8); // 去掉 vless://
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        const uuid = body.substring(0, atIndex);

        // 解析 server:port
        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        if (/^[0-9a-f:]+$/i.test(serverPart) && serverPart.split(':').length > 2) {
            const lastColon = serverPart.lastIndexOf(':');
            serverPart = `[${serverPart.slice(0, lastColon)}]:${serverPart.slice(lastColon + 1)}`;
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(url);
        const name = extractName(url);

        const proxy: Record<string, any> = {
            name: name || `VLESS-${server}`,
            type: 'vless',
            server,
            port,
            uuid,
        };

        // 网络类型
        const network = params.get('type') || 'tcp';
        if (network !== 'tcp') {
            proxy.network = network;
        }

        // WebSocket 配置
        if (network === 'ws') {
            const wsOpts: Record<string, any> = {};
            if (params.get('path')) wsOpts.path = params.get('path');
            if (params.get('host')) {
                wsOpts.headers = { Host: params.get('host') };
            }
            if (Object.keys(wsOpts).length > 0) {
                proxy['ws-opts'] = wsOpts;
            }
        }

        // xHTTP 配置
        if (network === 'xhttp') {
            const xhttpOpts: Record<string, any> = {};

            const path = params.get('xhttp-path') || params.get('path');

            const host = params.get('xhttp-host') || params.get('host') || params.get('sni');

            if (path) {
                xhttpOpts.path = path;
            }

            if (host) {
                xhttpOpts.host = host;

                // 保留 MiSub 原有逻辑
                xhttpOpts.headers = {
                    Host: host,
                };
            }

            // XHTTP mode
            if (params.get('mode')) {
                xhttpOpts.mode = params.get('mode');
            }

            const extraParam = params.get('extra');
            if (extraParam) {
                try {
                    const extraFields = parseXhttpExtra(JSON.parse(extraParam));
                    const { headers: extraHeaders, ...rest } = extraFields;
                    Object.assign(xhttpOpts, rest);
                    // URL 的 host 参数是分享链接的显式声明，优先级高于 extra 里的同名头；
                    // HTTP 头名大小写不敏感，小写 host 也要让位，避免同一头出现两份。
                    if (extraHeaders) {
                        const mergedHeaders = { ...extraHeaders };
                        if ((xhttpOpts.headers as Record<string, any> | undefined)?.Host) {
                            for (const key of Object.keys(mergedHeaders)) {
                                if (key.toLowerCase() === 'host') {
                                    delete mergedHeaders[key];
                                }
                            }
                        }
                        xhttpOpts.headers = { ...mergedHeaders, ...(xhttpOpts.headers || {}) };
                    }
                } catch (e) {
                    // extra 非法时不能让整个订阅转换失败。
                    console.warn('[MiSub] XHTTP extra 参数解析失败:', e);
                }
            }

            if (Object.keys(xhttpOpts).length > 0) {
                proxy['xhttp-opts'] = xhttpOpts;
            }
        }

        // gRPC 配置
        if (network === 'grpc') {
            const grpcOpts = {};
            if (params.get('serviceName')) {
                grpcOpts['grpc-service-name'] = params.get('serviceName');
            }
            if (params.get('mode')) {
                grpcOpts['grpc-mode'] = params.get('mode');
            }
            if (Object.keys(grpcOpts).length > 0) {
                proxy['grpc-opts'] = grpcOpts;
            }
        }

        // HTTPUpgrade 配置
        if (network === 'httpupgrade') {
            const httpupgradeOpts: Record<string, any> = {};
            if (params.get('path')) httpupgradeOpts.path = params.get('path');
            if (params.get('host')) httpupgradeOpts.host = params.get('host');
            if (Object.keys(httpupgradeOpts).length > 0) {
                proxy['httpupgrade-opts'] = httpupgradeOpts;
            }
        }

        // 安全配置
        const security = params.get('security') || 'none';

        if (security === 'reality') {
            proxy.tls = true;
            const realityOpts = {};
            if (params.get('pbk')) realityOpts['public-key'] = params.get('pbk');
            if (params.get('sid')) realityOpts['short-id'] = params.get('sid');
            if (params.get('spx')) realityOpts['spider-x'] = params.get('spx');
            const sxm =
                params.get('support-x25519mlkem768') ||
                params.get('support_x25519mlkem768') ||
                params.get('sxm');
            if (sxm === '0' || sxm === 'false') {
                // 显式禁用
            } else if (sxm === '1' || sxm === 'true') {
                realityOpts['support-x25519mlkem768'] = true;
            }
            if (Object.keys(realityOpts).length > 0) {
                proxy['reality-opts'] = realityOpts;
            }
        } else if (security === 'tls') {
            proxy.tls = true;
        }

        // Skip cert verify (统一支持 allowInsecure 和 insecure)
        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        // SNI (支持 sni 和 peer 两种参数名，Shadowrocket 使用 peer)
        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
        }

        // Fingerprint
        if (params.get('fp')) {
            proxy['client-fingerprint'] = params.get('fp');
        }

        // Flow (XTLS)
        if (params.get('flow')) {
            proxy.flow = params.get('flow');
        }

        // ALPN
        if (params.get('alpn')) {
            proxy.alpn = params.get('alpn').split(',')!;
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        const xhttpOpts = proxy['xhttp-opts'];
        if (xhttpOpts) {
            const upstreamPublicKey = proxy['reality-opts'] && proxy['reality-opts']['public-key'];
            applyDownloadInheritanceGuard(xhttpOpts, {
                upstreamReality: typeof upstreamPublicKey === 'string' && upstreamPublicKey !== '',
            });
        }

        return proxy;
    } catch (e) {
        console.error('解析 VLESS URL 失败:', e);
        return null;
    }
}

/**
 * 将 Trojan URL 转换为 Clash 代理对象
 * @param {string} url - Trojan URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseTrojanUrl(url) {
    try {
        // trojan://password@server:port?params#name
        const body = url.substring(9); // 去掉 trojan://
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let password = body.substring(0, atIndex);
        try {
            password = decodeURIComponent(password);
        } catch {}

        let serverPart = body.substring(atIndex + 1);
        const queryIndex = serverPart.indexOf('?');
        const hashIndex = serverPart.indexOf('#');

        if (queryIndex !== -1) {
            serverPart = serverPart.substring(0, queryIndex);
        } else if (hashIndex !== -1) {
            serverPart = serverPart.substring(0, hashIndex);
        }

        const { server, port } = parseHostPort(serverPart);
        const params = parseQueryParams(url);
        const name = extractName(url);

        const proxy: Record<string, any> = {
            name: name || `Trojan-${server}`,
            type: 'trojan',
            server,
            port,
            password,
        };

        // 网络类型
        const network = params.get('type') || 'tcp';
        if (network !== 'tcp') {
            proxy.network = network;
        }

        // WebSocket 配置
        if (network === 'ws') {
            const wsOpts: Record<string, any> = {};
            if (params.get('path')) wsOpts.path = params.get('path');
            if (params.get('host')) {
                wsOpts.headers = { Host: params.get('host') };
            }
            if (Object.keys(wsOpts).length > 0) {
                proxy['ws-opts'] = wsOpts;
            }
        }

        // gRPC 配置
        if (network === 'grpc') {
            const grpcOpts = {};
            if (params.get('serviceName'))
                grpcOpts['grpc-service-name'] = params.get('serviceName');
            if (params.get('mode')) grpcOpts['grpc-mode'] = params.get('mode');
            if (Object.keys(grpcOpts).length > 0) {
                proxy['grpc-opts'] = grpcOpts;
            }
        }

        // SNI (支持 sni 和 peer 两种参数名，Shadowrocket 使用 peer)
        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
        }

        // Fingerprint
        if (params.get('fp')) {
            proxy['client-fingerprint'] = params.get('fp');
        }

        // Skip cert verify
        if (params.get('allowInsecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        // [重要] dialer-proxy 链式代理
        if (params.get('dp')) {
            proxy['dialer-proxy'] = params.get('dp');
        }

        // Reality 配置 (支持 Trojan Reality)
        const security = params.get('security');
        if (security === 'reality') {
            proxy.tls = true;
            const realityOpts = {};
            if (params.get('pbk')) realityOpts['public-key'] = params.get('pbk');
            if (params.get('sid')) realityOpts['short-id'] = params.get('sid');
            if (params.get('spx')) realityOpts['spider-x'] = params.get('spx');
            const sxm =
                params.get('support-x25519mlkem768') ||
                params.get('support_x25519mlkem768') ||
                params.get('sxm');
            if (sxm === '0' || sxm === 'false') {
                // 显式禁用
            } else if (sxm === '1' || sxm === 'true') {
                realityOpts['support-x25519mlkem768'] = true;
            }
            if (Object.keys(realityOpts).length > 0) {
                proxy['reality-opts'] = realityOpts;
            }
        }

        return proxy;
    } catch (e) {
        console.error('解析 Trojan URL 失败:', e);
        return null;
    }
}

/**
 * 将 VMess URL 转换为 Clash 代理对象
 * @param {string} url - VMess URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseVmessUrl(url) {
    try {
        // vmess://base64(json)
        const base64Part = url.substring(8);

        // 标准化 Base64
        let normalized = base64Part.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';

        // 使用 TextDecoder 正确解码 UTF-8 内容
        const binaryString = atob(normalized);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        const config = JSON.parse(jsonStr);

        const proxy: Record<string, any> = {
            name: config.ps || `VMess-${config.add}`,
            type: 'vmess',
            server: config.add || config.host || config.sni || '',
            port: parseInt(config.port),
            uuid: config.id,
            alterId: parseInt(config.aid) || 0,
            cipher: config.scy || 'auto',
        };

        // 网络类型
        const network = config.net || 'tcp';
        if (network !== 'tcp') {
            proxy.network = network;
        }

        // WebSocket 配置
        if (network === 'ws') {
            const wsOpts: Record<string, any> = {};
            if (config.path) wsOpts.path = config.path;
            if (config.host) {
                wsOpts.headers = { Host: config.host };
            }
            if (Object.keys(wsOpts).length > 0) {
                proxy['ws-opts'] = wsOpts;
            }
        }

        // gRPC 配置
        if (network === 'grpc') {
            const grpcOpts = {};
            if (config.path) grpcOpts['grpc-service-name'] = config.path; // vmess json sometimes use path for serviceName
            if (config.host) grpcOpts['grpc-service-name'] = config.host;
            if (Object.keys(grpcOpts).length > 0) {
                proxy['grpc-opts'] = grpcOpts;
            }
        }

        // H2 (HTTP/2) 配置
        if (network === 'h2') {
            const h2Opts: Record<string, any> = {};
            if (config.path) h2Opts.path = config.path;
            if (config.host) h2Opts.host = config.host.split(',').map((h) => h.trim());
            if (Object.keys(h2Opts).length > 0) {
                proxy['h2-opts'] = h2Opts;
            }
        }

        // HTTP 配置
        if (network === 'http') {
            const httpOpts = {
                path: config.path || '/',
                headers: {
                    Host: config.host ? config.host.split(',').map((h) => h.trim()) : [],
                },
            };
            proxy['http-opts'] = httpOpts;
        }

        // QUIC 配置
        if (network === 'quic') {
            const quicOpts: Record<string, any> = {};
            if (config.type) quicOpts.header = { type: config.type };
            if (config.host) quicOpts.security = config.host;
            if (config.path) quicOpts.key = config.path;
            if (Object.keys(quicOpts).length > 0) {
                proxy['quic-opts'] = quicOpts;
            }
        }

        // TLS
        if (config.tls === 'tls' || config.tls === 'reality') {
            proxy.tls = true;
            if (config.sni) proxy.servername = config.sni;
            if (config.fp) proxy['client-fingerprint'] = config.fp;
            if (config.alpn)
                proxy.alpn = String(config.alpn)
                    .split(',')
                    .map((s) => s.trim());
        }

        // UDP
        // proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 VMess URL 失败:', e);
        return null;
    }
}

/**
 * 解析 Shadowsocks 插件参数 (SIP002)
 * 格式: plugin-name;opt1=val1;opt2=val2
 */
