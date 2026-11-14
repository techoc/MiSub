export { convertClashProxyToUrl } from './clash.ts';
export { validateGeneratedUrl } from './validator.ts';
export { batchConvertClashProxies } from './batch.ts';

import { parseLoonConfig } from './loon-parser.ts';
import { parseSurgeConfig } from './surge-parser.ts';
import { parseQuantumultXConfig } from './quantumultx-parser.ts';

export { parseLoonConfig, parseSurgeConfig, parseQuantumultXConfig };

export function parseClientConfig(content: any) {
    const text = String(content || '');
    const lower = text.toLowerCase();

    if (
        lower.includes('[server_local]') ||
        lower.includes('shadowsocks=') ||
        lower.includes('vmess=')
    ) {
        return { client: 'quantumultx', nodes: parseQuantumultXConfig(text) };
    }

    if (
        lower.includes('[proxy]') &&
        (lower.includes('ss=') ||
            lower.includes('trojan=') ||
            lower.includes('http-proxy') ||
            lower.includes('https-proxy') ||
            lower.includes('private-key=') ||
            lower.includes('peer-public-key='))
    ) {
        return { client: 'surge', nodes: parseSurgeConfig(text) };
    }

    if (
        lower.includes('[proxy]') &&
        (lower.includes(' = shadowsocks,') ||
            lower.includes(' = vmess,') ||
            lower.includes(' = vless,') ||
            lower.includes(' = trojan,') ||
            lower.includes(' = hysteria2,') ||
            lower.includes(' = tuic,') ||
            lower.includes(' = wireguard,') ||
            lower.includes(' = snell,') ||
            lower.includes(' = anytls,'))
    ) {
        return { client: 'loon', nodes: parseLoonConfig(text) };
    }

    if (
        lower.includes('[proxy]') &&
        (lower.includes('ss=') ||
            lower.includes('trojan=') ||
            lower.includes('wireguard,') ||
            lower.includes('anytls') ||
            lower.includes('http-proxy') ||
            lower.includes('https-proxy'))
    ) {
        return { client: 'surge', nodes: parseSurgeConfig(text) };
    }

    return { client: 'unknown', nodes: [] };
}
