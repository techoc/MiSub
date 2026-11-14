import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import {
    DNS_PROXY_GROUP,
    SINGBOX_CN_RULE_SET,
    SINGBOX_FOREIGN_RULE_SET,
    buildSingboxDnsConfig,
    resolveSafeDnsConfig,
} from '../../functions/modules/subscription/safe-dns.js';
import { getSingboxForeignRuleSet } from '../../functions/modules/subscription/builtin-rules-provider.js';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import { PINNED_RULE_REVISIONS } from '../../functions/modules/subscription/builtin-rules-provider.js';

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
const FOREIGN_UDP = [`udp://8.8.8.8:53#${DNS_PROXY_GROUP}`, `udp://1.1.1.1:53#${DNS_PROXY_GROUP}`];
const FOREIGN_ENCRYPTED = [
    `https://8.8.8.8/dns-query#${DNS_PROXY_GROUP}`,
    `https://1.1.1.1/dns-query#${DNS_PROXY_GROUP}`,
];

describe('foreign modes resolve against a domestic baseline (classic pattern)', () => {
    it('clean mode: domestic plain UDP nameserver + foreign UDP fallback via the exit group', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'clean' });

        expect(dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(dns.fallback).toEqual(FOREIGN_UDP);
        expect(dns['fallback-filter']).toMatchObject({ geoip: true, 'geoip-code': 'CN' });
        // geolocation-!cn 策略会让国外域名绕过 nameserver/fallback 竞速，兜底失效，必须移除
        expect(dns['nameserver-policy']).not.toHaveProperty('geosite:geolocation-!cn');
        expect(dns['nameserver-policy']['geosite:cn']).toEqual(['223.5.5.5', '119.29.29.29']);
        expect(dns['proxy-server-nameserver']).toEqual(['223.5.5.5', '119.29.29.29']);
    });

    it('polluted mode: domestic baseline + encrypted foreign fallback via the exit group', () => {
        const dns = resolveSafeDnsConfig('', { mode: 'polluted' });

        expect(dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(dns.fallback).toEqual(FOREIGN_ENCRYPTED);
        expect(dns['nameserver-policy']).not.toHaveProperty('geosite:geolocation-!cn');
    });

    it('policy-type foreign overrides still feed the fallback bucket with style downgrade', () => {
        const dns = resolveSafeDnsConfig(
            { nameserver: ['https://dns.google/dns-query'] },
            {
                mode: 'clean',
            }
        );
        expect(dns.fallback).toEqual([`udp://dns.google:53#${DNS_PROXY_GROUP}`]);
        expect(dns.nameserver).toEqual(DOMESTIC_UDP);
    });

    it('domestic modes keep their all-domestic semantics (no foreign fallback)', () => {
        const clean = resolveSafeDnsConfig('', { mode: 'domestic-clean' });
        expect(clean.nameserver).toEqual(DOMESTIC_UDP);
        expect(clean['nameserver-policy']['geosite:geolocation-!cn']).toEqual(DOMESTIC_UDP);
        expect(clean.fallback).toEqual([]);

        const polluted = resolveSafeDnsConfig('', { mode: 'domestic-polluted' });
        expect(polluted.nameserver).toEqual([
            'https://223.5.5.5/dns-query',
            'https://120.53.53.53/dns-query',
        ]);
        expect(polluted.fallback).toEqual([]);
    });
});

describe('sing-box mirrors the domestic-baseline structure', () => {
    it('foreign mode: geolocation-!cn rule routes to foreign servers, final falls back domestic', () => {
        const config = buildSingboxDnsConfig('', { mode: 'clean' });

        expect(config.final).toBe('dns-cn-1');
        expect(config.servers.some((server) => server.tag === 'dns-foreign-1')).toBe(true);
        expect(config.servers.find((server) => server.tag === 'dns-foreign-1')?.detour).toBe(
            DNS_PROXY_GROUP
        );
        expect(config.rules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rule_set: [SINGBOX_FOREIGN_RULE_SET],
                    action: 'route',
                    server: 'dns-foreign-1',
                }),
            ])
        );
        expect(config.rules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rule_set: [SINGBOX_CN_RULE_SET],
                    action: 'route',
                    server: 'dns-cn-1',
                }),
            ])
        );
    });

    it('polluted mode keeps encrypted foreign servers behind the same structure', () => {
        const config = buildSingboxDnsConfig('', { mode: 'polluted' });

        expect(config.final).toBe('dns-cn-1');
        expect(config.servers.find((server) => server.tag === 'dns-foreign-1')).toMatchObject({
            type: 'https',
            server: '8.8.8.8',
            detour: DNS_PROXY_GROUP,
        });
    });

    it('domestic mode: no geolocation rule and no foreign servers', () => {
        const config = buildSingboxDnsConfig('', { mode: 'domestic-clean' });

        expect(config.final).toBe('dns-cn-1');
        expect(config.servers.every((server) => server.tag.startsWith('dns-cn-'))).toBe(true);
        expect(
            config.rules.some(
                (rule) =>
                    Array.isArray(rule.rule_set) && rule.rule_set.includes(SINGBOX_FOREIGN_RULE_SET)
            )
        ).toBe(false);
    });

    it('exposes the pinned geolocation-!cn remote rule-set definition', () => {
        const ruleSet = getSingboxForeignRuleSet();
        expect(ruleSet).toMatchObject({
            tag: SINGBOX_FOREIGN_RULE_SET,
            type: 'remote',
            format: 'binary',
            download_detour: DNS_PROXY_GROUP,
        });
        expect(ruleSet.url).toContain('jsdelivr');
        expect(ruleSet.url).toContain(PINNED_RULE_REVISIONS.SING_GEOSITE);

        expect(getSingboxForeignRuleSet('DIRECT').download_detour).toBe('DIRECT');
    });
});

