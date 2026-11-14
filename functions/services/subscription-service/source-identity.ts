/**
 * 订阅源识别：真实代理节点判定、订阅标题解析、机场域名推断与站点标题抓取
 * 从 subscription-service.js 拆分而来；编排器见 ../subscription-service.js。
 */

import { isLocalProxyEndpoint } from '../../utils/node-utils.ts';

const REAL_PROXY_PROTOCOLS = [
    'ss://',
    'ssr://',
    'vmess://',
    'vless://',
    'trojan://',
    'hysteria://',
    'hysteria2://',
    'hy2://',
    'tuic://',
    'anytls://',
    'socks5://',
    'socks://',
    'http://',
    'https://',
    'naive+https://',
    'naive+quic://',
    'wireguard://',
    'mierus://',
];

/**
 * 判断是否是真实代理节点，排除流量/到期/公告等系统伪节点
 */
export function isRealProxyNode(node: any) {
    if (typeof node !== 'string') return false;
    const trimmed = node.trim().toLowerCase();
    if (!trimmed) return false;
    if (isLocalProxyEndpoint(trimmed)) return false;
    return REAL_PROXY_PROTOCOLS.some((protocol) => trimmed.startsWith(protocol));
}

/**
 * 从订阅响应头中解析机场自报的名称（profile-title / content-disposition）。
 *
 * 这是目前最可靠的机场标识来源——由机场服务端自己声明，不依赖域名猜测。
 * 常见形式：
 *   Profile-Title: base64:<b64(名称)>     （Clash/mihomo 生态的约定）
 *   Profile-Title: 名称                   （部分实现直接放明文）
 *   Content-Disposition: attachment; filename*=UTF-8''名称
 *
 * @param {Headers|Object} headers 响应头（fetch Headers 或普通对象）
 * @returns {string} 解析出的名称，取不到时返回空字符串
 */
export function parseSubscriptionProfileTitle(headers: any) {
    const read = (name: any) => {
        if (!headers) return '';
        try {
            if (typeof headers.get === 'function') return headers.get(name) || '';
        } catch {
            /* ignore */
        }
        const lower = name.toLowerCase();
        for (const key of Object.keys(headers || {})) {
            if (key.toLowerCase() === lower) return String(headers[key] || '');
        }
        return '';
    };

    const decodeBase64 = (value: any) => {
        try {
            const binary = atob(value);
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        } catch {
            return '';
        }
    };

    // 1. profile-title（首选）
    let raw = String(read('profile-title') || '').trim();
    if (raw) {
        if (/^base64:/i.test(raw)) {
            const decoded = decodeBase64(raw.slice(7).trim());
            if (decoded) return decoded.trim();
        } else {
            return raw;
        }
    }

    // 2. content-disposition 的 filename*
    const disposition = String(read('content-disposition') || '');
    if (disposition) {
        const utf8 = disposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i);
        if (utf8) {
            try {
                return decodeURIComponent(utf8[1].trim()).trim();
            } catch {
                /* ignore */
            }
        }
        const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);
        if (plain) {
            const name = plain[1].trim();
            // 过滤掉通用占位名与纯扩展名
            if (name && !/^(subscription|config|clash|sub)\.(yaml|yml|txt|conf)$/i.test(name)) {
                return name.replace(/\.(yaml|yml|txt|conf)$/i, '').trim();
            }
        }
    }

    return '';
}

/**
 * 从订阅 URL 推断机场主域名（用于后续抓取官网标题识别品牌）。
 *
 * 机场订阅常挂在子域名上，去掉常见的前缀/子域后可得到主域名：
 *   sub1.gsafevpn.com      -> gsafevpn.com
 *   dy11.baipiaoyes.com    -> baipiaoyes.com
 *   api.5ufclub.com        -> 5ufclub.com
 *   jms.937745389.xyz      -> 937745389.xyz
 *
 * 注意：对于 CDN / 托管平台域名（pages.dev、workers.dev、githubusercontent.com 等）
 * 返回空字符串——它们不属于机场自有域名，抓标题只会得到平台错误页。
 *
 * @param {string} url 订阅源地址
 * @returns {string} 主域名，无法推断时返回空字符串
 */
