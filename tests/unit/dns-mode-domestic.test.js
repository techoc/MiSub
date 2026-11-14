import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import {
    DNS_MODES,
    DNS_PROXY_GROUP,
    buildSingboxDnsConfig,
    isDomesticDnsMode,
    normalizeDnsMode,
    resolveSafeDnsConfig,
} from '../../functions/modules/subscription/safe-dns.js';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import { resolveBuiltinRequestOptions } from '../../functions/modules/subscription/main-handler/engine-flags.js';
import { migrateConfigSettings } from '../../functions/modules/utils.js';

const sampleNodeList = [
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@hk.example.com:443#%F0%9F%87%AD%F0%9F%87%B0%20%E9%A6%99%E6%B8%AF%2001',
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@us.example.com:443#%F0%9F%87%BA%F0%9F%87%B8%20%E7%BE%8E%E5%9B%BD%2001',
].join('\n');

const minimalIniTemplate = [
    '[rule]',
    'GEOIP,CN,DIRECT',
    'FINAL,🚀 节点选择',
    '',
    '[custom]',
    'custom_proxy_group=🚀 节点选择`select`[]♻️ 自动选择`[]DIRECT',
    'custom_proxy_group=♻️ 自动选择`url-test`.*`http://www.gstatic.com/generate_204`300,,50',
].join('\n');

const DOMESTIC_UDP = ['udp://223.5.5.5:53', 'udp://119.29.29.29:53'];
const DOMESTIC_ENCRYPTED = ['https://223.5.5.5/dns-query', 'https://120.53.53.53/dns-query'];

describe('DNS mode normalization (4 options)', () => {
    it('exposes two foreign and two domestic canonical modes', () => {
        expect(Object.values(DNS_MODES)).toEqual(
            expect.arrayContaining(['clean', 'polluted', 'domestic-clean', 'domestic-polluted'])
        );
        expect(Object.values(DNS_MODES)).toHaveLength(4);
    });

    it('normalizes aliases and unknown values onto the canonical set', () => {
        expect(normalizeDnsMode('clean')).toBe('clean');
        expect(normalizeDnsMode('polluted')).toBe('polluted');
        expect(normalizeDnsMode('domestic-clean')).toBe('domestic-clean');
        expect(normalizeDnsMode('domestic-polluted')).toBe('domestic-polluted');
        expect(normalizeDnsMode('domestic')).toBe('domestic-clean');
        expect(normalizeDnsMode('foreign-clean')).toBe('clean');
        expect(normalizeDnsMode('foreign-polluted')).toBe('polluted');
        expect(normalizeDnsMode('')).toBe('clean');
        expect(normalizeDnsMode('  DOMESTIC-POLLUTED ')).toBe('domestic-polluted');
        expect(normalizeDnsMode('nonsense')).toBe('clean');
    });

    it('classifies domestic modes for group-injection guards', () => {
        expect(isDomesticDnsMode('domestic-clean')).toBe(true);
        expect(isDomesticDnsMode('domestic-polluted')).toBe(true);
        expect(isDomesticDnsMode('domestic')).toBe(true);
        expect(isDomesticDnsMode('clean')).toBe(false);
        expect(isDomesticDnsMode('polluted')).toBe(false);
        expect(isDomesticDnsMode('')).toBe(false);
    });

    it('keeps foreign modes on the domestic-baseline structure (fallback via the exit group)', () => {
        const clean = resolveSafeDnsConfig('', { mode: 'clean' });
        expect(clean.nameserver).toEqual(['udp://223.5.5.5:53', 'udp://119.29.29.29:53']);
        expect(clean.fallback).toEqual([
            `udp://8.8.8.8:53#${DNS_PROXY_GROUP}`,
            `udp://1.1.1.1:53#${DNS_PROXY_GROUP}`,
        ]);

        const polluted = resolveSafeDnsConfig('', { mode: 'polluted' });
        expect(polluted.nameserver).toEqual(['udp://223.5.5.5:53', 'udp://119.29.29.29:53']);
        expect(polluted.fallback.every((server) => server.startsWith('https://'))).toBe(true);
        expect(polluted.fallback.every((server) => server.endsWith(`#${DNS_PROXY_GROUP}`))).toBe(
            true
        );
    });
});

