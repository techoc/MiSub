import yaml from 'js-yaml';
import { applyDnsGeneratorOptions, normalizeGeneratorOptions } from './generator-options.ts';

export const DNS_MODES = Object.freeze({
    CLEAN: 'clean',
    POLLUTED: 'polluted',
    DOMESTIC_CLEAN: 'domestic-clean',
    DOMESTIC_POLLUTED: 'domestic-polluted',
});

export const DNS_PROXY_GROUP = '🌐 DNS 出口';
export const SINGBOX_CN_RULE_SET = 'geosite-cn';
export const SINGBOX_FOREIGN_RULE_SET = 'geosite-geolocation-!cn';

export const DEFAULT_DNS_POLICY = Object.freeze({
    domestic: ['223.5.5.5', '119.29.29.29'],
    // 国内加密形态：IP 直连 DoH（DNSPod 加密端点为 120.53.53.53），避免 sing-box 引导解析循环
    domesticEncrypted: ['https://223.5.5.5/dns-query', 'https://120.53.53.53/dns-query'],
    foreign: ['udp://8.8.8.8:53', 'udp://1.1.1.1:53'],
    polluted: ['https://8.8.8.8/dns-query', 'https://1.1.1.1/dns-query'],
});

const SAFE_DNS_FIELDS = [
    'cache-algorithm',
    'fake-ip-range',
    'fake-ip-filter-mode',
    'fake-ip-ttl',
    'use-hosts',
    'use-system-hosts',
];

const DNS_HOST_PATTERN =
    /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\])$/i;
const DNS_SCHEME_PATTERN = /^(?:udp|tcp|tls|https):\/\//i;

function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value))
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
}

function parseOverride(raw) {
    if (isObject(raw)) return raw;
    if (typeof raw !== 'string' || !raw.trim()) return {};

    try {
        const parsed = yaml.load(raw.trim());
        if (!isObject(parsed)) return {};
        return isObject((parsed as Record<string, any>).dns) ? parsed.dns : parsed;
    } catch {
        return {};
    }
}

/**
 * 将任意 dnsMode 取值（含别名）归一化到 4 个规范值之一：
 * clean / polluted（国外 DNS 对，历史行为）；domestic-clean / domestic-polluted（阿里+腾讯，国内 DNS 对）。
 * 别名：domestic → domestic-clean；foreign-clean / foreign-polluted → clean / polluted；未知值一律回退 clean。
 */
export function normalizeDnsMode(value) {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    switch (raw) {
        case DNS_MODES.POLLUTED:
        case 'foreign-polluted':
            return DNS_MODES.POLLUTED;
        case DNS_MODES.DOMESTIC_CLEAN:
        case 'domestic':
            return DNS_MODES.DOMESTIC_CLEAN;
        case DNS_MODES.DOMESTIC_POLLUTED:
            return DNS_MODES.DOMESTIC_POLLUTED;
        default:
            return DNS_MODES.CLEAN;
    }
}

export function isDomesticDnsMode(value) {
    const mode = normalizeDnsMode(value);
    return mode === DNS_MODES.DOMESTIC_CLEAN || mode === DNS_MODES.DOMESTIC_POLLUTED;
}

function resolverHost(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.includes('#') || raw === 'system') return raw === 'system' ? raw : '';

    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `udp://${raw}`;
    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.replace(/^\[|\]$/g, '');
        if (!DNS_HOST_PATTERN.test(parsed.hostname)) return '';
        if (host === 'localhost' || host === '::1' || /^127\./.test(host) || /^0\./.test(host))
            return '';
        return raw;
    } catch {
        return '';
    }
}

function resolverList(value, fallback) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const normalized = values.map(resolverHost).filter(Boolean);
    return normalized.length > 0 ? normalized : [...fallback];
}

function plainResolver(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'system') return '';

    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `udp://${raw}`;
    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.replace(/^\[|\]$/g, '');
        if (!DNS_HOST_PATTERN.test(parsed.hostname)) return '';
        const formattedHost = host.includes(':') ? `[${host}]` : host;
        return `udp://${formattedHost}:53`;
    } catch {
        return '';
    }
}

