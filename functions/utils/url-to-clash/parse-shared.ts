/**
 * url-to-clash 共享解析工具
 *
 * 从 url-to-clash.js 拆分而来：各协议族解析器与调度器共同依赖的基础
 * helper 集中在此，避免子模块之间互相引用。
 */

export const VIRTUAL_INFO_NODE_PASSWORD = '00000000-0000-0000-0000-000000000000';

export function isVirtualInfoProxy(proxy: any) {
    if (!proxy || typeof proxy !== 'object') return false;

    const type = String(proxy.type || '').toLowerCase();
    const server = String(proxy.server || '')
        .trim()
        .toLowerCase();
    const password = String(proxy.password || '').trim();
    const name = String(proxy.name || '').trim();

    return (
        type === 'trojan' &&
        server === '127.0.0.1' &&
        Number(proxy.port) === 443 &&
        password === VIRTUAL_INFO_NODE_PASSWORD &&
        /(?:流量剩余|到期时间|您的订阅已到期)/.test(name)
    );
}

/**
 * 解析 URL 查询参数
 * @param {string} url - 节点 URL
 * @returns {URLSearchParams} 查询参数对象
 */
export function parseQueryParams(url: any) {
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return new URLSearchParams();

    const hashIndex = url.indexOf('#');
    const queryString =
        hashIndex > queryIndex
            ? url.substring(queryIndex + 1, hashIndex)
            : url.substring(queryIndex + 1);

    return new URLSearchParams(queryString);
}

/**
 * 从 URL 提取节点名称
 * @param {string} url - 节点 URL
 * @returns {string} 节点名称
 */
export function extractName(url: any) {
    const hashIndex = url.lastIndexOf('#');
    if (hashIndex === -1) return '';
    try {
        return decodeURIComponent(url.substring(hashIndex + 1));
    } catch {
        return url.substring(hashIndex + 1);
    }
}

/**
 * Base64 解码支持 (处理 URL Safe)
 */
export function base64Decode(str: any) {
    try {
        let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        return decodeURIComponent(escape(atob(normalized)));
    } catch {
        // 回退到纯 atob
        try {
            return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
        } catch {
            return str;
        }
    }
}

/**
 * 解析服务器和端口
 * @param {string} hostPort - host:port 字符串
 * @returns {{server: string, port: number}}
 */
export function parseHostPort(hostPort: any) {
    // 处理 IPv6: [::1]:port
    if (hostPort.startsWith('[')) {
        const closeBracket = hostPort.indexOf(']');
        if (closeBracket !== -1) {
            const server = hostPort.substring(1, closeBracket);
            const after = hostPort.substring(closeBracket + 1);
            const port = after.startsWith(':') ? parseInt(after.substring(1)) : 443;
            return { server, port };
        }
    }

    const parts = hostPort.split(':');
    if (parts.length > 2 && parts[0] === '') {
        const port = parseInt(parts[parts.length - 1]) || 443;
        return { server: parts.slice(0, -1).join(':'), port };
    }
    return {
        server: parts[0],
        port: parseInt(parts[1]) || 443,
    };
}

/**
 * 将 VLESS URL 转换为 Clash 代理对象
 * @param {string} url - VLESS URL
 * @returns {Object|null} Clash 代理对象
 */
