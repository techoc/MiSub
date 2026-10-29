import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { resolveGeneratorOptions } from '../../functions/modules/subscription/generator-options.js';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinLoonConfig } from '../../functions/modules/subscription/builtin-loon-generator.js';
import { generateBuiltinQuanxConfig } from '../../functions/modules/subscription/builtin-quanx-generator.js';
import { generateBuiltinSurgeConfig } from '../../functions/modules/subscription/builtin-surge-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';
import { generateBuiltinEgernConfig } from '../../functions/modules/subscription/builtin-egern-generator.js';
import { renderClashYamlProfileTemplate } from '../../functions/services/processor-service.js';
import { migrateConfigSettings } from '../../functions/modules/utils.js';
import {
    renderClashFromIniTemplate,
    renderEgernFromIniTemplate,
    renderLoonFromIniTemplate,
    renderQuanxFromIniTemplate,
    renderSingboxFromIniTemplate,
    renderSurgeFromIniTemplate,
} from '../../functions/modules/subscription/template-pipeline.js';

const NODE_LIST = [
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@hk.example.com:443#%F0%9F%87%AD%F0%9F%87%B0%20%E9%A6%99%E6%B8%AF%2001',
    'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206ZXhhbXBsZVBhc3N3b3JkMTIz@us.example.com:443#%F0%9F%87%BA%F0%9F%87%B8%20%E7%BE%8E%E5%9B%BD%2001',
].join('\n');

const CUSTOM_INI_TEMPLATE = [
    '[rule]',
    'FINAL,🚀 节点选择',
    '',
    '[custom]',
    'custom_proxy_group=🚀 节点选择`select`.*',
].join('\n');

const ENABLED_OPTIONS = {
    generatorOptions: {
        ipv6: true,
        allowLan: true,
        dns: {
            enable: true,
            ipv6: true,
            useHosts: false,
            useSystemHosts: false,
            respectRules: false,
        },
        singbox: {
            tunAutoRoute: false,
            tunStrictRoute: false,
        },
    },
};

