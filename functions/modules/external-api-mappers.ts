const NODE_PROTOCOLS = [
    'ss',
    'ssr',
    'vmess',
    'vless',
    'trojan',
    'hysteria',
    'hysteria2',
    'hy',
    'hy2',
    'tuic',
    'anytls',
    'socks5',
    'socks',
    'snell',
    'naive+https',
    'naive+quic',
    'naive+http',
    'wireguard',
];

import type { KvRecord } from '../../types/models.ts';

const NODE_PROTOCOL_REGEX = new RegExp(
    `^(${NODE_PROTOCOLS.map((protocol) => protocol.replace('+', '\\+')).join('|')}):\\/\\/`,
    'i'
);

export function isRemoteSubscription(item: unknown): boolean {
    const url = (item as { url?: unknown } | null | undefined)?.url;
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

export function isManualNode(item: unknown): boolean {
    const rawUrl = (item as { url?: unknown } | null | undefined)?.url;
    if (typeof rawUrl !== 'string') return false;
    const url = rawUrl.trim();
    if (!url || /^https?:\/\//i.test(url)) return false;
    return NODE_PROTOCOL_REGEX.test(url);
}

export function detectNodeProtocol(url = ''): string {
    const match = String(url || '')
        .trim()
        .match(/^([a-z0-9+]+):\/\//i);
    return match ? match[1].toLowerCase() : '';
}

export function toExternalSubscription(item: KvRecord) {
    return {
        id: item.id,
        type: 'subscription',
        name: item.name || '',
        url: item.url || '',
        enabled: item.enabled !== false,
        group: item.group || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        userAgent: item.userAgent || item.customUserAgent || '',
        proxy: item.proxy || item.fetchProxy || '',
        nodeCount: Number(item.nodeCount) || 0,
        userInfo: item.userInfo || null,
        lastError: item.lastError || '',
        lastUpdate: item.lastUpdate || null,
        sortIndex: Number(item.sortIndex) || 0,
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
    };
}

export function toExternalManualNode(item: KvRecord) {
    return {
        id: item.id,
        type: 'manual_node',
        name: item.name || '',
        url: item.url || '',
        protocol: detectNodeProtocol(item.url),
        enabled: item.enabled !== false,
        group: item.group || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        remarks: item.remarks || '',
        sortIndex: Number(item.sortIndex) || 0,
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
    };
}

export function toExternalProfile(profile: KvRecord) {
    return {
        id: profile.id,
        name: profile.name || '',
        description: profile.description || '',
        enabled: profile.enabled !== false,
        isPublic: profile.isPublic === true,
        customId: profile.customId || '',
        subscriptionIds: Array.isArray(profile.subscriptions)
            ? profile.subscriptions
                  .map((entry: unknown) =>
                      typeof entry === 'object' ? (entry as KvRecord | null)?.id : entry
                  )
                  .filter(Boolean)
            : [],
        manualNodeIds: Array.isArray(profile.manualNodes)
            ? profile.manualNodes.filter(Boolean)
            : [],
        target: profile.target || 'clash',
        sortIndex: Number(profile.sortIndex) || 0,
        createdAt: profile.createdAt || null,
        updatedAt: profile.updatedAt || null,
    };
}

export function toInternalProfilePatch(payload: KvRecord = {}) {
    const internal: Record<string, unknown> = {};
    if ('name' in payload) internal.name = payload.name;
    if ('description' in payload) internal.description = payload.description;
    if ('enabled' in payload) internal.enabled = payload.enabled;
    if ('isPublic' in payload) internal.isPublic = payload.isPublic;
    if ('customId' in payload) internal.customId = payload.customId;
    if ('target' in payload) internal.target = payload.target;
    if ('sortIndex' in payload) internal.sortIndex = payload.sortIndex;
    if ('subscriptionIds' in payload) internal.subscriptions = payload.subscriptionIds;
    if ('manualNodeIds' in payload) internal.manualNodes = payload.manualNodeIds;
    return internal;
}
