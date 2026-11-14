/**
 * 请求处理基础 helper（日志脱敏 / 下载计数 key / 内置配置的 proxies 段提取等）
 * 从 main-handler.js 拆分而来；编排器见 ../main-handler.js。
 */

export function maskSensitiveLogValue(value: unknown): string {
    const text = String(value ?? '');
    if (!text) return '';
    if (text.length <= 8) return '***';
    return `${text.slice(0, 4)}…${text.slice(-4)} (${text.length})`;
}

const PROFILE_DOWNLOAD_COUNT_PREFIX = 'misub_profile_download_count_';

export function getProfileDownloadCountKey(profile: unknown): string {
    const record = (profile || {}) as { customId?: unknown; id?: unknown };
    return `${PROFILE_DOWNLOAD_COUNT_PREFIX}${record.customId || record.id}`;
}

export function extractProxySectionFromBuiltin(content: unknown, targetFormat: string): string {
    if (typeof content !== 'string' || content.trim() === '') return '';

    if (targetFormat === 'clash') {
        const match = content.match(/proxies:\s*\n([\s\S]*?)\n\nproxy-groups:/i);
        return match ? match[1].trim() : '';
    }

    if (targetFormat.startsWith('surge') || targetFormat === 'loon') {
        const match = content.match(/\[Proxy\]\s*\n([\s\S]*?)(?:\n\n\[|$)/i);
        if (!match) return '';
        return match[1]
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !/^DIRECT\s*=\s*direct$/i.test(line))
            .join('\n');
    }

    if (targetFormat === 'quanx') {
        const match = content.match(/\[server_local\]\s*\n([\s\S]*?)(?:\n\n\[|$)/i);
        if (!match) return '';
        return match[1]
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !/^DIRECT\s*=\s*direct$/i.test(line))
            .join('\n');
    }

    if (targetFormat === 'singbox' || targetFormat === 'sing-box') {
        try {
            const config = JSON.parse(content) as Record<string, unknown>;
            if (Array.isArray(config.outbounds)) {
                // 过滤掉 direct, block, dns-out 等元 outbound
                const proxies = config.outbounds.filter((o: unknown) => {
                    const record = (o || {}) as Record<string, unknown>;
                    return (
                        record.type !== 'direct' && record.type !== 'block' && record.type !== 'dns'
                    );
                });
                return JSON.stringify(proxies, null, 2);
            }
        } catch {
            return '';
        }
    }

    return '';
}

export function buildManagedConfigUrl(requestUrl: string): string {
    const managedUrl = new URL(requestUrl);
    managedUrl.searchParams.delete('refresh');
    managedUrl.searchParams.delete('nocache');
    return managedUrl.toString();
}
