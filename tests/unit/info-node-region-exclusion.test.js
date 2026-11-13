import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.js';
import { renderClashFromIniTemplate } from '../../functions/modules/subscription/template-pipeline.js';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.js';
import { POLICY_GROUPS } from '../../functions/modules/subscription/builtin-rules-provider.js';

// 面板套餐信息占位节点(trojan://127.0.0.1),OpenClash 启动前会剔除它们
const infoProxies = [
    {
        name: '🌍 流量剩余 ≫ 2.22 TB',
        type: 'trojan',
        server: '127.0.0.1',
        port: 443,
        password: '00000000-0000-0000-0000-000000000000',
    },
    {
        name: '🌍 到期时间 ≫ 2027-08-04',
        type: 'trojan',
        server: '127.0.0.1',
        port: 443,
        password: '00000000-0000-0000-0000-000000000000',
    },
];

const realUnmatchedProxy = {
    name: '🇻🇳 VNM-Proxy 01',
    type: 'ss',
    server: 'vn.example.com',
    port: 443,
    cipher: 'aes-128-gcm',
    password: 'x',
};

const TEMPLATE = `
[Proxy Group]
节点选择 = select, VNM-Proxy 01, DIRECT

[Rule]
DOMAIN-SUFFIX,example.com,节点选择
MATCH,节点选择
`;

describe('Placeholder info nodes are excluded from region bucketing (template path)', () => {
    it('does not inject 其他节点 when only placeholder info nodes are unmatched', () => {
        const model = parseIniTemplate(TEMPLATE, { proxies: infoProxies, ruleLevel: 'std' });
        const optimized = applySmartModelOptimizations(model);

        expect(optimized.groups.some((group) => group.name === '🌍 其他节点')).toBe(false);
    });

    it('mixed nodes: region group contains only real nodes, never placeholders', () => {
        const model = parseIniTemplate(TEMPLATE, {
            proxies: [...infoProxies, realUnmatchedProxy],
            ruleLevel: 'std',
        });
        const optimized = applySmartModelOptimizations(model);

        const otherGroup = optimized.groups.find((group) => group.name === '🌍 其他节点');
        expect(otherGroup).toBeDefined();
        expect(otherGroup.members).toEqual(['🇻🇳 VNM-Proxy 01', 'REJECT', 'DIRECT']);
        expect(otherGroup.members.some((member) => member.includes('流量剩余'))).toBe(false);
    });

    it('clash render with info-only nodes emits no 其他节点 group', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE, {
                proxies: infoProxies,
                ruleLevel: 'std',
                injectAiPolicy: true,
                injectDnsExitGroup: true,
            })
        );

        const groups = config['proxy-groups'] || [];
        expect(groups.some((group) => group.name === '🌍 其他节点')).toBe(false);
        groups.forEach((group) => {
            expect((group.proxies || []).length).toBeGreaterThan(0);
        });
    });
});

describe('Placeholder info nodes are excluded from region bucketing (builtin path)', () => {
    it('FULL policy groups do not create region groups from placeholder info nodes', () => {
        const groups = POLICY_GROUPS.FULL(infoProxies, {});
        const names = groups.map((group) => group.name);

        expect(names.some((name) => name === '🌍 其他节点')).toBe(false);
        expect(names.some((name) => name.startsWith('⚡️ 其他'))).toBe(false);
    });
});
