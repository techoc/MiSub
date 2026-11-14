import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.ts';
import { renderClashFromTemplateModel } from '../../functions/modules/subscription/template-renderers/render-clash.ts';
import { applySmartModelOptimizations } from '../../functions/modules/subscription/template-processor.ts';
import { getBuiltinTemplate } from '../../functions/modules/subscription/builtin-template-registry.ts';
import { TRANSFORM_ASSETS } from '../../src/constants/transform-assets.js';
import { PINNED_RULE_REVISIONS } from '../../functions/modules/subscription/builtin-rules-provider.ts';

/**
 * Aethersailor/Custom_OpenClash_Rules 模板兼容性回归（upstream issue #332）。
 *
 * 该模板系列基于 GEOSITE/mihomo，ruleset 行大量使用：
 * - `clash-domain:` / `clash-ipcidr:` 协议前缀；
 * - 行尾更新间隔参数（如 `,1800` / `,28800`）；
 * - `[]GEOIP,<region>,no-resolve` 内联规则。
 */

const AETHERSAILOR_RAW =
    'https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/rule';

describe('Aethersailor ini 模板解析兼容（issue #332）', () => {
    it('剥除 clash-domain:/clash-ipcidr: 前缀，并把行尾更新间隔与 URL 分离', () => {
        const model = parseIniTemplate(
            [
                '[custom]',
                `ruleset=🎯 全球直连,clash-domain:${AETHERSAILOR_RAW}/Custom_Direct_Domain.mrs,1800`,
                `ruleset=🔀 非标端口,clash-ipcidr:${AETHERSAILOR_RAW}/Custom_Port_Direct.yaml,28800`,
                'ruleset=🎯 全球直连,[]GEOIP,private,no-resolve',
            ].join('\n')
        );

        const remoteRules = model.rules.filter((rule) => rule.source === 'remote');
        expect(remoteRules).toHaveLength(2);

        // 前缀被剥除，URL 被固定到 PINNED_RULE_REVISIONS 并镜像为 jsDelivr
        expect(remoteRules[0].value).toBe(
            `https://cdn.jsdelivr.net/gh/Aethersailor/Custom_OpenClash_Rules@${PINNED_RULE_REVISIONS.AETHERSAILOR}/rule/Custom_Direct_Domain.mrs`
        );
        // 行尾间隔不能拼进 URL（否则下载 404），并应保留为 provider 更新间隔
        expect(remoteRules[0].value).not.toContain(',1800');
        expect(remoteRules[0].interval).toBe(1800);
        expect(remoteRules[1].value).toBe(
            `https://cdn.jsdelivr.net/gh/Aethersailor/Custom_OpenClash_Rules@${PINNED_RULE_REVISIONS.AETHERSAILOR}/rule/Custom_Port_Direct.yaml`
        );
        expect(remoteRules[1].value).not.toContain(',28800');
        expect(remoteRules[1].interval).toBe(28800);
    });

    it('内联 GEOIP 的 no-resolve 标记在 Clash 输出中保留', () => {
        const model = parseIniTemplate(
            [
                '[custom]',
                'ruleset=🎯 全球直连,[]GEOSITE,private',
                'ruleset=🎯 全球直连,[]GEOIP,private,no-resolve',
                'ruleset=🐟 漏网之鱼,[]FINAL',
                'custom_proxy_group=🎯 全球直连`select`[]DIRECT',
                'custom_proxy_group=🐟 漏网之鱼`select`[]DIRECT',
            ].join('\n')
        );

        const config = yaml.load(renderClashFromTemplateModel(model));
        expect(config.rules).toContain('GEOSITE,private,🎯 全球直连');
        expect(config.rules).toContain('GEOIP,private,🎯 全球直连,no-resolve');
        expect(config.rules).toContain('MATCH,🐟 漏网之鱼');
    });

    it('无 no-resolve 的 GEOIP 与 FINAL 行为不变', () => {
        const model = parseIniTemplate(
            [
                '[custom]',
                'ruleset=🎯 全球直连,[]GEOIP,CN',
                'ruleset=🐟 漏网之鱼,[]FINAL',
                'custom_proxy_group=🎯 全球直连`select`[]DIRECT',
                'custom_proxy_group=🐟 漏网之鱼`select`[]DIRECT',
            ].join('\n')
        );

        const config = yaml.load(renderClashFromTemplateModel(model));
        expect(config.rules).toContain('GEOIP,CN,🎯 全球直连');
        expect(config.rules).toContain('MATCH,🐟 漏网之鱼');
    });
});

/**
 * 内置预设端到端渲染：8 个 Aethersailor 预设注册进 BUILTIN_TEMPLATE_REGISTRY，
 * 与真实管线一致（parse -> applySmartModelOptimizations -> renderClash）。
 */
const AETHERSAILOR_IDS = [
    'clash_aethersailor_standard',
    'clash_aethersailor_standard_fallback',
    'clash_aethersailor_lite',
    'clash_aethersailor_lite_fallback',
    'clash_aethersailor_gfw',
    'clash_aethersailor_gfw_fallback',
    'clash_aethersailor_full',
    'clash_aethersailor_full_fallback',
];

