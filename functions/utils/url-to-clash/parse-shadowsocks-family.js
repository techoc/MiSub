/**
 * Shadowsocks 系协议（ss / ssr / ssd）URL → Clash 代理解析
 * 从 url-to-clash.js 拆分而来；调度器见 ../url-to-clash.js。
 */

import { base64Decode, extractName, parseHostPort, parseQueryParams } from './parse-shared.js';

export function normalizeSsPluginOption(key, value) {
    if (key === 'mux') {
        if (value === '1' || value === 'true') return true;
        if (value === '0' || value === 'false') return false;
    }
    return value;
}

export function parseSsPlugin(pluginStr) {
    if (!pluginStr) return null;
    // 插件参数内部通常用分号分隔
    const parts = pluginStr.split(';');
    const name = parts[0];
    const opts = {};
    for (let i = 1; i < parts.length; i++) {
        const item = parts[i];
        if (!item) continue;
        const eqIndex = item.indexOf('=');
        if (eqIndex === -1) {
            // 布尔值标识位，例如 "tls"
            opts[item] = true;
        } else {
            const key = item.substring(0, eqIndex);
            let val = item.substring(eqIndex + 1);
            // 处理 SIP002 转义：\= -> =, \; -> ;, \? -> ?
            val = val
                .replace(/\\=/g, '=')
                .replace(/\\;/g, ';')
                .replace(/\\\?/g, '?')
                .replace(/\\:/g, ':');
            // 尝试处理布尔值字符串
            if (val === 'true') val = true;
            if (val === 'false') val = false;
            opts[key] = normalizeSsPluginOption(key, val);
        }
    }
    return { name, opts };
}

