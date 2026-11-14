import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.ts';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.ts';
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

// 仅提供解析器列表的 policy 型覆盖：Safe DNS 结构保留，境外解析仍会带 #DNS 出口 注记
const POLICY_INPUT_OVERRIDE = `nameserver:
    - 8.8.8.8
    - 1.1.1.1
`;

// 整块替换 Safe DNS 的 explicit dns block
const EXPLICIT_BLOCK_OVERRIDE = `dns:
    enable: true
    enhanced-mode: fake-ip
    nameserver:
        - 8.8.8.8
    nameserver-policy:
        geosite:cn:
            - 223.5.5.5
`;

const BUILTIN_POLICIES = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']);

function collectClashDnsReferences(config) {
    const dns = config.dns || {};
    const entries = [
        ...(dns.nameserver || []),
        ...Object.values(dns['nameserver-policy'] || {}).flat(),
        ...(dns.fallback || []),
        ...(dns['proxy-server-nameserver'] || []),
        ...(dns['direct-nameserver'] || []),
        ...(dns['default-nameserver'] || []),
    ];
    return entries.map((value) => String(value).split('#')[1]).filter(Boolean);
}

function expectValidReferences(references, validNames) {
    for (const reference of references) {
        expect(validNames.has(reference) || BUILTIN_POLICIES.has(reference)).toBe(true);
    }
}

describe('Custom DNS override keeps rendered configs valid (template path)', () => {
    it('clash: policy-input override keeps the DNS exit group it references', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
                customDnsOverride: POLICY_INPUT_OVERRIDE,
            })
        );

        const groupNames = new Set((config['proxy-groups'] || []).map((group) => group.name));
        expect(groupNames).toContain(DNS_PROXY_GROUP);
        expectValidReferences(collectClashDnsReferences(config), groupNames);
    });

    it('clash: explicit dns block fully replaces Safe DNS without group references', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
                customDnsOverride: EXPLICIT_BLOCK_OVERRIDE,
            })
        );

        const groupNames = new Set((config['proxy-groups'] || []).map((group) => group.name));
        expect(groupNames).not.toContain(DNS_PROXY_GROUP);
        expect(collectClashDnsReferences(config)).toHaveLength(0);
        expect(config.dns.nameserver).toEqual(['8.8.8.8']);
    });

    it('sing-box: policy-input override keeps the DNS exit group it references', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
                customDnsOverride: POLICY_INPUT_OVERRIDE,
            })
        );

        const tags = new Set(config.outbounds.map((outbound) => outbound.tag));
        expect(tags.has(DNS_PROXY_GROUP)).toBe(true);

        const detours = [
            ...(config.dns?.servers || []).map((server) => server.detour),
            ...(config.route?.rule_set || []).map((ruleSet) => ruleSet.download_detour),
        ].filter(Boolean);
        expect(detours.length).toBeGreaterThan(0);
        expectValidReferences(detours, tags);
    });

    it('sing-box: explicit dns block leaves no dangling group detours', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(TEMPLATE, {
                proxies,
                ruleLevel: 'std',
                customDnsOverride: EXPLICIT_BLOCK_OVERRIDE,
            })
        );

        const tags = new Set(config.outbounds.map((outbound) => outbound.tag));
        expect(tags.has(DNS_PROXY_GROUP)).toBe(false);

        const detours = [
            ...(config.dns?.servers || []).map((server) => server.detour),
            ...(config.route?.rule_set || []).map((ruleSet) => ruleSet.download_detour),
        ].filter(Boolean);
        expectValidReferences(detours, tags);
    });
});

describe('Custom DNS override keeps rendered configs valid (builtin path)', () => {
    it('clash: policy-input override keeps the DNS exit group it references', () => {
        const config = yaml.load(
            generateBuiltinClashConfig('trojan://pass@hk.example.com:443#HK01', {
                customDnsOverride: POLICY_INPUT_OVERRIDE,
            })
        );

        const groupNames = new Set((config['proxy-groups'] || []).map((group) => group.name));
        expect(groupNames).toContain(DNS_PROXY_GROUP);
        expectValidReferences(collectClashDnsReferences(config), groupNames);
    });

    it('clash: explicit dns block without group mention drops the unused group', () => {
        const config = yaml.load(
            generateBuiltinClashConfig('trojan://pass@hk.example.com:443#HK01', {
                customDnsOverride: EXPLICIT_BLOCK_OVERRIDE,
            })
        );

        const groupNames = new Set((config['proxy-groups'] || []).map((group) => group.name));
        expect(groupNames).not.toContain(DNS_PROXY_GROUP);
        expect(collectClashDnsReferences(config)).toHaveLength(0);
    });
});
