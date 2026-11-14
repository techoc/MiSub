/**
 * Telegram 消息文本解析工具：节点/订阅 URL 提取、随机 ID、导入分组名
 * 从 telegram-webhook-handler.js 拆分而来；编排器见 ../telegram-webhook-handler.js。
 */

// ==================== 工具函数 ====================

/**
 * 生成随机ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * 从节点URL提取名称
 */
export function extractNodeName(url: string): string {
    try {
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
            const encoded = url.substring(hashIndex + 1);
            try {
                return decodeURIComponent(encoded);
            } catch {
                return encoded;
            }
        }
        const protocol = url.split('://')[0].toUpperCase();
        return `${protocol} 节点`;
    } catch {
        return '未命名节点';
    }
}

/**
 * 提取节点链接（支持多种协议）
 */
export function extractNodeUrls(text: string): string[] {
    const protocols = [
        'ss://',
        'ssr://',
        'vmess://',
        'vless://',
        'trojan://',
        'hysteria://',
        'hysteria2://',
        'hy2://',
        'tuic://',
        'snell://',
        'anytls://',
        'wireguard://',
        'socks5://',
        'socks5-tls://',
    ];
    const urls: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        const lowerTrimmed = trimmed.toLowerCase();
        for (const protocol of protocols) {
            if (lowerTrimmed.startsWith(protocol)) {
                urls.push(trimmed);
                break;
            }
        }
    }

    return urls;
}

/**
 * 从文本中提取订阅链接（http/https）。
 *
 * 与 extractNodeUrls 的区别：节点协议要求整行就是链接，而订阅链接常被
 * 粘贴成「名称: https://...」或一行多个，因此这里用宽松匹配，再按 URL 去重。
 *
 * @param {string} text
 * @returns {string[]} 去重后的订阅链接
 */
export function extractSubscriptionUrls(text: string): string[] {
    const matches = String(text || '').match(/https?:\/\/[^\s<>"'，。、；：！？）】]+/gi) || [];
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const raw of matches) {
        // 去掉尾部常见的标点残留
        const url = raw.replace(/[.,;:!?]+$/, '');
        if (!url || seen.has(url)) continue;
        try {
            new URL(url);
        } catch {
            continue;
        }
        seen.add(url);
        urls.push(url);
    }
    return urls;
}
/**
 * 生成 TG 导入的分组名。
 *
 * 让同一批（同一条消息 / 同一个文件）导入的节点归入同一分组，
 * 便于在网页端按组批量管理和加入订阅组。
 *
 * @param {Object} options
 * @param {string} [options.source] 来源标识：file / text
 * @param {string} [options.fileName] 文件名（file 来源时使用）
 * @param {Date}   [options.now] 时间（便于测试注入）
 * @returns {string} 形如「TG-文件 nodes 2026-09-15」或「TG-导入 2026-09-15 18:30」
 */
/** buildImportGroupName 入参 */
interface ImportGroupNameOptions {
    source?: string;
    fileName?: string;
    now?: Date;
}

export function buildImportGroupName({
    source = 'text',
    fileName = '',
    now = new Date(),
}: ImportGroupNameOptions = {}): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (source === 'file' && fileName) {
        // 去掉扩展名，作为分组标识
        const base = String(fileName)
            .replace(/\.[a-z0-9]+$/i, '')
            .trim();
        if (base) return `TG-${base}-${dateStr}`;
    }

    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return `TG-导入-${dateStr} ${timeStr}`;
}
