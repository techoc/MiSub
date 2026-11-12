import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseIniTemplate } from '../../functions/modules/subscription/template-parsers/ini-template-parser.js';
import { renderClashFromTemplateModel } from '../../functions/modules/subscription/template-renderers/render-clash.js';
import { PINNED_RULE_REVISIONS } from '../../functions/modules/subscription/builtin-rules-provider.js';

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
            ].join('\n')
        );

        const config = yaml.load(renderClashFromTemplateModel(model));
        expect(config.rules).toContain('GEOSITE,private,🎯 全球直连');
        expect(config.rules).toContain('GEOIP,private,🎯 全球直连,no-resolve');
        expect(config.rules).toContain('MATCH,🐟 漏网之鱼');
    });

    it('无 no-resolve 的 GEOIP 与 FINAL 行为不变', () => {
        const model = parseIniTemplate(
            ['[custom]', 'ruleset=🎯 全球直连,[]GEOIP,CN', 'ruleset=🐟 漏网之鱼,[]FINAL'].join('\n')
        );

        const config = yaml.load(renderClashFromTemplateModel(model));
        expect(config.rules).toContain('GEOIP,CN,🎯 全球直连');
        expect(config.rules).toContain('MATCH,🐟 漏网之鱼');
    });
});
