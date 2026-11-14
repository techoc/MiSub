import { convertClashProxyToUrl } from './clash.ts';
import { validateGeneratedUrl } from './validator.ts';

import type { ProxyNode } from '../../../types/models.ts';

/**
 * 批量转换Clash代理
 */
export function batchConvertClashProxies(proxies: unknown) {
    if (!Array.isArray(proxies)) {
        return [];
    }

    const results: Array<{
        name: string;
        url: string;
        type: string;
        original: ProxyNode;
    }> = [];
    for (const proxy of proxies) {
        const url = convertClashProxyToUrl(proxy);
        if (url && validateGeneratedUrl(url)) {
            results.push({
                name: proxy.name || 'Unknown',
                url: url,
                type: proxy.type,
                original: proxy,
            });
        }
    }

    return results;
}
