import { convertVmessToUrl } from './converters/vmess.ts';
import { convertShadowsocksToUrl, convertShadowsocksRToUrl } from './converters/shadowsocks.ts';
import { convertTrojanToUrl } from './converters/trojan.ts';
import { convertVlessToUrl } from './converters/vless.ts';
import { convertHysteriaToUrl } from './converters/hysteria.ts';
import { convertAnytlsToUrl } from './converters/anytls.ts';
import { convertTuicToUrl } from './converters/tuic.ts';
import { convertSocks5ToUrl } from './converters/socks5.ts';
import { convertHttpToUrl } from './converters/http.ts';
import { convertWireguardToUrl } from './converters/wireguard.ts';

import type { ProxyNode } from '../../../types/models.ts';

/**
 * 转换Clash代理配置为标准URL
 */
export function convertClashProxyToUrl(proxy: ProxyNode | null | undefined): string | null {
    if (!proxy || typeof proxy !== 'object' || !proxy.type) {
        return null;
    }

    const type = proxy.type.toLowerCase();

    switch (type) {
        case 'vmess':
            return convertVmessToUrl(proxy);
        case 'ss':
        case 'shadowsocks':
            return convertShadowsocksToUrl(proxy);
        case 'ssr':
        case 'shadowsocksr':
            return convertShadowsocksRToUrl(proxy);
        case 'trojan':
            return convertTrojanToUrl(proxy);
        case 'vless':
            return convertVlessToUrl(proxy);
        case 'hysteria':
        case 'hysteria2':
            return convertHysteriaToUrl(proxy);
        case 'anytls':
            return convertAnytlsToUrl(proxy);
        case 'tuic':
            return convertTuicToUrl(proxy);
        case 'socks5':
            return convertSocks5ToUrl(proxy);
        case 'http':
            return convertHttpToUrl(proxy);
        case 'wireguard':
            return convertWireguardToUrl(proxy);
        default:
            console.warn(`不支持的代理类型: ${type}`);
            return null;
    }
}
