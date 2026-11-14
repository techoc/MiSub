import type { KvRecord } from '../../../types/models.ts';
const toBoolean = (value, fallback = false) => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
    }
    if (typeof value === 'boolean') return value;
    return fallback;
};

export const DEFAULT_GENERATOR_OPTIONS = Object.freeze({
    ipv6: false,
    allowLan: false,
    dns: Object.freeze({
        enable: true,
        ipv6: false,
        useHosts: true,
        useSystemHosts: true,
        respectRules: true,
    }),
    singbox: Object.freeze({
        tunAutoRoute: true,
        tunStrictRoute: true,
    }),
});

export function normalizeGeneratorOptions(value: Record<string, any> = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const dns =
        input.dns && typeof input.dns === 'object' && !Array.isArray(input.dns) ? input.dns : {};
    const singbox =
        input.singbox && typeof input.singbox === 'object' && !Array.isArray(input.singbox)
            ? input.singbox
            : {};

    return {
        ipv6: toBoolean(input.ipv6, DEFAULT_GENERATOR_OPTIONS.ipv6),
        allowLan: toBoolean(input.allowLan, DEFAULT_GENERATOR_OPTIONS.allowLan),
        dns: {
            enable: toBoolean(dns.enable, DEFAULT_GENERATOR_OPTIONS.dns.enable),
            ipv6: toBoolean(dns.ipv6, DEFAULT_GENERATOR_OPTIONS.dns.ipv6),
            useHosts: toBoolean(dns.useHosts, DEFAULT_GENERATOR_OPTIONS.dns.useHosts),
            useSystemHosts: toBoolean(
                dns.useSystemHosts,
                DEFAULT_GENERATOR_OPTIONS.dns.useSystemHosts
            ),
            respectRules: toBoolean(dns.respectRules, DEFAULT_GENERATOR_OPTIONS.dns.respectRules),
        },
        singbox: {
            tunAutoRoute: toBoolean(
                singbox.tunAutoRoute,
                DEFAULT_GENERATOR_OPTIONS.singbox.tunAutoRoute
            ),
            tunStrictRoute: toBoolean(
                singbox.tunStrictRoute,
                DEFAULT_GENERATOR_OPTIONS.singbox.tunStrictRoute
            ),
        },
    };
}

const SEARCH_PARAM_OPTIONS: Array<[string, (options: any, value: boolean) => void]> = [
    ['ipv6', (options, value) => (options.ipv6 = value)],
    ['allow-lan', (options, value) => (options.allowLan = value)],
    ['allowLan', (options, value) => (options.allowLan = value)],
    ['dns-enable', (options, value) => (options.dns.enable = value)],
    ['dns-ipv6', (options, value) => (options.dns.ipv6 = value)],
    ['dnsIpv6', (options, value) => (options.dns.ipv6 = value)],
    ['dns-use-hosts', (options, value) => (options.dns.useHosts = value)],
    ['dns-use-system-hosts', (options, value) => (options.dns.useSystemHosts = value)],
    ['dns-respect-rules', (options, value) => (options.dns.respectRules = value)],
    ['tun-auto-route', (options, value) => (options.singbox.tunAutoRoute = value)],
    ['tun-strict-route', (options, value) => (options.singbox.tunStrictRoute = value)],
];

function parseBooleanParam(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return null;
}

export function resolveGeneratorOptions(
    value: Record<string, any> = {},
    searchParams: KvRecord | null = null
) {
    const options = normalizeGeneratorOptions(value);
    if (!searchParams || typeof searchParams.has !== 'function') return options;

    for (const [name, apply] of SEARCH_PARAM_OPTIONS) {
        if (!searchParams.has(name)) continue;
        const parsed = parseBooleanParam(searchParams.get(name));
        if (parsed !== null) apply(options, parsed);
    }

    return options;
}

export function applyDnsGeneratorOptions(dnsConfig, options: Record<string, any> = {}) {
    const normalized = normalizeGeneratorOptions({ dns: options });
    dnsConfig.enable = normalized.dns.enable;
    dnsConfig.ipv6 = normalized.dns.ipv6;
    dnsConfig['use-hosts'] = normalized.dns.useHosts;
    dnsConfig['use-system-hosts'] = normalized.dns.useSystemHosts;
    dnsConfig['respect-rules'] = normalized.dns.respectRules;
    return dnsConfig;
}