/**
 * 将 Shadowsocks URL 转换为 Clash 代理对象
 * @param {string} url - Shadowsocks URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseSsUrl(url) {
    try {
        // ss://base64(method:password)@server:port#name
        // 或 ss://base64(method:password@server:port)#name
        // [SIP002] 格式支持插件：ss://userInfo@server:port?plugin=xxx#name
        let body = url.substring(5); // 去掉 ss://
        const name = extractName(url);
        const params = parseQueryParams(url);

        // 去掉 fragment
        const hashIndex = body.indexOf('#');
        if (hashIndex !== -1) body = body.substring(0, hashIndex);

        // 去掉 query 部分，保留核心 body 用于解析用户信息和服务器
        const queryIndex = body.indexOf('?');
        if (queryIndex !== -1) {
            body = body.substring(0, queryIndex);
        }

        let method, password, server, port;

        const atIndex = body.lastIndexOf('@');
        if (atIndex !== -1) {
            // SIP002 格式: base64(method:password)@server:port
            const userInfo = body.substring(0, atIndex);
            const serverPart = body.substring(atIndex + 1);

            // 解码 userInfo
            let decoded;
            try {
                let normalized = userInfo.replace(/-/g, '+').replace(/_/g, '/');
                while (normalized.length % 4) normalized += '=';
                decoded = atob(normalized);
            } catch {
                decoded = userInfo;
            }

            const colonIndex = decoded.indexOf(':');
            if (colonIndex !== -1) {
                method = decoded.substring(0, colonIndex);
                password = decoded.substring(colonIndex + 1);
            }

            const parsed = parseHostPort(serverPart);
            server = parsed.server;
            port = parsed.port;
        } else {
            // 旧格式: base64(method:password@server:port)
            let normalized = body.replace(/-/g, '+').replace(/_/g, '/');
            while (normalized.length % 4) normalized += '=';
            const decoded = atob(normalized);

            const atIdx = decoded.lastIndexOf('@');
            if (atIdx !== -1) {
                const userPart = decoded.substring(0, atIdx);
                const serverPart = decoded.substring(atIdx + 1);

                const colonIndex = userPart.indexOf(':');
                if (colonIndex !== -1) {
                    method = userPart.substring(0, colonIndex);
                    password = userPart.substring(colonIndex + 1);
                }

                const parsed = parseHostPort(serverPart);
                server = parsed.server;
                port = parsed.port;
            }
        }

        if (!method || !password || !server || !port) {
            return null;
        }

        const proxy = {
            name: name || `SS-${server}`,
            type: 'ss',
            server,
            port,
            cipher: method,
            password,
        };

        // [核心修复] 解析并补全插件信息
        const pluginStr = params.get('plugin');
        if (pluginStr) {
            const pluginDetails = parseSsPlugin(pluginStr);
            if (pluginDetails) {
                proxy.plugin = pluginDetails.name;
                proxy['plugin-opts'] = pluginDetails.opts;

                const obfsMode = params.get('obfs');
                const obfsHost = params.get('obfs-host');
                if (obfsMode) proxy['plugin-opts'].mode = obfsMode;
                if (obfsHost) proxy['plugin-opts'].host = obfsHost;

                // 协议兼容性映射 (TLS / Host)
                if (
                    pluginDetails.opts.tls ||
                    pluginDetails.opts.mode?.includes('tls') ||
                    pluginDetails.opts.security === 'tls'
                ) {
                    proxy.tls = true;
                }
                if (pluginDetails.opts.host) {
                    proxy.sni = pluginDetails.opts.host;
                    proxy.servername = pluginDetails.opts.host;
                }
            }
        }

        // UDP
        // proxy.udp = true;

        return proxy;
    } catch (e) {
        console.error('解析 SS URL 失败:', e);
        return null;
    }
}

/**
 * 将 Hysteria2 URL 转换为 Clash 代理对象
 * @param {string} url - Hysteria2 URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseSsrUrl(url) {
    try {
        const b64 = url.substring(6);
        const decoded = base64Decode(b64);

        // server:port:protocol:method:obfs:password_base64/?params
        const mainParts = decoded.split(':');
        if (mainParts.length < 6) return null;

        const server = mainParts[0];
        const port = parseInt(mainParts[1]);
        const protocol = mainParts[2];
        const cipher = mainParts[3];
        const obfs = mainParts[4];

        const passwordPart = mainParts[5];
        const passwordEndIndex = passwordPart.indexOf('/');
        const passwordBase64 =
            passwordEndIndex !== -1 ? passwordPart.substring(0, passwordEndIndex) : passwordPart;
        const password = base64Decode(passwordBase64);

        const proxy = {
            name: `SSR-${server}`,
            type: 'ssr',
            server,
            port,
            protocol,
            cipher,
            obfs,
            password,
            udp: true,
        };

        if (passwordEndIndex !== -1) {
            const paramsStr = passwordPart.substring(passwordEndIndex + 2); // skip /?
            const params = new URLSearchParams(paramsStr);

            if (params.get('obfsparam'))
                proxy['obfs-param'] = base64Decode(params.get('obfsparam'));
            if (params.get('protoparam'))
                proxy['protocol-param'] = base64Decode(params.get('protoparam'));
            if (params.get('remarks')) proxy.name = base64Decode(params.get('remarks'));
            if (params.get('group')) proxy.group = base64Decode(params.get('group'));
            if (params.get('udpport')) proxy.udpport = params.get('udpport');
        }

        return proxy;
    } catch (e) {
        console.error('解析 SSR URL 失败:', e);
        return null;
    }
}

/**
 * 将 SSD URL 转换为 Clash 代理对象
 * @param {string} url - SSD URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseSsdUrl(url) {
    try {
        const b64 = url.substring(6);
        const decoded = base64Decode(b64);
        const config = JSON.parse(decoded);

        // SSD 通常包含一个数组。这里为了简化，返回第一个有效的。
        // 实际上 SSD 应该被展开，但 builtin 流程目前是 1-to-1 映射。
        // 我们取第一个作为示范。
        if (!config.servers || !config.servers.length) return null;

        const s = config.servers[0];
        const proxy = {
            name: s.remarks || `SSD-${s.server}`,
            type: 'ss',
            server: s.server,
            port: s.port,
            cipher: config.encryption || s.encryption || 'aes-256-gcm',
            password: config.password || s.password,
            plugin: s.plugin,
            'plugin-opts': s.plugin_options ? { host: s.plugin_options } : undefined,
        };

        return proxy;
    } catch (e) {
        console.error('解析 SSD URL 失败:', e);
        return null;
    }
}

/**
 * 将节点 URL 转换为 Clash 代理对象
 * @param {string} url - 节点 URL
 * @returns {Object|null} Clash 代理对象
 */
