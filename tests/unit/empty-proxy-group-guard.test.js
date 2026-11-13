import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';
import { DNS_PROXY_GROUP } from '../../functions/modules/subscription/safe-dns.js';

const proxies = [
    {
        name: 'HK-01',
        type: 'ss',
        server: 'hk.example.com',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'x',
    },
];

// 空成员(filter 无匹配)组 + 仅 REJECT 成员的 url-test 组(fail-closed 形态)
const TEMPLATE_WITH_DEGENERATE_GROUPS = `
custom_proxy_group=🚀 节点选择\`select\`[]HK-01
custom_proxy_group=🌍 其他节点\`url-test\`(^(?!HK).*)\`https://www.gstatic.com/generate_204\`300,,50
custom_proxy_group=🗑️ 废弃组\`url-test\`[]REJECT

[Rule]
DOMAIN-SUFFIX,example.com,🗑️ 废弃组
DOMAIN-SUFFIX,test.com,🚀 节点选择
MATCH,🚀 节点选择
`;

const CLASH_BUILTIN_POLICIES = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'GLOBAL']);

function expectNoEmptyClashGroups(config) {
    const groups = config['proxy-groups'] || [];
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach((group) => {
        expect(
            (group.proxies || []).length,
            `group ${group.name} rendered with no proxies/use`
        ).toBeGreaterThan(0);
    });
    return groups;
}

describe('Renderer never emits proxy groups without members (clash)', () => {
    it('zero-proxy pipeline render keeps stub groups with REJECT fallbacks', () => {
        const template = getBuiltinTemplate('clash_aethersailor_full').content;
        const config = yaml.load(
            renderClashFromIniTemplate(template, {
                proxies: [],
                ruleLevel: 'std',
                injectAiPolicy: true,
                injectDnsExitGroup: true,
            })
        );

        const groups = expectNoEmptyClashGroups(config);
        const groupNames = new Set(groups.map((group) => group.name));

        // 纯 REJECT/DIRECT 存根组不再被剥离/丢弃（自动测速组只补 REJECT，不补 DIRECT）
        expect(groupNames.has(DNS_PROXY_GROUP)).toBe(true);
        const dnsGroup = groups.find((group) => group.name === DNS_PROXY_GROUP);
        expect(dnsGroup.proxies).toEqual(['REJECT']);

        // DNS 出口引用真实存在的组，不降级 #DIRECT
        const referenced = [
            ...(config.dns?.nameserver || []),
            ...Object.values(config.dns?.['nameserver-policy'] || {}).flat(),
            ...(config.dns?.fallback || []),
        ]
            .map((value) => String(value).split('#')[1])
            .filter(Boolean);
        referenced.forEach((reference) => {
            expect(groupNames.has(reference) || CLASH_BUILTIN_POLICIES.has(reference)).toBe(true);
        });
        expect(referenced).toContain(DNS_PROXY_GROUP);
        expect(referenced).not.toContain('DIRECT');

        // 规则的策略必须是真实存在的组/节点/内置策略
        // （策略是第 3 段起第一个命中项——GEOIP 类规则末尾会带 no-resolve 等 extras）
        const proxyNames = new Set((config.proxies || []).map((proxy) => proxy.name));
        (config.rules || []).forEach((rule) => {
            const segments = String(rule).split(',');
            const policy =
                segments
                    .slice(2)
                    .find(
                        (segment) =>
                            groupNames.has(segment) ||
                            proxyNames.has(segment) ||
                            CLASH_BUILTIN_POLICIES.has(segment)
                    ) || segments[1];
            expect(
                groupNames.has(policy) ||
                    proxyNames.has(policy) ||
                    CLASH_BUILTIN_POLICIES.has(policy)
            ).toBe(true);
        });
    });

    it('filter-empty and REJECT-only url-test groups are kept with REJECT fallbacks, rules stay valid', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE_WITH_DEGENERATE_GROUPS, {
                proxies,
                ruleLevel: 'std',
            })
        );

        const groups = expectNoEmptyClashGroups(config);
        const groupNames = groups.map((group) => group.name);
        expect(groupNames).toContain('🚀 节点选择');
        // 纯 REJECT 存根组不再被丢弃，统一补 REJECT 兜底（自动测速组不补 DIRECT）
        expect(groupNames).toContain('🗑️ 废弃组');
        expect(groups.find((group) => group.name === '🗑️ 废弃组').proxies).toEqual(['REJECT']);
        // filter 无匹配的组同样保留兜底成员
        expect(groupNames).toContain('🌍 其他节点');
        expect(groups.find((group) => group.name === '🌍 其他节点').proxies).toEqual(['REJECT']);

        const validPolicies = new Set([
            ...groupNames,
            ...(config.proxies || []).map((proxy) => proxy.name),
            ...CLASH_BUILTIN_POLICIES,
        ]);
        (config.rules || []).forEach((rule) => {
            const policy = String(rule).split(',').pop();
            expect(
                validPolicies.has(policy),
                `rule ${rule} references missing policy ${policy}`
            ).toBe(true);
        });
    });
});

describe('Renderer never emits proxy groups without members (sing-box)', () => {
    it('zero-proxy pipeline render keeps stub groups with REJECT fallbacks', () => {
        const template = getBuiltinTemplate('clash_aethersailor_full').content;
        const config = JSON.parse(
            renderSingboxFromIniTemplate(template, {
                proxies: [],
                ruleLevel: 'std',
                injectAiPolicy: true,
                injectDnsExitGroup: true,
            })
        );

        const outbounds = config.outbounds || [];
        outbounds.forEach((outbound) => {
            if (['urltest', 'selector'].includes(outbound.type)) {
                expect(
                    (outbound.outbounds || []).length,
                    `outbound ${outbound.tag} rendered with no members`
                ).toBeGreaterThan(0);
            }
        });

        const tags = new Set(outbounds.map((outbound) => outbound.tag));
        // DNS 出口存根组保留（fail-closed，自动测速组只补 REJECT）
        expect(tags.has(DNS_PROXY_GROUP)).toBe(true);
        const dnsOutbound = outbounds.find((outbound) => outbound.tag === DNS_PROXY_GROUP);
        expect(dnsOutbound.outbounds).toEqual(['REJECT']);

        // detour/download_detour 引用真实存在的组，不降级 DIRECT
        const detours = [
            ...(config.dns?.servers || []).map((server) => server.detour),
            ...(config.route?.rule_set || []).map((ruleSet) => ruleSet.download_detour),
        ].filter(Boolean);
        detours.forEach((detour) => {
            expect(tags.has(detour) || CLASH_BUILTIN_POLICIES.has(detour)).toBe(true);
        });
        expect(detours).toContain(DNS_PROXY_GROUP);

        // route.rules 的 outbound 必须存在;final 不能指向被丢弃的组
        (config.route?.rules || []).forEach((rule) => {
            expect(tags.has(rule.outbound) || CLASH_BUILTIN_POLICIES.has(rule.outbound)).toBe(true);
        });
        expect(
            tags.has(config.route?.final) || CLASH_BUILTIN_POLICIES.has(config.route?.final)
        ).toBe(true);
    });
});
