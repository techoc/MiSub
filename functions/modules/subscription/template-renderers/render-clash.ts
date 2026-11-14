import yaml from 'js-yaml';
import { clashFix } from '../../../utils/format-utils.ts';
import { normalizeUnifiedTemplateModel } from '../template-model.ts';
import { DNS_PROXY_GROUP, resolveSafeDnsConfig } from '../safe-dns.ts';
import { normalizeGeneratorOptions } from '../generator-options.ts';
import { applyMihomoChainProxy } from '../mihomo-chain-proxy.ts';
import { stripPolicyMembersForAutoGroup, withPolicyFallbacks } from '../policy-fallbacks.ts';

function mapGroupType(type: any) {
    const normalized = String(type || '')
        .trim()
        .toLowerCase();
    if (
        normalized === 'url-test' ||
        normalized === 'fallback' ||
        normalized === 'load-balance' ||
        normalized === 'select'
    ) {
        return normalized;
    }
    return 'select';
}

const CLASH_BUILTIN_POLICIES = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'GLOBAL']);

/**
 * 规则策略必须指向真实渲染出的组/节点或内置策略；
 * 渲染时被丢弃的组（空成员 fail-closed 等）不能留下悬空规则。
 */
function isRenderableRulePolicy(policy: any, groupNames: any, proxyNames: any) {
    const value = String(policy || '').trim();
    if (!value) return false;
    return CLASH_BUILTIN_POLICIES.has(value) || groupNames.has(value) || proxyNames.has(value);
}

function filterAutoSelectMembers(group: any) {
    const type = mapGroupType(group.type);
    if (!['url-test', 'fallback', 'load-balance'].includes(type)) {
        return Array.isArray(group.members) ? group.members.filter(Boolean) : [];
    }
    // 自动测速组剥离内置策略成员；纯 REJECT/DIRECT 存根组（剥后为空）原样保留
    return stripPolicyMembersForAutoGroup(group.members);
}

const ACL4SSR_ROOT_PROVIDER_FILES = new Set([
    'apple',
    'banad',
    'baneasylist',
    'baneasylistchina',
    'baneasyprivacy',
    'banprogramad',
    'chinacompanyip',
    'chinadomain',
    'chinaip',
    'chinaipv6',
    'chinamedia',
    'download',
    'localareanetwork',
    'mjj',
    'proxylite',
    'proxygfwlist',
    'proxymedia',
    'unban',
]);

const ACL4SSR_IPCIDR_PROVIDER_FILES = new Set([
    'amazonip',
    'chinacompanyip',
    'chinaip',
    'chinaipv6',
    'netflixip',
]);

// ACL4SSR root list files that should stay as text providers because their YAML provider is missing
// or does not preserve the effective raw .list rule coverage.
const ACL4SSR_ROOT_LIST_ONLY_FILES = new Set([
    'localareanetwork',
    'banad',
    'banprogramad',
    'chinamedia',
    'proxymedia',
    'chinadomain',
    'download',
    'unban',
]);