describe('domestic Safe DNS (mihomo block)', () => {
    it('routes everything through plain Ali/Tencent UDP in domestic-clean mode', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'domestic-clean' });

        expect(dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(dns['nameserver-policy']['geosite:geolocation-!cn']).toEqual(DOMESTIC_UDP);
        expect(dns['nameserver-policy']['geosite:cn']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(dns['default-nameserver']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(dns.fallback).toEqual([]);
        expect(JSON.stringify(dns)).not.toContain(DNS_PROXY_GROUP);
    });

    it('routes everything through Ali/DNSPod encrypted DoH in domestic-polluted mode', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'domestic-polluted' });

        expect(dns.nameserver).toEqual(DOMESTIC_ENCRYPTED);
        expect(dns['nameserver-policy']['geosite:geolocation-!cn']).toEqual(DOMESTIC_ENCRYPTED);
        expect(dns['nameserver-policy']['geosite:cn']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(dns['default-nameserver']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(dns.fallback).toEqual([]);
        expect(JSON.stringify(dns)).not.toContain(DNS_PROXY_GROUP);
    });

    it('converts user-overridden domestic resolvers to the active style', () => {
        const polluted = resolveSafeDnsConfig(
            { domestic: ['1.2.3.4'] },
            {
                mode: 'domestic-polluted',
            }
        );
        expect(polluted.nameserver).toEqual(['https://1.2.3.4/dns-query']);

        const clean = resolveSafeDnsConfig(
            { domestic: ['dns.alidns.com'] },
            {
                mode: 'domestic-clean',
            }
        );
        expect(clean.nameserver).toEqual(['udp://dns.alidns.com:53']);
        // bootstrap buckets stay plain
        expect(clean['default-nameserver']).toEqual(['dns.alidns.com']);
    });

    it('treats the domestic alias as domestic-clean', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'domestic' });
        expect(dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(JSON.stringify(dns)).not.toContain(DNS_PROXY_GROUP);
    });
});

describe('domestic sing-box DNS config', () => {
    it('uses only direct domestic udp servers in domestic-clean mode', () => {
        const config = buildSingboxDnsConfig('', { mode: 'domestic-clean' });

        expect(config.servers).toHaveLength(2);
        expect(config.servers.map((server) => server.tag)).toEqual(['dns-cn-1', 'dns-cn-2']);
        expect(config.servers.every((server) => server.type === 'udp')).toBe(true);
        expect(config.servers.every((server) => server.detour === 'DIRECT')).toBe(true);
        expect(config.final).toBe('dns-cn-1');
        expect(config.servers.some((server) => server.tag.startsWith('dns-foreign'))).toBe(false);
    });

    it('uses only direct domestic https servers in domestic-polluted mode', () => {
        const config = buildSingboxDnsConfig('', { mode: 'domestic-polluted' });

        expect(config.servers).toHaveLength(2);
        expect(config.servers.map((server) => server.server)).toEqual([
            '223.5.5.5',
            '120.53.53.53',
        ]);
        expect(config.servers.every((server) => server.type === 'https')).toBe(true);
        expect(config.servers.every((server) => server.path === '/dns-query')).toBe(true);
        expect(config.servers.every((server) => server.detour === 'DIRECT')).toBe(true);
        expect(config.final).toBe('dns-cn-1');
    });
});

describe('template renderers honor domestic modes', () => {
    it('template clash: domestic mode injects no DNS exit group and no #group references', () => {
        const output = renderClashFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            dnsMode: 'domestic-clean',
            fileName: 'DomesticTemplateClash',
        });
        const parsed = yaml.load(output);

        expect((parsed['proxy-groups'] || []).some((group) => group.name === DNS_PROXY_GROUP)).toBe(
            false
        );
        expect(parsed.dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(JSON.stringify(parsed.dns)).not.toContain(DNS_PROXY_GROUP);
    });

    it('template singbox: domestic mode renders direct-only dns and DIRECT rule-set detours', () => {
        const output = renderSingboxFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            dnsMode: 'domestic-polluted',
            fileName: 'DomesticTemplateSingbox',
        });
        const config = JSON.parse(output);

        expect(config.outbounds.some((outbound) => outbound.tag === DNS_PROXY_GROUP)).toBe(false);
        expect(config.dns.servers.every((server) => server.type === 'https')).toBe(true);
        expect(config.dns.servers.every((server) => server.detour === 'DIRECT')).toBe(true);
        expect(config.dns.final).toBe('dns-cn-1');
        expect(
            (config.route.rule_set || []).every((ruleSet) => ruleSet.download_detour === 'DIRECT')
        ).toBe(true);
    });
});

