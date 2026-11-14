import { inferAirportRootDomain } from './airport-domain.ts';

/** 机场身份（用户手工指定或自动推断出的分组信息） */
export interface AirportIdentity {
    groupId: string;
    name: string;
}

/** 身份相关函数能接受的最小订阅形状（列表里既可能是订阅也可能是手工节点） */
export interface AirportIdentityCarrier {
    id?: string | number;
    url?: string;
    airportIdentity?: AirportIdentity | null;
    [key: string]: unknown;
}

/** Stable grouping key shared by list sorting and visual grouping. */
export function getAirportIdentityKey(subscription: AirportIdentityCarrier | null | undefined) {
    const identityKey = String(subscription?.airportIdentity?.groupId || '').trim();
    if (identityKey) return `identity:${identityKey}`;
    const root = inferAirportRootDomain(subscription?.url);
    if (root) return `site:${root}`;
    const rawUrl = subscription?.url;
    if (!rawUrl) return `id:${subscription?.id || ''}`;
    try {
        const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
        return host ? `site:${host}` : `id:${subscription?.id || ''}`;
    } catch {
        return `id:${subscription?.id || ''}`;
    }
}

export function getAirportIdentityName(subscription: AirportIdentityCarrier | null | undefined) {
    return String(subscription?.airportIdentity?.name || '').trim();
}

export function createAirportGroupId() {
    return (
        globalThis.crypto?.randomUUID?.() ||
        `airport-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
}

export function setAirportIdentity(
    subscription: AirportIdentityCarrier | null | undefined,
    groupId: unknown,
    name: unknown
) {
    if (!subscription || typeof subscription !== 'object') return subscription;
    const normalizedId = String(groupId || '').trim();
    const normalizedName = String(name || '').trim();
    if (!normalizedId || !normalizedName) return subscription;
    subscription.airportIdentity = { groupId: normalizedId, name: normalizedName };
    return subscription;
}

export function resetAirportIdentity(subscription: AirportIdentityCarrier | null | undefined) {
    if (!subscription || typeof subscription !== 'object') return subscription;
    subscription.airportIdentity = null;
    return subscription;
}
