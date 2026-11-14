import { convertClashProxyToUrl } from './clash.ts';
import { validateGeneratedUrl } from './validator.ts';

/**
 * 批量转换Clash代理
 */
export function batchConvertClashProxies(proxies) {
    if (!Array.isArray(proxies)) {
        return [];
    }

    const results: any[] = [];
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