const SAMPLE_PROXIES = [
    '🇭🇰 HK 01',
    '🇺🇸 US 01',
    '🇯🇵 JP 01',
    '🇸🇬 SG 01',
    '🇹🇼 TW 01',
    '🇰🇷 KR 01',
    '🇩🇪 DE 01',
].map((name, index) => ({
    name,
    type: 'ss',
    server: `203.0.113.${index + 10}`,
    port: 443,
    cipher: 'aes-128-gcm',
    password: 'x',
}));

function renderBuiltinPreset(templateId) {
    const template = getBuiltinTemplate(templateId);
    expect(template, `${templateId} should be registered`).not.toBeNull();
    const model = parseIniTemplate(template.content, { proxies: SAMPLE_PROXIES });
    return yaml.load(renderClashFromTemplateModel(applySmartModelOptimizations(model)));
}

describe('Aethersailor 内置预设渲染（issue #332）', () => {
    it('八个预设全部注册，且规则源固定到 SHA 并镜像为 jsDelivr', () => {
        for (const templateId of AETHERSAILOR_IDS) {
            const template = getBuiltinTemplate(templateId);
            expect(template, templateId).not.toBeNull();
            expect(template.format, templateId).toBe('ini');

            const config = renderBuiltinPreset(templateId);
            const providers = Object.values(config['rule-providers'] || {});

            // GFW 极简版是纯内联规则（无远程规则文件），其余都应有 rule-providers
            if (templateId.includes('_gfw')) {
                expect(providers, templateId).toHaveLength(0);
            } else {
                expect(providers.length, templateId).toBeGreaterThan(0);
            }

            for (const provider of providers) {
                expect(
                    provider.url.startsWith(
                        `https://cdn.jsdelivr.net/gh/Aethersailor/Custom_OpenClash_Rules@${PINNED_RULE_REVISIONS.AETHERSAILOR}/rule/`
                    ),
                    `${templateId}: ${provider.url}`
                ).toBe(true);
                expect(provider.url, templateId).not.toContain('@main');
                if (provider.url.endsWith('.mrs')) {
                    expect(provider.format, provider.url).toBe('mrs');
                    expect(['domain', 'ipcidr'], provider.url).toContain(provider.behavior);
                }
            }

            // GEOSITE 内联规则原样透传（mihomo 原生支持），且模板自带 FINAL
            expect(
                config.rules.some((rule) => rule.startsWith('GEOSITE,')),
                templateId
            ).toBe(true);
            expect(
                config.rules.some((rule) => rule.startsWith('MATCH,')),
                templateId
            ).toBe(true);
        }
    });

    it('标准版保持 GEOSITE/GEOIP 语义与模板声明的更新间隔', () => {
        const config = renderBuiltinPreset('clash_aethersailor_standard');

        expect(config.rules).toContain('GEOSITE,cn,🎯 全球直连');
        expect(config.rules).toContain('GEOIP,cn,🎯 全球直连,no-resolve');

        const providers = config['rule-providers'];
        const directProvider = Object.values(providers).find((provider) =>
            provider.url.endsWith('/Custom_Direct_Domain.mrs')
        );
        const proxyProvider = Object.values(providers).find((provider) =>
            provider.url.endsWith('/Custom_Proxy_Domain.mrs')
        );
        expect(directProvider?.interval).toBe(1800);
        expect(proxyProvider?.interval).toBe(28800);
    });

    it('标准 fallback 版保留故障转移语义与排除式过滤器', () => {
        const config = renderBuiltinPreset('clash_aethersailor_standard_fallback');

        const fallbackGroup = config['proxy-groups'].find((group) => group.name === '🚀 故障转移');
        expect(fallbackGroup?.type).toBe('fallback');
        // 排除式过滤器（负向前瞻）应原样进入 filter 字段
        expect(String(fallbackGroup?.filter)).toContain('(?!.*(?:');

        // 过滤器语义：非地区命名节点进入 fallback，地区命名节点不进入
        expect(fallbackGroup?.proxies).toContain('🇩🇪 DE 01');
        expect(fallbackGroup?.proxies).not.toContain('🇭🇰 HK 01');
    });

    it('极简 GFW 版走纯内联 GEOSITE/GEOIP 规则', () => {
        const config = renderBuiltinPreset('clash_aethersailor_gfw');

        expect(config['rule-providers']).toBeUndefined();
        expect(config.rules).toContain('GEOSITE,gfw,🚀 手动选择');
        expect(config.rules).toContain('GEOIP,telegram,🚀 手动选择,no-resolve');
    });

    it('前端清单为 8 个预设建立 Clash 家族条目', () => {
        const assets = TRANSFORM_ASSETS.configs.filter((asset) =>
            asset.url.startsWith('builtin:clash_aethersailor_')
        );

        expect(assets).toHaveLength(8);
        for (const asset of assets) {
            expect(asset.sourceType).toBe('builtin-preset');
            expect(asset.group).toBe('Aethersailor');
            expect(asset.is_default).toBe(false);
            expect(asset.recommendedFor).toEqual(['clash']);
            expect(asset.compatibleClients).toEqual(['clash', 'mihomo', 'clash-meta']);
        }
    });
});