const NON_AIRPORT_HOSTS = [
    /\.pages\.dev$/i,
    /\.workers\.dev$/i,
    /\.vercel\.app$/i,
    /\.netlify\.app$/i,
    /\.githubusercontent\.com$/i,
    /\.github\.io$/i,
    /\.r2\.dev$/i,
    /\.trafficmanager\.net$/i,
    /\.cloudfront\.net$/i,
    /\.herokuapp\.com$/i,
    /\.onrender\.com$/i,
];

export function inferAirportRootDomain(sourceUrl: any) {
    const raw = String(sourceUrl || '').trim();
    if (!/^https?:\/\//i.test(raw)) return '';

    try {
        const host = new URL(raw).hostname.toLowerCase();
        if (!host.includes('.')) return '';
        if (NON_AIRPORT_HOSTS.some((re) => re.test(host))) return '';

        const parts = host.split('.');
        const suffix = parts.slice(-2).join('.');
        const rootLabelCount = MULTI_LABEL_PUBLIC_SUFFIXES.has(suffix) ? 3 : 2;
        // 常见机场子域前缀（去掉后取主域名）
        const COMMON_SUBDOMAIN_LABELS = new Set([
            'sub',
            'sub1',
            'sub2',
            'sub3',
            'sub4',
            'sub5',
            'api',
            'www',
            'jms',
            'dy',
            'node',
            'nodes',
            'cdn',
            's',
            'go',
            'get',
            'link',
            'links',
            'v',
            'v2',
        ]);

        let base;
        if (parts.length >= 3) {
            const first = parts[0];
            const isCommonPrefix = COMMON_SUBDOMAIN_LABELS.has(first);
            const isNumberedPrefix = /^[a-z]{0,4}\d+$/i.test(first); // 如 dy11 / sub12 / node3
            base = parts.slice(-rootLabelCount);
        } else {
            base = parts;
        }

        const root = base.join('.');
        // 至少要有 host.tld 两段
        return root.split('.').length >= 2 ? root : '';
    } catch {
        return '';
    }
}

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
    'com.cn',
    'net.cn',
    'org.cn',
    'gov.cn',
    'com.hk',
    'com.tw',
    'co.uk',
    'org.uk',
    'me.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'net.au',
    'org.au',
    'co.jp',
    'co.kr',
    'co.nz',
    'com.sg',
    'appspot.com',
]);

/**
 * 抓取机场官网标题，作为品牌名的兜底识别来源。
 *
 * 仅当响应头没有自报名称时才调用，避免不必要的请求开销。
 * 站点标题常见形态：`GsafeVPN` / `Wayne's Portal` / `Notice`
 * 需要过滤掉 Cloudflare 拦截页、默认停机页等噪声。
 *
 * @param {string} rootDomain 机场主域名
 * @param {Object} [options]
 * @param {number} [options.timeout=5000] 超时（毫秒）
 * @returns {Promise<string>} 品牌名，取不到时返回空字符串
 */
const NOISY_SITE_TITLES = [
    /^attention required/i,
    /^just a moment/i,
    /cloudflare$/i,
    /^notice$/i,
    /^welcome$/i,
    /^index$/i,
    /^home$/i,
    /^site not found/i,
    /^404/i,
    /^error/i,
    /^nginx$/i,
    /^apache/i,
    /^default/i,
    /^域名/i,
    /^未找到/i,
];

export async function fetchAirportSiteTitle(rootDomain: any, options: Record<string, any> = {}) {
    const { timeout = 5000 } = options;
    const domain = String(rootDomain || '').trim();
    if (!domain || !domain.includes('.')) return '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(`https://${domain}/`, {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            signal: controller.signal,
        });
        if (!response.ok) return '';

        // 只读前 64KB，标题一定在 <head> 里
        const text = (await response.text()).slice(0, 65536);
        const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (!match) return '';

        const title = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();

        if (!title || title.length > 60) return '';
        if (NOISY_SITE_TITLES.some((re) => re.test(title))) return '';
        return title;
    } catch {
        return '';
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 解析 subscription-userinfo 响应头（流量信息）
 * @param {string} header
 * @returns {Object|null}
 */