function toClashRuleProviderUrl(sourceUrl: any) {
    if (!/^https?:\/\//i.test(String(sourceUrl || ''))) return sourceUrl;

    try {
        const url = new URL(sourceUrl);
        // 兼容已被 CDN 镜像重写过的地址（cdn.jsdelivr.net/gh/OWNER/REPO@REF/PATH）。
        // 若只认 raw.githubusercontent.com，镜像后的链接会跳过 .list -> .yaml 映射，
        // 导致规则源指向不存在的 provider 文件。
        const mirrorMatch =
            url.hostname === 'cdn.jsdelivr.net'
                ? url.pathname.match(/^\/gh\/([^/@]+)\/([^/@]+)@([^/]+)\/(.+)$/)
                : null;
        const pathParts = mirrorMatch
            ? [mirrorMatch[1], mirrorMatch[2], mirrorMatch[3], ...mirrorMatch[4].split('/')]
            : url.pathname.split('/').filter(Boolean);

        const isGithubRaw = /raw\.githubusercontent\.com$/i.test(url.hostname);
        if (!isGithubRaw && !mirrorMatch) return sourceUrl;

        const owner = pathParts[0] || '';
        const repo = pathParts[1] || '';
        if (owner.toLowerCase() !== 'acl4ssr' || repo.toLowerCase() !== 'acl4ssr') return sourceUrl;

        // 统一以「仓库内路径」为基准判断与改写，避免镜像前缀干扰
        const repoPath = '/' + pathParts.slice(3).join('/');
        if (!/\/Clash\/.*\.(list|txt)$/i.test(repoPath)) return sourceUrl;

        const fileName =
            repoPath
                .split('/')
                .pop()
                ?.replace(/\.(list|txt)$/i, '') || '';
        if (
            /\/Clash\/[^/]+\.(list|txt)$/i.test(repoPath) &&
            ACL4SSR_ROOT_LIST_ONLY_FILES.has(fileName.toLowerCase())
        ) {
            return sourceUrl;
        }

        let newPath;
        if (/\/Clash\/Ruleset\//i.test(repoPath)) {
            newPath = repoPath
                .replace(/\/Clash\/Ruleset\//i, '/Clash/Providers/Ruleset/')
                .replace(/\.(list|txt)$/i, '.yaml');
        } else if (ACL4SSR_ROOT_PROVIDER_FILES.has(fileName.toLowerCase())) {
            newPath = repoPath
                .replace(/\/Clash\//i, '/Clash/Providers/')
                .replace(/\.(list|txt)$/i, '.yaml');
        } else {
            newPath = repoPath
                .replace(/\/Clash\//i, '/Clash/Providers/Ruleset/')
                .replace(/\.(list|txt)$/i, '.yaml');
        }

        if (mirrorMatch) {
            return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${mirrorMatch[3]}${newPath}`;
        }
        return `https://raw.githubusercontent.com/${owner}/${repo}/${pathParts[2]}${newPath}`;
    } catch {
        return sourceUrl;
    }
}

function isMrsProviderUrl(providerUrl: any) {
    try {
        return /\.mrs$/i.test(new URL(providerUrl).pathname);
    } catch {
        return false;
    }
}

function getRuleProviderBehavior(providerUrl: any) {
    try {
        const pathname = new URL(providerUrl).pathname;
        // Mihomo 的 mrs 仅支持 domain / ipcidr，配 classical 会在运行期报
        // ErrInvalidFormat，因此按规则来源路径推断：geoip 走 ipcidr，其余走 domain。
        if (/\.mrs$/i.test(pathname)) {
            return /\/geoip\//i.test(pathname) ? 'ipcidr' : 'domain';
        }
        const fileName =
            pathname
                .split('/')
                .pop()
                ?.replace(/\.(yaml|yml|list|txt|conf)$/i, '') || '';
        if (ACL4SSR_IPCIDR_PROVIDER_FILES.has(fileName.toLowerCase())) return 'ipcidr';
    } catch {
        // ignore invalid provider url shapes and keep default behavior
    }
    return 'classical';
}

function appendRuleExtras(rule: any, rendered: any) {
    // 保留模板作者声明的规则尾参（如 GEOIP 的 no-resolve——Aethersailor 模板全部携带，
    // 丢掉会让 GEOIP 命中前触发 DNS 解析，语义与性能都偏离原意）。
    const extras = Array.isArray(rule.extras) ? rule.extras.filter(Boolean) : [];
    return extras.length > 0 ? `${rendered},${extras.join(',')}` : rendered;
}

function mapRule(rule: any, ruleProviderMap: any) {
    const type = String(rule.type || '').toUpperCase();
    if (!type) return null;
    if (type === 'MATCH' || type === 'FINAL') return `MATCH,${rule.policy}`;
    if (type === 'GEOIP') {
        return appendRuleExtras(rule, `GEOIP,${rule.value || 'CN'},${rule.policy}`);
    }
    if (type === 'RULE-SET') {
        const providerName = ruleProviderMap.get(rule.value);
        return `RULE-SET,${providerName || rule.value},${rule.policy}`;
    }
    return appendRuleExtras(rule, `${type},${rule.value},${rule.policy}`);
}

export function renderClashFromTemplateModel(model: any, options: Record<string, any> = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const generatorOptions = normalizeGeneratorOptions(
        options.generatorOptions || normalizedModel.settings?.generatorOptions
    );

    // 所有客户端都保留链式策略组；仅 Mihomo/Meta 展开节点级 dialer-proxy。
    if (Array.isArray(normalizedModel.extras?.chainProxy)) {
        applyMihomoChainProxy(normalizedModel, {
            enableDialerProxy: Boolean(normalizedModel.meta?.isMeta),
        });
    }

    const ruleProviders = {};
    const ruleProviderMap = new Map();
    let providerCounter = 0;

    normalizedModel.rules.forEach((rule) => {
        const type = String(rule.type || '').toUpperCase();
        if (type !== 'RULE-SET' || !rule.value || !/^https?:\/\//i.test(rule.value)) return;

        const providerUrl = toClashRuleProviderUrl(rule.value);
        if (ruleProviderMap.has(providerUrl)) return;

        let nameHint = 'rs';
        try {
            const urlPath = new URL(providerUrl).pathname;
            const fileName =
                urlPath
                    .split('/')
                    .pop()
                    ?.replace(/\.(yaml|yml|list|txt|conf|mrs)$/i, '') || '';
            if (fileName) {
                nameHint = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            }
        } catch {
            // ignore invalid provider url shapes and keep fallback name
        }

        const providerName = `${nameHint}_${providerCounter++}`;
        ruleProviderMap.set(providerUrl, providerName);
        const usesTextList = /\.(list|txt)$/i.test(providerUrl);
        const usesMrs = isMrsProviderUrl(providerUrl);
        (ruleProviders as Record<string, any>)[providerName] = {
            type: 'http',
            behavior: getRuleProviderBehavior(providerUrl),
            url: providerUrl,
            path: `./ruleset/${providerName}.${usesTextList ? 'list' : usesMrs ? 'mrs' : 'yaml'}`,
            // 模板 ruleset 行声明的更新间隔（如 Aethersailor 的 1800/28800）优先于默认值
            interval: Number(rule.interval) > 0 ? Number(rule.interval) : 86400,
            ...(usesTextList ? { format: 'text' } : {}),
            ...(usesMrs ? { format: 'mrs' } : {}),
        };
    });

    // 渲染组集合：每个组统一补 REJECT/DIRECT 兜底（纯 REJECT/DIRECT 存根组原样保留，
    // 不再剥离），因此任何组都不会为空——mihomo 对空 proxies 且无 use 的组直接解析失败
    // （`use` or `proxies` missing），这是 OpenClash 启动报错的根源。
    const renderedGroups = normalizedModel.groups.map((group) => ({
        name: group.name,
        type: mapGroupType(group.type),
        proxies: withPolicyFallbacks(filterAutoSelectMembers(group), mapGroupType(group.type)),
        filter:
            Array.isArray(group.filters) && group.filters.length > 0
                ? group.filters.join('|')
                : undefined,
        ...group.options,
    }));
    const renderedGroupNames = new Set(renderedGroups.map((group) => group.name));
    const renderedProxyNames = new Set(
        normalizedModel.proxies.map((proxy) => proxy.name || proxy.tag).filter(Boolean)
    );

    // DNS 出口 detour 只能引用真实渲染出来的组；组已不再因空成员被丢弃，
    // 降级只剩两种来源：injectDnsExitGroup=false 显式关闭，或 explicit DNS
    // 覆盖跳过注入导致模型中没有该组。
    const dnsDetour =
        options.injectDnsExitGroup !== false && renderedGroupNames.has(DNS_PROXY_GROUP)
            ? DNS_PROXY_GROUP
            : 'DIRECT';

    const config = {
        'mixed-port': 7890,
        'allow-lan': generatorOptions.allowLan,
        'bind-address': generatorOptions.allowLan ? '0.0.0.0' : '127.0.0.1',
        ipv6: generatorOptions.ipv6,
        mode: 'rule',
        'log-level': 'info',
        'external-controller': '127.0.0.1:9090',
        dns: resolveSafeDnsConfig(normalizedModel.settings?.customDnsOverride, {
            mode: normalizedModel.settings?.dnsMode,
            proxyGroup: dnsDetour,
            generatorOptions,
        }),
        proxies: normalizedModel.proxies,
        'proxy-groups': renderedGroups,
        'rule-providers': Object.keys(ruleProviders).length > 0 ? ruleProviders : undefined,
        rules: normalizedModel.rules
            .filter((rule) =>
                isRenderableRulePolicy(rule.policy, renderedGroupNames, renderedProxyNames)
            )
            .map((rule) => {
                if (String(rule.type || '').toUpperCase() !== 'RULE-SET' || !rule.value) {
                    return mapRule(rule, ruleProviderMap);
                }
                return mapRule(
                    { ...rule, value: toClashRuleProviderUrl(rule.value) },
                    ruleProviderMap
                );
            })
            .filter(Boolean),
        profile: {
            'store-selected': true,
            'subscription-url': normalizedModel.settings.managedConfigUrl || '',
        },
    };

    let yamlStr = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
    });
    yamlStr = clashFix(yamlStr);
    return yamlStr;
}