/**
 * 将解析器取值归一化到「加密 DoH（https）」形态：
 * 明文主机 → https://<host>/dns-query；https/tls 保留原样；udp/tcp 等明文 scheme → https://<host>/dns-query。
 * 仅用于国内 polluted 形态，IP 直连端点可避免 sing-box 引导解析循环。
 */
function encryptedResolver(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'system') return '';

    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `https://${raw}/dns-query`;
    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.replace(/^\[|\]$/g, '');
        if (!DNS_HOST_PATTERN.test(parsed.hostname)) return '';
        if (parsed.protocol === 'https:' || parsed.protocol === 'tls:') return candidate;
        // udp/tcp 等明文 scheme 统一降级为 https DoH 形态
        return `https://${host}/dns-query`;
    } catch {
        return '';
    }
}

function policyInput(override) {
    return isObject(override.policy) ? { ...override, ...override.policy } : override;
}

export function resolveDnsPolicy(raw, options: Record<string, any> = {}) {
    const override = parseOverride(raw);
    const input = policyInput(override);
    const mode = normalizeDnsMode(options.mode || input.mode || input['dns-mode']);

    const domesticOverride =
        input.domestic ||
        input.domesticNameservers ||
        input['domestic-nameserver'] ||
        input['default-nameserver'];
    const domestic = resolverList(domesticOverride, DEFAULT_DNS_POLICY.domestic);
    // 默认加密对使用 DNSPod 官方 DoH IP（120.53.53.53），而非简单加密默认 UDP 列表；
    // 用户显式覆盖国内列表时才按加密形态派生
    const derivedEncrypted = domestic.map(encryptedResolver).filter(Boolean);
    const domesticEncrypted = domesticOverride
        ? derivedEncrypted.length > 0
            ? derivedEncrypted
            : [...DEFAULT_DNS_POLICY.domesticEncrypted]
        : [...DEFAULT_DNS_POLICY.domesticEncrypted];
    const foreign = resolverList(
        input.foreign ||
            input.foreignNameservers ||
            input['foreign-nameserver'] ||
            input.nameserver,
        DEFAULT_DNS_POLICY.foreign
    );
    const plainForeign =
        mode === DNS_MODES.CLEAN ? foreign.map(plainResolver).filter(Boolean) : foreign;

    return {
        mode,
        domestic,
        domesticEncrypted,
        foreign: plainForeign.length > 0 ? plainForeign : [...DEFAULT_DNS_POLICY.foreign],
        polluted: resolverList(
            input.polluted ||
                input.pollutedNameservers ||
                input['polluted-nameserver'] ||
                input.fallback,
            DEFAULT_DNS_POLICY.polluted
        ),
    };
}

function withProxy(value, proxyGroup) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'system') return raw;
    return `${raw}#${proxyGroup}`;
}

function cloneResolverPolicy(policy) {
    return {
        mode: policy.mode,
        domestic: [...policy.domestic],
        domesticEncrypted: [...(policy.domesticEncrypted || [])],
        foreign: [...policy.foreign],
        polluted: [...policy.polluted],
    };
}

export const DEFAULT_DNS_CONFIG = {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter-mode': 'blacklist',
    'fake-ip-filter': [
        'geosite:private',
        'geosite:category-ntp',
        '*.lan',
        '*.local',
        'localhost',
        '*.arpa',
    ],
    'use-hosts': true,
    'use-system-hosts': true,
    'respect-rules': true,
    'default-nameserver': [...DEFAULT_DNS_POLICY.domestic],
    nameserver: DEFAULT_DNS_POLICY.foreign.map((value) => withProxy(value, DNS_PROXY_GROUP)),
    'nameserver-policy': {
        'geosite:private': [...DEFAULT_DNS_POLICY.domestic],
        'geosite:cn': [...DEFAULT_DNS_POLICY.domestic],
        'geosite:geolocation-!cn': DEFAULT_DNS_POLICY.foreign.map((value) =>
            withProxy(value, DNS_PROXY_GROUP)
        ),
    },
    'proxy-server-nameserver': [...DEFAULT_DNS_POLICY.domestic],
    'direct-nameserver': [...DEFAULT_DNS_POLICY.domestic],
    'direct-nameserver-follow-policy': true,
    fallback: [],
    'fallback-filter': {
        geoip: true,
        'geoip-code': 'CN',
        ipcidr: ['240.0.0.0/4', '0.0.0.0/32', '127.0.0.0/8', '100.64.0.0/10'],
    },
};

