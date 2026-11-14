import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.ts';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.ts';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.ts';
import { resolveInjectionToggle } from '../../functions/modules/subscription/main-handler/engine-flags.ts';
import { DNS_PROXY_GROUP } from '../../functions/modules/subscription/safe-dns.ts';

const proxies = [
    {
        name: '香港 01',
        type: 'ss',
        server: 'hk.example.com',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'x',
    },
    {
        name: '日本 01',
        type: 'ss',
        server: 'jp.example.com',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'x',
    },
];

const TEMPLATE = `
[Proxy Group]
节点选择 = select, 香港 01, 日本 01, DIRECT

[Rule]
DOMAIN-SUFFIX,example.com,节点选择
GEOIP,CN,DIRECT
MATCH,节点选择
`;

function buildModel() {
    return parseIniTemplate(TEMPLATE, {
        proxies,
        ruleLevel: 'std',
    });
}

describe('Template injection switches (applySmartModelOptimizations)', () => {
    it('keeps injecting both DNS exit group and AI policy by default', () => {
        const model = applySmartModelOptimizations(buildModel());

        expect(model.groups.some((group) => group.name === DNS_PROXY_GROUP)).toBe(true);
        expect(model.groups.some((group) => group.name === '🤖 AI 自动')).toBe(true);
        expect(model.rules.some((rule) => String(rule.policy).startsWith('🤖'))).toBe(true);
    });

    it('skips AI policy injection when injectAiPolicy is false but keeps DNS exit group', () => {
        const model = applySmartModelOptimizations(buildModel(), { injectAiPolicy: false });

        expect(model.groups.filter((group) => String(group.name).includes('🤖'))).toHaveLength(0);
        expect(model.rules.filter((rule) => String(rule.policy).startsWith('🤖'))).toHaveLength(0);
        expect(model.groups.some((group) => group.name === DNS_PROXY_GROUP)).toBe(true);
    });

    it('skips DNS exit group injection when injectDnsExitGroup is false but keeps AI policy', () => {
        const model = applySmartModelOptimizations(buildModel(), {
            injectDnsExitGroup: false,
        });

        expect(model.groups.some((group) => group.name === DNS_PROXY_GROUP)).toBe(false);
        expect(model.groups.some((group) => group.name === '🤖 AI 自动')).toBe(true);
    });

    it('skips both injections when both switches are off', () => {
        const model = applySmartModelOptimizations(buildModel(), {
            injectAiPolicy: false,
            injectDnsExitGroup: false,
        });

        expect(model.groups.some((group) => group.name === DNS_PROXY_GROUP)).toBe(false);
        expect(model.groups.filter((group) => String(group.name).includes('🤖'))).toHaveLength(0);
    });
});

describe('Clash template renderer honors injection switches', () => {
    it('produces a valid config without DNS exit references when both switches are off', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
                injectAiPolicy: false,
                injectDnsExitGroup: false,
            })
        );

        const groupNames = (config['proxy-groups'] || []).map((group) => group.name);
        expect(groupNames).not.toContain(DNS_PROXY_GROUP);
        expect(groupNames.every((name) => !String(name).includes('🤖'))).toBe(true);
        expect((config.rules || []).every((rule) => !String(rule).includes('🤖'))).toBe(true);

        const nameservers = [
            ...(config.dns?.nameserver || []),
            ...Object.values(config.dns?.['nameserver-policy'] || {}).flat(),
            ...(config.dns?.fallback || []),
        ];
        expect(nameservers.length).toBeGreaterThan(0);
        expect(nameservers.every((ns) => !String(ns).includes(`#${DNS_PROXY_GROUP}`))).toBe(true);
        // 降级为直连解析：境外 DNS 带 #DIRECT（mihomo 合法内置策略），国内 DNS 不带注记
        expect(nameservers.some((ns) => String(ns).includes('#DIRECT'))).toBe(true);
        expect(
            nameservers.every((ns) => {
                const annotation = String(ns).split('#')[1];
                return !annotation || annotation === 'DIRECT';
            })
        ).toBe(true);
    });

    it('keeps DNS exit detour and AI injection by default', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
            })
        );

        expect(config['proxy-groups'].some((group) => group.name === DNS_PROXY_GROUP)).toBe(true);
        expect(
            (config.dns.fallback || []).some((ns) => String(ns).includes(`#${DNS_PROXY_GROUP}`))
        ).toBe(true);
        expect(config['proxy-groups'].some((group) => String(group.name).includes('🤖'))).toBe(
            true
        );
    });
});

describe('Sing-box template renderer honors injection switches', () => {
    it('downgrades DNS/rule-set detour to DIRECT when injectDnsExitGroup is off', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
                injectAiPolicy: false,
                injectDnsExitGroup: false,
            })
        );

        const outboundTags = config.outbounds.map((outbound) => outbound.tag);
        expect(outboundTags).not.toContain(DNS_PROXY_GROUP);
        expect(outboundTags.every((tag) => !String(tag).includes('🤖'))).toBe(true);

        const ruleSets = config.route?.rule_set || [];
        expect(ruleSets.length).toBeGreaterThan(0);
        expect(ruleSets.every((ruleSet) => ruleSet.download_detour === 'DIRECT')).toBe(true);

        const foreignServers = (config.dns?.servers || []).filter((server) =>
            String(server.tag).startsWith('dns-foreign')
        );
        expect(foreignServers.length).toBeGreaterThan(0);
        expect(foreignServers.every((server) => server.detour === 'DIRECT')).toBe(true);
    });

    it('keeps DNS exit group detour by default', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
            })
        );

        const ruleSets = config.route?.rule_set || [];
        expect(ruleSets.length).toBeGreaterThan(0);
        expect(ruleSets.every((ruleSet) => ruleSet.download_detour === DNS_PROXY_GROUP)).toBe(true);
        expect(
            (config.dns.servers || [])
                .filter((server) => String(server.tag).startsWith('dns-foreign'))
                .every((server) => server.detour === DNS_PROXY_GROUP)
        ).toBe(true);
    });
});

describe('resolveInjectionToggle', () => {
    it('URL parameter overrides config value', () => {
        const params = new URLSearchParams('dns-inject=false');
        expect(resolveInjectionToggle(params, ['dns-inject', 'dnsInject'], true)).toBe(false);
    });

    it('supports camelCase parameter alias', () => {
        const params = new URLSearchParams('aiInject=0');
        expect(resolveInjectionToggle(params, ['ai-inject', 'aiInject'], true)).toBe(false);
    });

    it('falls back to config value when no parameter present', () => {
        expect(resolveInjectionToggle(new URLSearchParams(''), ['ai-inject'], false)).toBe(false);
    });

    it('defaults to true when neither parameter nor config value is set', () => {
        expect(resolveInjectionToggle(new URLSearchParams(''), ['ai-inject'], undefined)).toBe(
            true
        );
    });

    it('ignores unparseable parameter values and uses config value', () => {
        const params = new URLSearchParams('ai-inject=maybe');
        expect(resolveInjectionToggle(params, ['ai-inject'], false)).toBe(false);
    });
});