describe('builtin generators emit the domestic-baseline DNS', () => {
    it('builtin clash (foreign): domestic nameserver, foreign fallback, exit group intact', () => {
        const output = generateBuiltinClashConfig(sampleNodeList, {
            ruleLevel: 'std',
            fileName: 'FallbackBuiltinClash',
        });
        const parsed = yaml.load(output);

        expect(parsed.dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(parsed.dns.fallback).toEqual(FOREIGN_UDP);
        expect((parsed['proxy-groups'] || []).some((group) => group.name === DNS_PROXY_GROUP)).toBe(
            true
        );
    });

    it('builtin singbox (foreign): geolocation rule-set defined, final domestic, exit group intact', () => {
        const output = generateBuiltinSingboxConfig(sampleNodeList, {
            ruleLevel: 'std',
            fileName: 'FallbackBuiltinSingbox',
        });
        const parsed = JSON.parse(output);

        expect(parsed.dns.final).toBe('dns-cn-1');
        expect(parsed.dns.rules).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    rule_set: [SINGBOX_FOREIGN_RULE_SET],
                    server: 'dns-foreign-1',
                }),
            ])
        );
        const foreignRuleSet = (parsed.route.rule_set || []).find(
            (ruleSet) => ruleSet.tag === SINGBOX_FOREIGN_RULE_SET
        );
        expect(foreignRuleSet).toBeTruthy();
        expect(foreignRuleSet.download_detour).toBe(DNS_PROXY_GROUP);
        expect(parsed.outbounds.some((outbound) => outbound.tag === DNS_PROXY_GROUP)).toBe(true);
    });

    it('builtin singbox (domestic): geolocation rule-set not injected', () => {
        const output = generateBuiltinSingboxConfig(sampleNodeList, {
            ruleLevel: 'std',
            dnsMode: 'domestic-clean',
            fileName: 'FallbackBuiltinSingboxDomestic',
        });
        const parsed = JSON.parse(output);

        expect(
            (parsed.route.rule_set || []).some(
                (ruleSet) => ruleSet.tag === SINGBOX_FOREIGN_RULE_SET
            )
        ).toBe(false);
    });
});

describe('template renderers emit the domestic-baseline DNS', () => {
    it('template clash (foreign): domestic nameserver, foreign fallback, exit group kept', () => {
        const output = renderClashFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            fileName: 'FallbackTemplateClash',
        });
        const parsed = yaml.load(output);

        expect(parsed.dns.nameserver).toEqual(DOMESTIC_UDP);
        expect(parsed.dns.fallback).toEqual(FOREIGN_UDP);
        expect(parsed.dns['nameserver-policy']).not.toHaveProperty('geosite:geolocation-!cn');
        expect((parsed['proxy-groups'] || []).some((group) => group.name === DNS_PROXY_GROUP)).toBe(
            true
        );
    });

    it('template singbox (foreign): geolocation rule-set present, final domestic', () => {
        const output = renderSingboxFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            fileName: 'FallbackTemplateSingbox',
        });
        const config = JSON.parse(output);

        expect(config.dns.final).toBe('dns-cn-1');
        expect(
            (config.route.rule_set || []).some(
                (ruleSet) => ruleSet.tag === SINGBOX_FOREIGN_RULE_SET
            )
        ).toBe(true);
    });

    it('template singbox (domestic): geolocation rule-set not injected', () => {
        const output = renderSingboxFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            dnsMode: 'domestic-clean',
            fileName: 'FallbackTemplateSingboxDomestic',
        });
        const config = JSON.parse(output);

        expect(
            (config.route.rule_set || []).some(
                (ruleSet) => ruleSet.tag === SINGBOX_FOREIGN_RULE_SET
            )
        ).toBe(false);
    });
});