export function isExplicitDnsBlock(override) {
    if (!isObject(override)) return false;
    return (
        override.enable !== undefined ||
        override['enhanced-mode'] !== undefined ||
        override['proxy-server-nameserver'] !== undefined ||
        (Array.isArray(override.nameserver) && isObject(override['nameserver-policy']))
    );
}

/**
 * 判断原始字符串/对象形式的自定义 DNS 覆盖是否为「整块替换 Safe DNS」的 explicit dns block。
 * 仅提供解析器列表的 policy 型覆盖不算：该形态下 Safe DNS 结构保留，
 * 境外解析仍会引用 DNS 出口策略组，调用方必须保证该组存在。
 */
export function isExplicitDnsOverride(raw) {
    return isExplicitDnsBlock(parseOverride(raw));
}

export function resolveSafeDnsConfig(raw, options: Record<string, any> = {}) {
    const rawOverride = parseOverride(raw);
    if (isExplicitDnsBlock(rawOverride)) {
        return clone(rawOverride);
    }

    const generatorOptions = normalizeGeneratorOptions(options.generatorOptions);
    const policy = resolveDnsPolicy(raw, options);
    const isDomestic = isDomesticDnsMode(policy.mode);
    const proxyGroup = String(options.proxyGroup || DNS_PROXY_GROUP);
    // 国内模式（domestic-clean / domestic-polluted）整块走阿里/腾讯直连
    // （clean=明文 UDP、polluted=加密 DoH），绝不引用出口策略组。
    const domesticNameserver =
        policy.mode === DNS_MODES.DOMESTIC_POLLUTED
            ? policy.domesticEncrypted
            : policy.domestic.map(plainResolver).filter(Boolean);
    // 国外模式采用经典反污染结构：nameserver 固定为国内明文 UDP 直连（兜底基线），
    // 国外 DNS（clean=明文 UDP / polluted=加密 DoH）经 DNS 出口策略组进入 fallback，
    // 与 nameserver 并发查询：国内结果为非 CN IP 时按 fallback-filter 改用国外结果；
    // 国外 DNS 不可达时并发中的国内结果自然兜底，避免国外域名解析整体失败。
    // geosite:geolocation-!cn 不写入 nameserver-policy——policy 优先于 fallback 竞速，
    // 保留会让国外域名绕过兜底、在出口组失效时解析失败。
    const foreignFallback = isDomestic
        ? []
        : (policy.mode === DNS_MODES.POLLUTED ? policy.polluted : policy.foreign).map((value) =>
              withProxy(value, proxyGroup)
          );
    const dns = clone(DEFAULT_DNS_CONFIG);

    dns['default-nameserver'] = [...policy.domestic];
    dns.nameserver = [...domesticNameserver];
    dns['nameserver-policy'] = {
        'geosite:private': [...policy.domestic],
        'geosite:cn': [...policy.domestic],
        ...options.subscriptionDnsPolicies?.reduce((acc, item) => {
            if (item && item.policy && isObject(item.policy)) {
                Object.assign(acc, item.policy);
            } else if (item && item.domains && item.nameservers) {
                acc[item.domains] = item.nameservers;
            }
            return acc;
        }, {}),
        ...(isDomestic ? { 'geosite:geolocation-!cn': [...domesticNameserver] } : {}),
    };
    dns['proxy-server-nameserver'] = [...policy.domestic];
    dns['direct-nameserver'] = [...policy.domestic];
    dns.fallback = foreignFallback;

    const override = policyInput(rawOverride);
    SAFE_DNS_FIELDS.forEach((key) => {
        if (override[key] === undefined) return;
        if (
            key === 'fake-ip-filter-mode' &&
            !['blacklist', 'whitelist', 'rule'].includes(String(override[key]))
        )
            return;
        if (['use-hosts', 'use-system-hosts'].includes(key)) {
            dns[key] = Boolean(override[key]);
            return;
        }
        if (key === 'fake-ip-filter') {
            if (
                Array.isArray(override[key]) &&
                override[key].every((item) => typeof item === 'string')
            ) {
                dns[key] = [...override[key]];
            }
            return;
        }
        if (typeof override[key] === 'string' || typeof override[key] === 'number')
            dns[key] = override[key];
    });

    applyDnsGeneratorOptions(dns, generatorOptions.dns);
    dns['enhanced-mode'] = 'fake-ip';
    return dns;
}

