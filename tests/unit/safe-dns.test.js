import { describe, expect, it } from 'vitest';
import {
    DNS_PROXY_GROUP,
    buildSingboxDnsConfig,
    resolveDnsPolicy,
    resolveSafeDnsConfig,
} from '../../functions/modules/subscription/safe-dns.ts';

describe('shared split DNS policy', () => {
    it('resolves against a domestic baseline and keeps foreign DNS as proxied fallback in clean mode', () => {
        const dns = resolveSafeDnsConfig('');

        expect(dns['respect-rules']).toBe(true);
        expect(dns.nameserver).toEqual(['udp://223.5.5.5:53', 'udp://119.29.29.29:53']);
        expect(dns['nameserver-policy']['geosite:cn']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(dns.fallback).toEqual([
            `udp://8.8.8.8:53#${DNS_PROXY_GROUP}`,
            `udp://1.1.1.1:53#${DNS_PROXY_GROUP}`,
        ]);
        expect(dns['proxy-server-nameserver']).toEqual(['223.5.5.5', '119.29.29.29']);
        // geolocation-!cn 策略会让国外域名绕过 fallback 竞速，兜底失效
        expect(dns['nameserver-policy']).not.toHaveProperty('geosite:geolocation-!cn');
    });

    it('uses encrypted foreign resolvers only in polluted mode (as proxied fallback)', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'polluted' });
        const singbox = buildSingboxDnsConfig('', { mode: 'polluted' });

        expect(dns.nameserver).toEqual(['udp://223.5.5.5:53', 'udp://119.29.29.29:53']);
        expect(dns.fallback.every((server) => server.startsWith('https://'))).toBe(true);
        expect(dns.fallback.every((server) => server.endsWith(`#${DNS_PROXY_GROUP}`))).toBe(true);
        expect(
            singbox.servers.some(
                (server) => server.type === 'https' && server.detour === DNS_PROXY_GROUP
            )
        ).toBe(true);
        expect(singbox.final).toBe('dns-cn-1');
        expect(singbox.rules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rule_set: ['geosite-cn'],
                    action: 'route',
                    server: 'dns-cn-1',
                }),
                expect.objectContaining({
                    rule_set: ['geosite-geolocation-!cn'],
                    action: 'route',
                    server: 'dns-foreign-1',
                }),
            ])
        );
    });

    it('downgrades encrypted KV foreign resolvers to plain UDP in the clean fallback', () => {
        const dns = resolveSafeDnsConfig({ nameserver: ['https://dns.google/dns-query'] });

        expect(dns.fallback).toEqual([`udp://dns.google:53#${DNS_PROXY_GROUP}`]);
        expect(dns.nameserver).toEqual(['udp://223.5.5.5:53', 'udp://119.29.29.29:53']);
    });

    it('rejects unsafe resolver overrides and keeps the safe policy', () => {
        const policy = resolveDnsPolicy({
            mode: 'polluted',
            domestic: ['127.0.0.1'],
            foreign: ['udp://0.0.0.0:53#DIRECT'],
            polluted: ['https://8.8.8.8/dns-query'],
        });

        expect(policy.domestic).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(policy.foreign).toEqual(['udp://8.8.8.8:53', 'udp://1.1.1.1:53']);
        expect(policy.polluted).toEqual(['https://8.8.8.8/dns-query']);
    });
});
