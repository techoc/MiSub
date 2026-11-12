/**
 * 传统协议（https / socks5）URL → Clash 代理解析
 * 从 url-to-clash.js 拆分而来；调度器见 ../url-to-clash.js。
 */

import { extractName, parseHostPort, parseQueryParams } from './parse-shared.js';

export function parseHttpsUrl(url, isTls = true) {
    try {
        // https://username:password@server:port?params#name
        const body = url.substring(isTls ? 8 : 7);
        const atIndex = body.indexOf('@');
        let userInfo = '';
        let serverPart = body;
        if (atIndex !== -1) {
            userInfo = body.substring(0, atIndex);
            serverPart = body.substring(atIndex + 1);
        }

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

        let username = '';
        let password = '';
        const colonIndex = userInfo.indexOf(':');
        if (colonIndex !== -1) {
            username = decodeURIComponent(userInfo.substring(0, colonIndex));
            password = decodeURIComponent(userInfo.substring(colonIndex + 1));
        } else {
            username = decodeURIComponent(userInfo);
        }

        const proxy = {
            name: name || `HTTPS-${server}`,
            type: 'http',
            server,
            port,
            username,
            password,
        };
        if (isTls) proxy.tls = true;

        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
        }

        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        proxy.udp = false;
        return proxy;
    } catch (e) {
        console.error('解析 HTTPS URL 失败:', e);
        return null;
    }
}

/**
 * 将 SOCKS5 URL 转换为 Clash 代理对象
 * @param {string} url - SOCKS5 URL
 * @returns {Object|null} Clash 代理对象
 */
export function parseSocks5Url(url) {
    try {
        // socks5://username:password@server:port?tls=1#name
        const body = url.substring(9);
        const atIndex = body.indexOf('@');
        if (atIndex === -1) return null;

        let userInfo = body.substring(0, atIndex);
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

        let username = '';
        let password = '';
        const colonIndex = userInfo.indexOf(':');
        if (colonIndex !== -1) {
            username = decodeURIComponent(userInfo.substring(0, colonIndex));
            password = decodeURIComponent(userInfo.substring(colonIndex + 1));
        } else {
            username = decodeURIComponent(userInfo);
        }

        const useTls =
            params.get('tls') === '1' ||
            params.get('tls') === 'true' ||
            params.get('secure') === '1';
        const proxy = {
            name: name || `SOCKS5-${server}`,
            type: useTls ? 'socks5-tls' : 'socks5',
            server,
            port,
            username,
            password,
            udp: false,
        };

        if (params.get('sni')) {
            proxy.servername = params.get('sni');
            proxy.sni = params.get('sni');
        } else if (params.get('peer')) {
            proxy.servername = params.get('peer');
            proxy.sni = params.get('peer');
        }

        if (params.get('allowInsecure') === '1' || params.get('insecure') === '1') {
            proxy['skip-cert-verify'] = true;
        }

        return proxy;
    } catch (e) {
        console.error('解析 SOCKS5 URL 失败:', e);
        return null;
    }
}

/**
 * 将 SSR URL 转换为 Clash 代理对象
 * @param {string} url - SSR URL
 * @returns {Object|null} Clash 代理对象
 */