describe('builtin generators honor domestic modes', () => {
    it('builtin clash: domestic mode drops the DNS exit group', () => {
        const output = generateBuiltinClashConfig(sampleNodeList, {
            ruleLevel: 'std',
            dnsMode: 'domestic-clean',
            fileName: 'DomesticBuiltinClash',
        });
        const parsed = yaml.load(output);

        expect((parsed['proxy-groups'] || []).some((group) => group.name === DNS_PROXY_GROUP)).toBe(
            false
        );
        expect(parsed.dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(JSON.stringify(parsed.dns)).not.toContain(DNS_PROXY_GROUP);
    });

    it('builtin clash: domestic override text that references the DNS exit group keeps the group', () => {
        const output = generateBuiltinClashConfig(sampleNodeList, {
            ruleLevel: 'std',
            dnsMode: 'domestic-clean',
            customDnsOverride: `nameserver: ['udp://8.8.8.8:53#${DNS_PROXY_GROUP}']`,
            fileName: 'DomesticBuiltinClashKeepGroup',
        });
        const parsed = yaml.load(output);

        expect((parsed['proxy-groups'] || []).some((group) => group.name === DNS_PROXY_GROUP)).toBe(
            true
        );
    });

    it('builtin singbox: domestic mode drops the DNS exit outbound and pins DIRECT detours', () => {
        const output = generateBuiltinSingboxConfig(sampleNodeList, {
            ruleLevel: 'std',
            dnsMode: 'domestic-polluted',
            fileName: 'DomesticBuiltinSingbox',
        });
        const parsed = JSON.parse(output);

        expect(parsed.outbounds.some((outbound) => outbound.tag === DNS_PROXY_GROUP)).toBe(false);
        expect(parsed.dns.servers.every((server) => server.detour === 'DIRECT')).toBe(true);
        expect(parsed.dns.final).toBe('dns-cn-1');
        expect(
            (parsed.route.rule_set || []).every((ruleSet) => ruleSet.download_detour === 'DIRECT')
        ).toBe(true);
    });
});

describe('request/migration plumbing normalizes the 4-valued mode', () => {
    it('engine-flags passes domestic modes through query params', () => {
        expect(
            resolveBuiltinRequestOptions({
                searchParams: new URLSearchParams('dnsMode=domestic-polluted'),
            }).dnsMode
        ).toBe('domestic-polluted');
        expect(
            resolveBuiltinRequestOptions({
                searchParams: new URLSearchParams('dns-mode=domestic'),
            }).dnsMode
        ).toBe('domestic-clean');
        expect(
            resolveBuiltinRequestOptions({
                searchParams: new URLSearchParams('dnsMode=polluted'),
            }).dnsMode
        ).toBe('polluted');
        expect(
            resolveBuiltinRequestOptions({ searchParams: new URLSearchParams('') }).dnsMode
        ).toBe('clean');
    });

    it('settings migration keeps saved domestic modes and canonicalizes aliases', () => {
        expect(migrateConfigSettings({ dnsMode: 'domestic-polluted' }).dnsMode).toBe(
            'domestic-polluted'
        );
        expect(migrateConfigSettings({ dnsMode: 'domestic' }).dnsMode).toBe('domestic-clean');
        expect(migrateConfigSettings({ dnsMode: 'clean' }).dnsMode).toBe('clean');
        expect(migrateConfigSettings({ dnsMode: 'unknown-value' }).dnsMode).toBe('clean');
    });
});
