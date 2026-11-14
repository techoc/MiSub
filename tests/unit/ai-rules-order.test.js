import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.ts';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.ts';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.ts';

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

// 作者自带一条 OpenAI 精确规则，注入的 AI 规则不得越过它
const TEMPLATE_WITH_AUTHOR_AI_RULE = `
[Proxy Group]
节点选择 = select, 香港 01, 日本 01, DIRECT

[Rule]
DOMAIN-SUFFIX,openai.com,节点选择
DOMAIN-SUFFIX,example.com,节点选择
MATCH,节点选择
`;

function buildModel(template = TEMPLATE) {
    return parseIniTemplate(template, {
        proxies,
        ruleLevel: 'std',
    });
}

describe('Injected AI rules stay reachable before the final MATCH rule', () => {
    it('model: AI rules are inserted before the MATCH rule', () => {
        const model = applySmartModelOptimizations(buildModel());

        const matchIndex = model.rules.findIndex(
            (rule) => String(rule.type || '').toLowerCase() === 'match'
        );
        const aiIndex = model.rules.findIndex((rule) => String(rule.policy).startsWith('🤖'));
        expect(matchIndex).toBeGreaterThan(-1);
        expect(aiIndex).toBeGreaterThan(-1);
        expect(aiIndex).toBeLessThan(matchIndex);
    });

    it('model: author rules keep priority over injected AI rules', () => {
        const model = applySmartModelOptimizations(buildModel(TEMPLATE_WITH_AUTHOR_AI_RULE));

        const authorRuleIndex = model.rules.findIndex(
            (rule) => rule.value === 'openai.com' && rule.policy === '节点选择'
        );
        const aiRuleIndex = model.rules.findIndex(
            (rule) => rule.value === 'openai.com' && String(rule.policy).startsWith('🤖')
        );
        expect(authorRuleIndex).toBeGreaterThan(-1);
        expect(aiRuleIndex).toBeGreaterThan(-1);
        expect(authorRuleIndex).toBeLessThan(aiRuleIndex);
    });

    it('clash output: AI rules come before the MATCH catch-all', () => {
        const config = yaml.load(
            renderClashFromIniTemplate(TEMPLATE, { proxies, ruleLevel: 'std' })
        );

        const rules = (config.rules || []).map((rule) => String(rule));
        const matchIndex = rules.findIndex((rule) => rule.startsWith('MATCH,'));
        const aiIndex = rules.findIndex((rule) => /,🤖 /.test(rule));
        expect(matchIndex).toBeGreaterThan(-1);
        expect(aiIndex).toBeGreaterThan(-1);
        expect(aiIndex).toBeLessThan(matchIndex);
    });

    it('sing-box output: AI rules come before the outbound-only catch-all', () => {
        const config = JSON.parse(
            renderSingboxFromIniTemplate(TEMPLATE, { proxies, ruleLevel: 'std' })
        );

        const rules = config.route?.rules || [];
        const catchAllIndex = rules.findIndex(
            (rule) => Object.keys(rule).length === 1 && 'outbound' in rule
        );
        const aiIndex = rules.findIndex((rule) => String(rule.outbound || '').startsWith('🤖'));
        expect(catchAllIndex).toBeGreaterThan(-1);
        expect(aiIndex).toBeGreaterThan(-1);
        expect(aiIndex).toBeLessThan(catchAllIndex);
    });
});