describe('generator options', () => {
    it('normalizes defaults and supports URL overrides', () => {
        const options = resolveGeneratorOptions(
            { ipv6: false },
            new URLSearchParams(
                'ipv6=1&allow-lan=true&dns-ipv6=true&dns-use-hosts=false&tun-strict-route=false'
            )
        );

        expect(options).toMatchObject({
            ipv6: true,
            allowLan: true,
            dns: {
                ipv6: true,
                useHosts: false,
            },
            singbox: {
                tunStrictRoute: false,
            },
        });
    });

    it('migrates legacy string values and fills missing option groups', () => {
        const config = migrateConfigSettings({
            builtinEnableTfo: 'true',
            generatorOptions: {
                ipv6: 'true',
                dns: { useHosts: 'false' },
            },
        });

        expect(config.builtinEnableTfo).toBe(true);
        expect(config.generatorOptions).toMatchObject({
            ipv6: true,
            allowLan: false,
            dns: {
                enable: true,
                ipv6: false,
                useHosts: false,
                useSystemHosts: true,
                respectRules: true,
            },
            singbox: {
                tunAutoRoute: true,
                tunStrictRoute: true,
            },
        });
    });

    it('applies switches to every built-in client generator', () => {
        const clash = yaml.load(generateBuiltinClashConfig(NODE_LIST, ENABLED_OPTIONS));
        const loon = generateBuiltinLoonConfig(NODE_LIST, ENABLED_OPTIONS);
        const quanx = generateBuiltinQuanxConfig(NODE_LIST, ENABLED_OPTIONS);
        const surge = generateBuiltinSurgeConfig(NODE_LIST, ENABLED_OPTIONS);
        const singbox = JSON.parse(generateBuiltinSingboxConfig(NODE_LIST, ENABLED_OPTIONS));
        const egern = yaml.load(generateBuiltinEgernConfig(NODE_LIST, ENABLED_OPTIONS));

        expect(clash).toMatchObject({
            ipv6: true,
            'allow-lan': true,
            'bind-address': '0.0.0.0',
            dns: {
                enable: true,
                ipv6: true,
                'use-hosts': false,
                'use-system-hosts': false,
                'respect-rules': false,
            },
        });
        expect(loon).toContain('ipv6 = true');
        expect(quanx).not.toContain('no-ipv6');
        expect(surge).toContain('ipv6 = true');
        expect(surge).toContain('ipv6-vif = auto');
        expect(singbox.dns.strategy).toBe('prefer_ipv4');
        expect(singbox.inbounds[0]).toMatchObject({
            auto_route: false,
            strict_route: false,
        });
        expect(singbox.inbounds[0].address).toContain('fdfe:dcba:9876::1/126');
        expect(singbox.route.rules.some((rule) => rule.ip_cidr?.includes('fc00::/7'))).toBe(true);
        expect(egern.general.ipv6).toBe(true);
    });

    it('applies switches to every INI template renderer', () => {
        const renderOptions = {
            ...ENABLED_OPTIONS,
            nodeList: NODE_LIST,
            ruleLevel: 'std',
        };
        const clash = yaml.load(renderClashFromIniTemplate(CUSTOM_INI_TEMPLATE, renderOptions));
        const loon = renderLoonFromIniTemplate(CUSTOM_INI_TEMPLATE, renderOptions);
        const quanx = renderQuanxFromIniTemplate(CUSTOM_INI_TEMPLATE, renderOptions);
        const surge = renderSurgeFromIniTemplate(CUSTOM_INI_TEMPLATE, renderOptions);
        const singbox = JSON.parse(
            renderSingboxFromIniTemplate(CUSTOM_INI_TEMPLATE, renderOptions)
        );
        const egern = yaml.load(renderEgernFromIniTemplate(CUSTOM_INI_TEMPLATE, renderOptions));

        expect(clash.ipv6).toBe(true);
        expect(clash.dns.ipv6).toBe(true);
        expect(loon).toContain('ipv6 = true');
        expect(loon).toContain('ip-mode = ipv6-preferred');
        expect(quanx).not.toContain('no-ipv6');
        expect(surge).toContain('ipv6 = true');
        expect(singbox.inbounds[0].address).toContain('fdfe:dcba:9876::1/126');
        expect(egern.general.ipv6).toBe(true);
    });

    it('applies switches to Clash YAML profile templates', () => {
        const template = [
            'proxy-groups:',
            '  - name: 🚀 节点选择',
            '    type: select',
            '    proxies: []',
            'rules:',
            '  - MATCH,🚀 节点选择',
        ].join('\n');
        const clash = yaml.load(
            renderClashYamlProfileTemplate(template, NODE_LIST, ENABLED_OPTIONS)
        );

        expect(clash.ipv6).toBe(true);
        expect(clash['allow-lan']).toBe(true);
        expect(clash['bind-address']).toBe('0.0.0.0');
        expect(clash.dns.ipv6).toBe(true);
    });

    it('keeps an explicit custom DNS block ahead of DNS switches', () => {
        const clash = yaml.load(
            generateBuiltinClashConfig(NODE_LIST, {
                ...ENABLED_OPTIONS,
                generatorOptions: {
                    ...ENABLED_OPTIONS.generatorOptions,
                    dns: {
                        ...ENABLED_OPTIONS.generatorOptions.dns,
                        ipv6: false,
                    },
                },
                customDnsOverride:
                    'dns:\n  enable: true\n  ipv6: true\n  nameserver:\n    - 1.1.1.1\n',
            })
        );

        expect(clash.ipv6).toBe(true);
        expect(clash.dns.ipv6).toBe(true);
        expect(clash.dns.nameserver).toEqual(['1.1.1.1']);
    });
});