function parseSingboxResolver(value, tag, detour) {
    const raw = String(value || '').trim();
    const candidate = DNS_SCHEME_PATTERN.test(raw) ? raw : `udp://${raw}`;
    const parsed = new URL(candidate);
    const type = parsed.protocol.slice(0, -1);
    const server = parsed.hostname.replace(/^\[|\]$/g, '');
    const serverPort = Number(parsed.port) || (type === 'https' ? 443 : type === 'tls' ? 853 : 53);
    const result: Record<string, any> = { tag, type, server, server_port: serverPort, detour };
    if (type === 'https') result.path = parsed.pathname || '/dns-query';
    if (type === 'tls') result.tls = { enabled: true, server_name: server };
    return result;
}

export function buildSingboxDnsConfig(raw, options: Record<string, any> = {}) {
    const generatorOptions = normalizeGeneratorOptions(options.generatorOptions);
    const policy = resolveDnsPolicy(raw, options);
    const proxyGroup = String(options.proxyGroup || DNS_PROXY_GROUP);
    const isDomestic = isDomesticDnsMode(policy.mode);
    // 国内形态：全部解析器都是 dns-cn-* 直连（clean=UDP / polluted=加密 DoH），
    // 不产生 dns-foreign-*，final 直接落在国内解析器上。
    const domesticResolvers =
        policy.mode === DNS_MODES.DOMESTIC_POLLUTED ? policy.domesticEncrypted : policy.domestic;
    const domesticServers = domesticResolvers.map((value, index) =>
        parseSingboxResolver(value, `dns-cn-${index + 1}`, 'DIRECT')
    );
    const foreign = policy.mode === DNS_MODES.POLLUTED ? policy.polluted : policy.foreign;
    const foreignServers = isDomestic
        ? []
        : foreign.map((value, index) =>
              parseSingboxResolver(value, `dns-foreign-${index + 1}`, proxyGroup)
          );
    const domesticTag = domesticServers[0]?.tag || 'dns-cn-1';
    const foreignTag = foreignServers[0]?.tag || 'dns-foreign-1';

    return {
        strategy: generatorOptions.dns.ipv6 ? 'prefer_ipv4' : 'ipv4_only',
        servers: [...domesticServers, ...foreignServers],
        rules: [
            { rule_set: [SINGBOX_CN_RULE_SET], action: 'route', server: domesticTag },
            { domain_suffix: ['.cn', '.lan', '.local'], action: 'route', server: domesticTag },
            // 国外模式：已知境外域名走 dns-foreign（经出口组），其余域名 final 兜底到国内解析，
            // 与 mihomo 经典结构一致；引用的 rule-set 定义由生成端注入 route.rule_set
            ...(isDomestic
                ? []
                : [
                      {
                          rule_set: [SINGBOX_FOREIGN_RULE_SET],
                          action: 'route',
                          server: foreignTag,
                      },
                  ]),
        ],
        final: domesticTag,
    };
}

export function cloneDnsPolicy(raw, options: Record<string, any> = {}) {
    return cloneResolverPolicy(resolveDnsPolicy(raw, options));
}
