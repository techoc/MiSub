import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import { DNS_PROXY_GROUP } from '../../functions/modules/subscription/safe-dns.js';

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

describe('DNS exit group fail-closed behavior across renderers', () => {
    it('template clash: zero nodes keeps the DNS exit group as a REJECT stub (never dropped, never #DIRECT)', () => {
        const output = renderClashFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            fileName: 'ZeroNodesClash',
        });
        const parsed = yaml.load(output);

        const dnsGroup = (parsed['proxy-groups'] || []).find((g) => g.name === DNS_PROXY_GROUP);
        expect(dnsGroup, '零节点时 🌐 DNS 出口 组不应被整组丢弃').toBeTruthy();
        expect(dnsGroup.proxies).toEqual(['REJECT']);

        const fallback = parsed.dns?.fallback || [];
        expect(fallback.length).toBeGreaterThan(0);
        for (const entry of fallback) {
            expect(entry.endsWith(`#${DNS_PROXY_GROUP}`)).toBe(true);
        }
    });

    it('template singbox: zero nodes keeps the DNS exit outbound as a REJECT stub', () => {
        const output = renderSingboxFromIniTemplate(minimalIniTemplate, {
            nodeList: '',
            ruleLevel: 'none',
            fileName: 'ZeroNodesSingbox',
        });
        const config = JSON.parse(output);

        const dnsOutbound = (config.outbounds || []).find((o) => o.tag === DNS_PROXY_GROUP);
        expect(dnsOutbound, '零节点时 🌐 DNS 出口 出站不应被整组丢弃').toBeTruthy();
        expect(dnsOutbound.outbounds).toEqual(['REJECT']);

        const foreignServer = (config.dns?.servers || []).find((s) =>
            String(s.tag || '').startsWith('dns-foreign')
        );
        expect(foreignServer).toBeTruthy();
        expect(foreignServer.detour).toBe(DNS_PROXY_GROUP);
    });

    it('builtin clash: zero nodes intentionally returns the empty stub (no dangling groups/dns)', () => {
        const output = generateBuiltinClashConfig('', {
            ruleLevel: 'std',
            fileName: 'ZeroBuiltinClash',
        });
        expect(output).toBe('# No valid proxies found\nproxies: []\n');
    });

    it('builtin singbox: zero nodes keeps the DNS exit group fail-closed with universal fallbacks', () => {
        const output = generateBuiltinSingboxConfig('', {
            ruleLevel: 'std',
            fileName: 'ZeroBuiltinSb',
        });
        const config = JSON.parse(output);

        const dnsOutbound = (config.outbounds || []).find((o) => o.tag === DNS_PROXY_GROUP);
        expect(dnsOutbound).toBeTruthy();
        expect(dnsOutbound.outbounds).toEqual(['REJECT']);

        const foreignServer = (config.dns?.servers || []).find((s) =>
            String(s.tag || '').startsWith('dns-foreign')
        );
        expect(foreignServer).toBeTruthy();
        expect(foreignServer.detour).toBe(DNS_PROXY_GROUP);
    });

    it('template clash: with nodes the DNS exit group carries real members plus REJECT/DIRECT fallbacks', () => {
        const output = renderClashFromIniTemplate(minimalIniTemplate, {
            nodeList: sampleNodeList,
            ruleLevel: 'none',
            fileName: 'WithNodesClash',
        });
        const parsed = yaml.load(output);

        const dnsGroup = (parsed['proxy-groups'] || []).find((g) => g.name === DNS_PROXY_GROUP);
        expect(dnsGroup).toBeTruthy();
        expect(dnsGroup.proxies.length).toBeGreaterThan(1);
        expect(dnsGroup.proxies.slice(-1)).toEqual(['REJECT']);
        expect(dnsGroup.proxies.slice(0, -1)).not.toContain('REJECT');
        expect(dnsGroup.proxies.slice(0, -1)).not.toContain('DIRECT');
    });
});
