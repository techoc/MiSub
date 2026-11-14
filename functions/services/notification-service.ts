/**
 * 通知服务 (核心实现)
 * @author MiSub Team
 */

import type { MisubSettings } from '../../types/models.ts';

/** IP 地理位置信息（外部 JSON/HTML 解析产物） */
interface GeoLocationInfo {
    country?: unknown;
    city?: unknown;
    isp?: unknown;
    asn?: unknown;
}

/** 普通对象归一化 */
function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * 转义 Telegram HTML 模式下的特殊字符
 * @param {string} text - 待转义的文本
 * @returns {string} - 转义后的文本
 */
export function tgEscape(text: unknown): string {
    if (typeof text !== 'string') return String(text || '');
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function splitIpCnLocation(value: unknown): string[] {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function isLikelyCarrier(value: unknown): boolean {
    return /(?:移动|联通|电信|電信|广电|廣電|铁通|鐵通|教育网|教育網|宽带|寬帶|通信|通訊|网络|網絡|中华电信|中華電信|台湾大哥大|台灣大哥大|远传|遠傳|台湾之星|台灣之星|亚太电信|亞太電信)$/i.test(
        String(value || '').trim()
    );
}

function parseIpCnHtml(html: unknown): GeoLocationInfo | null {
    const text = String(html || '');
    const description = text
        .match(
            /<meta\s+name=["']description["']\s+content=["'][^"']*?归属地为[：:]\s*([^，,"'<]+?)(?:，|提供|["'])/i
        )?.[1]
        ?.trim();
    const tableLocation = text
        .match(/所在地理位置[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/i)?.[1]
        ?.trim();
    const tableParts = splitIpCnLocation(tableLocation);
    const descriptionParts = splitIpCnLocation(description);

    if (tableParts.length > 0) {
        const result: GeoLocationInfo = {
            country: tableParts[0],
            city: tableParts.slice(1).join(' '),
        };
        const descriptionStartsWithTable = tableParts.every(
            (part, index) => descriptionParts[index] === part
        );
        const extraParts = descriptionStartsWithTable
            ? descriptionParts.slice(tableParts.length)
            : [];
        const carrier = extraParts.at(-1);

        if (isLikelyCarrier(carrier)) {
            const extraPlaceParts = extraParts.slice(0, -1);
            result.city = [...tableParts.slice(1), ...extraPlaceParts].join(' ');
            result.isp = carrier;
        }

        return result;
    }

    if (descriptionParts.length === 0) return null;
    const carrier = descriptionParts.at(-1);
    const hasCarrier = isLikelyCarrier(carrier);
    const placeParts = hasCarrier ? descriptionParts.slice(0, -1) : descriptionParts;
    return {
        country: placeParts[0],
        city: placeParts.slice(1).join(' '),
        isp: hasCarrier ? carrier : undefined,
    };
}

/** 地理位置查询 provider */
interface GeoProvider {
    name: string;
    supports?: (ip: string) => boolean;
    buildUrl: (ip: string) => string;
    requestInit?: RequestInit;
    read?: (response: Response) => Promise<string>;
    parse: (data: unknown) => GeoLocationInfo | null;
}

const IP_GEOLOCATION_PROVIDERS: GeoProvider[] = [
    {
        name: 'ip.cn',
        supports: (ip) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip),
        buildUrl: (ip) => `https://ip.cn/ip/${encodeURIComponent(ip)}.html`,
        requestInit: {
            redirect: 'manual',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://ip.cn/',
            },
        },
        read: (response) => response.text(),
        parse: parseIpCnHtml,
    },
    {
        name: 'ipwho.is',
        buildUrl: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`,
        parse: (data) => {
            const payload = asRecord(data);
            if (!payload.success) return null;
            const connection = asRecord(payload.connection);
            return {
                country: payload.country,
                city: payload.city,
                isp: connection.org || connection.isp,
                asn: connection.asn,
            };
        },
    },
    {
        name: 'ipapi.co',
        buildUrl: (ip) => `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
        parse: (data) => {
            const payload = asRecord(data);
            if (payload.error) return null;
            return {
                country: payload.country_name || payload.country,
                city: payload.city,
                isp: payload.org || payload.network,
                asn: payload.asn,
            };
        },
    },
    {
        name: 'ipinfo.io',
        buildUrl: (ip) => `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
        parse: (data) => {
            const payload = asRecord(data);
            if (payload.bogon || payload.error) return null;
            return {
                country: payload.country,
                city: payload.city,
                isp: payload.org,
                asn: payload.asn || String(payload.org || '').match(/^AS\d+/)?.[0],
            };
        },
    },
];

function hasGeolocationValue(info: GeoLocationInfo | null): boolean {
    if (!info) return false;
    return Object.values(info).some(
        (value) => value !== undefined && value !== null && String(value).trim() !== ''
    );
}

function mergeMissingGeolocationValues(
    current: GeoLocationInfo = {},
    incoming: unknown = {}
): GeoLocationInfo {
    const merged: GeoLocationInfo = { ...current };
    const source = asRecord(incoming);
    for (const key of ['country', 'city', 'isp', 'asn'] as const) {
        if (!merged[key] && source[key]) merged[key] = source[key];
    }
    return merged;
}

async function fetchIpGeolocation(clientIp: string): Promise<GeoLocationInfo | null> {
    if (
        !clientIp ||
        clientIp === 'N/A' ||
        clientIp === 'Unknown' ||
        !/^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i.test(clientIp)
    )
        return null;

    let result: GeoLocationInfo = {};
    for (const provider of IP_GEOLOCATION_PROVIDERS) {
        if (provider.supports && !provider.supports(clientIp)) continue;
        try {
            const init: RequestInit & { cf?: Record<string, unknown> } = {
                cf: { timeout: 3000 },
                ...(provider.requestInit || {}),
            };
            const response = await fetch(provider.buildUrl(clientIp), init);
            if (!response.ok) continue;
            const body = provider.read ? await provider.read(response) : await response.json();
            const info = provider.parse(body);
            if (!hasGeolocationValue(info)) continue;

            result = mergeMissingGeolocationValues(result ?? undefined, info);
            if (result.country && result.city && result.isp && result.asn) return result;
        } catch (error) {
            console.debug(`[NotificationService] ${provider.name} geolocation failed:`, error);
        }
    }

    return hasGeolocationValue(result) ? result : null;
}

/**
 * 发送基本的Telegram通知
 * @param {Object} settings - 设置对象
 * @param {string} message - 消息内容 (支持部分 HTML 标签: <b>, <i>, <code>, <a>)
 * @returns {Promise<boolean>} - 是否发送成功
 */
export async function sendTgNotification(
    settings: MisubSettings,
    message: string
): Promise<boolean> {
    if (!settings.BotToken || !settings.ChatID) {
        return false;
    }

    // 为所有消息添加时间戳
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const fullMessage = `${message}\n\n<b>时间:</b> <code>${now} (UTC+8)</code>`;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: fullMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[NotificationService] TG API Error:', response.status, errorData);
        }

        return response.ok;
    } catch (error) {
        console.error('[NotificationService] Network Error:', error);
        return false;
    }
}

/**
 * 增强版TG通知，包含IP地理位置信息
 * @param {Object} settings - 设置对象
 * @param {string} type - 通知类型 (支持 HTML)
 * @param {string} clientIp - 客户端IP
 * @param {string} additionalData - 额外数据 (支持 HTML)
 * @returns {Promise<boolean>} - 是否发送成功
 */
export async function sendEnhancedTgNotification(
    settings: MisubSettings,
    type: string,
    clientIp: string,
    additionalData = ''
): Promise<boolean> {
    if (!settings.BotToken || !settings.ChatID) {
        return false;
    }

    let locationInfo = '';

    const ipInfo = await fetchIpGeolocation(clientIp);
    if (ipInfo) {
        const asn = ipInfo.asn
            ? String(ipInfo.asn).startsWith('AS')
                ? ipInfo.asn
                : `AS${ipInfo.asn}`
            : 'N/A';
        locationInfo = `
<b>国家:</b> <code>${tgEscape(ipInfo.country || 'N/A')}</code>
<b>城市:</b> <code>${tgEscape(ipInfo.city || 'N/A')}</code>
<b>ISP:</b> <code>${tgEscape(ipInfo.isp || 'N/A')}</code>
<b>ASN:</b> <code>${tgEscape(asn)}</code>`;
    }

    // 构建完整消息
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const message = `${type}

<b>IP 地址:</b> <code>${tgEscape(clientIp)}</code>${locationInfo}

${additionalData}

<b>时间:</b> <code>${now} (UTC+8)</code>`;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(
                '[NotificationService] TG API Error (Enhanced):',
                response.status,
                errorData
            );
        }

        return response.ok;
    } catch (error) {
        console.error('[NotificationService] Network Error (Enhanced):', error);
        return false;
    }
}

/**
 * 调试发送Telegram通知（返回详细错误信息）
 */
export async function debugTgNotification(
    settings: MisubSettings,
    message: string
): Promise<{ success: boolean; response?: unknown; error?: string }> {
    if (!settings.BotToken || !settings.ChatID) {
        return { success: false, error: 'BotToken or ChatID not configured' };
    }

    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const fullMessage = `${message}\n\n<b>时间:</b> <code>${now} (UTC+8)</code>`;

    const url = `https://api.telegram.org/bot${settings.BotToken}/sendMessage`;
    const payload = {
        chat_id: settings.ChatID,
        text: fullMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, response: data };
        } else {
            return {
                success: false,
                error: `Telegram API Error: ${response.status} ${response.statusText}`,
                response: data,
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Network/Fetch Error: ${(error as Error).message}`,
        };
    }
}
