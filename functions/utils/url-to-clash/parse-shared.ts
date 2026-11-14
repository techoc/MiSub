/**
 * url-to-clash 共享解析工具
 *
 * 从 url-to-clash.js 拆分而来：各协议族解析器与调度器共同依赖的基础
 * helper 集中在此，避免子模块之间互相引用。
 */

export const VIRTUAL_INFO_NODE_PASSWORD = '00000000-0000-0000-0000-000000000000';

export function isVirtualInfoProxy(proxy: unknown): boolean {
    if (!proxy || typeof proxy !== 'object') return false;
    const record = proxy as Record<string, unknown>;

    const type = String(record.type || '').toLowerCase();
    const server = String(record.server || '')
        .trim()
        .toLowerCase();
    const password = String(record.password || '').trim();
    const name = String(record.name || '').trim();

    return (
        type === 'trojan' &&
        server === '127.0.0.1' &&
        Number(record.port) === 443 &&
        password === VIRTUAL_INFO_NODE_PASSWORD &&
        /(?:流量剩余|到期时间|您的订阅已到期)/.test(name)
    );
}

/**
 * 解析 URL 查询参数
 * @param {string} url - 节点 URL
 * @returns {URLSearchParams} 查询参数对象
 */
export function parseQueryParams(url: unknown): URLSearchParams {
    const text = String(url || '');
    const queryIndex = text.indexOf('?');
    if (queryIndex === -1) return new URLSearchParams();

    const hashIndex = text.indexOf('#');
    const queryString =
        hashIndex > queryIndex
            ? text.substring(queryIndex + 1, hashIndex)
            : text.substring(queryIndex + 1);

    return new URLSearchParams(queryString);
}

/**
 * 从 URL 提取节点名称
 * @param {string} url - 节点 URL
 * @returns {string} 节点名称
 */
export function extractName(url: unknown): string {
    const text = String(url || '');
    const hashIndex = text.lastIndexOf('#');
    if (hashIndex === -1) return '';
    try {
        return decodeURIComponent(text.substring(hashIndex + 1));
    } catch {
        return text.substring(hashIndex + 1);
    }
}

/**
 * Base64 解码支持 (处理 URL Safe)
 */
export function base64Decode(str: unknown): string {
    const text = String(str || '');
    try {
        let normalized = text.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        return decodeURIComponent(escape(atob(normalized)));
    } catch {
        // 回退到纯 atob
        try {
            return atob(text.replace(/-/g, '+').replace(/_/g, '/'));
        } catch {
            return text;
        }
    }
}

/**
 * 解析服务器和端口
 * @param {string} hostPort - host:port 字符串
 * @returns {{server: string, port: number}}
 */
export function parseHostPort(hostPort: unknown): { server: string; port: number } {
    const text = String(hostPort || '');
    // 处理 IPv6: [::1]:port
    if (text.startsWith('[')) {
        const closeBracket = text.indexOf(']');
        if (closeBracket !== -1) {
            const server = text.substring(1, closeBracket);
            const after = text.substring(closeBracket + 1);
            const port = after.startsWith(':') ? parseInt(after.substring(1)) : 443;
            return { server, port };
        }
    }

    const parts = text.split(':');
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
