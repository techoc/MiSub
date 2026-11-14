/**
 * 内置 Sing-Box 配置生成器
 * 将节点 URL 列表转换为基础可用的 sing-box JSON 配置。
 */

import { urlToClashProxy, urlsToClashProxies } from '../../utils/url-to-clash.ts';
import { getUniqueName } from './name-utils.ts';
import { groupNodeLinesByRegion } from './region-groups.ts';
import {
    POLICY_GROUPS,
    getBuiltinRules,
    getRemoteProviderDefinitions,
    getSingboxDnsRuleSet,
    getSingboxForeignRuleSet,
    DEFAULT_SELECT_GROUP,
    DEFAULT_RELAY_GROUP,
    pruneProxyGroups,
} from './builtin-rules-provider.ts';
import {
    buildSingboxDnsConfig,
    DNS_PROXY_GROUP,
    isDomesticDnsMode,
    SINGBOX_CN_RULE_SET,
    SINGBOX_FOREIGN_RULE_SET,
} from './safe-dns.ts';
import { normalizeGeneratorOptions } from './generator-options.ts';
import type { ProxyNode } from '../../../types/models.ts';

/** sing-box 出站对象 */
interface SingboxOutbound {
    tag: string;
    type: string;
    server?: string;
    server_port?: number;
    tls?: Record<string, unknown>;
    transport?: Record<string, unknown>;
    [key: string]: unknown;
}

/** 生成器选项 */
interface SingboxGeneratorOptions {
    managedConfigUrl?: string;
    skipCertVerify?: boolean;
    enableUdp?: boolean;
    enableTfo?: boolean;
    ruleLevel?: string;
    dnsMode?: string;
    customDnsOverride?: string;
    generatorOptions?: Record<string, unknown>;
    [key: string]: unknown;
}

function cleanControlChars(str: string): string {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function sanitizeName(name: unknown): string {
    if (!name) return 'Untitled';
    let safe = cleanControlChars(name as string);
    safe = safe
        .replace(/\s+/g, ' ')
        .replace(/[\r\n\t]/g, ' ')
        .trim();
    return safe || 'Untitled';
}

function parsePort(port: unknown): number | undefined {
    const num = Number.parseInt(String(port), 10);
    return Number.isFinite(num) ? num : undefined;
}

function buildOutbound(proxyInput: unknown): SingboxOutbound | null {
    const proxy = proxyInput as ProxyNode | null;
    if (!proxy || !proxy.server || !proxy.port) return null;

    const type = (proxy.type || '').toLowerCase();
    const tag = sanitizeName(proxy.name);
    const server = proxy.server;
    const port = parsePort(proxy.port);
    if (!port) return null;

    const outbound: SingboxOutbound = { tag, type: 'direct' };

    if (type === 'ss' || type === 'shadowsocks') {
        outbound.type = 'shadowsocks';
        outbound.server = server;
        outbound.server_port = port;
        outbound.method = proxy.cipher || 'aes-128-gcm';
        outbound.password = proxy.password || '';
        if (proxy.udp) outbound.udp_over_tcp = false;

        // sing-box 的 Shadowsocks 出站使用 SIP003 plugin/plugin_opts；
        // `transport` 仅属于 V2Ray 传输协议，SFA 会严格拒绝它。
        const plugin = proxy.plugin || '';
        const opts = proxy['plugin-opts'] || proxy.pluginOpts || {};
        if (plugin === 'v2ray-plugin' || opts.mode === 'websocket') {
            outbound.plugin = 'v2ray-plugin';
            const pluginOptions = ['mode=websocket'];
            if (opts.host) pluginOptions.push(`host=${opts.host}`);
            if (opts.path) pluginOptions.push(`path=${opts.path}`);
            if (opts.tls || opts.mode === 'websocket-tls') pluginOptions.push('tls');
            outbound.plugin_opts = pluginOptions.join(';');
        }
    } else if (type === 'vmess') {
        outbound.type = 'vmess';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        outbound.security = proxy.cipher || 'auto';
        outbound.alter_id = Number.isFinite(Number(proxy.alterId)) ? Number(proxy.alterId) : 0;
        if (proxy.tls || proxy.sni || proxy.servername || proxy['skip-cert-verify']) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server,
            };
            if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
                outbound.tls.insecure = true;
            }
        }
        outbound.transport = {
            type: proxy.network === 'ws' ? 'ws' : 'tcp',
        };
        if (proxy['ws-opts']?.path || proxy.wsOpts?.path) {
            outbound.transport.path = proxy['ws-opts']?.path || proxy.wsOpts?.path;
        }
        const host = proxy['ws-opts']?.headers?.Host || proxy.wsOpts?.headers?.Host;
        if (host) outbound.transport.headers = { Host: host };
    } else if (type === 'vless') {
        outbound.type = 'vless';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        if (proxy.network) {
            outbound.transport = { type: proxy.network };
            if (proxy.network === 'ws') {
                const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
                if (wsOpts?.path) outbound.transport.path = wsOpts.path;
                if (wsOpts?.headers?.Host)
                    outbound.transport.headers = { Host: wsOpts.headers.Host };
            } else if (proxy.network === 'grpc') {
                const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
                if (grpcOpts?.['grpc-service-name'])
                    outbound.transport.service_name = grpcOpts['grpc-service-name'];
            } else if (proxy.network === 'xhttp') {
                const xhttpOpts = proxy['xhttp-opts'] || proxy.xhttpOpts;
                if (xhttpOpts?.path) outbound.transport.path = xhttpOpts.path;
                if (xhttpOpts?.host) outbound.transport.host = xhttpOpts.host;
                if (xhttpOpts?.mode) outbound.transport.mode = xhttpOpts.mode;
            }
        }
        if (proxy.flow) outbound.flow = proxy.flow;
        if (proxy.reality_opts || proxy['reality-opts']) {
            const reality = proxy.reality_opts || proxy['reality-opts'];
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server,
                utls: { enabled: true, fingerprint: proxy['client-fingerprint'] || 'chrome' },
                reality: {
                    enabled: true,
                    public_key: reality['public-key'] || reality.public_key,
                    short_id: reality['short-id'] || reality.short_id,
                },
            };
        }
    } else if (type === 'trojan') {
        outbound.type = 'trojan';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
        if (proxy.network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            outbound.transport = {
                type: 'ws',
                path: wsOpts?.path || '/',
                headers: wsOpts?.headers || {},
            };
        }
    } else if (type === 'hysteria2' || type === 'hy2') {
        outbound.type = 'hysteria2';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
    } else if (type === 'tuic') {
        outbound.type = 'tuic';
        outbound.server = server;
        outbound.server_port = port;
        outbound.uuid = proxy.uuid || '';
        outbound.password = proxy.password || '';

        const congestionControl =
            proxy['congestion-controller'] || proxy['congestion-control'] || proxy.congestion;
        if (congestionControl) outbound.congestion_control = congestionControl;
        // sing-box TUIC schema has no udp_relay_mode field; do not emit Clash-only option.
        if (proxy['udp-over-stream'] !== undefined)
            outbound.udp_over_stream = Boolean(proxy['udp-over-stream']);
        if (proxy['zero-rtt-handshake'] !== undefined || proxy['reduce-rtt'] !== undefined) {
            outbound.zero_rtt_handshake = Boolean(
                proxy['zero-rtt-handshake'] ?? proxy['reduce-rtt']
            );
        }
        if (proxy.heartbeat) outbound.heartbeat = String(proxy.heartbeat);
        if (proxy.network) outbound.network = proxy.network;

        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
        if (proxy.alpn) outbound.tls.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
    } else if (type === 'anytls') {
        outbound.type = 'anytls';
        outbound.server = server;
        outbound.server_port = port;
        outbound.password = proxy.password || '';
        outbound.tls = {
            enabled: true,
            server_name: proxy.sni || proxy.servername || server,
        };
    } else if (type === 'snell') {
        outbound.type = 'snell';
        outbound.server = server;
        outbound.server_port = port;
        outbound.psk = proxy.psk || proxy.password || '';
        if (proxy.version) outbound.version = Number(proxy.version);
    } else if (type === 'wireguard') {
        outbound.type = 'wireguard';
        outbound.server = server;
        outbound.server_port = port;
        outbound.private_key = proxy['private-key'] || '';
        outbound.local_address = Array.isArray(proxy.ip) ? proxy.ip : proxy.ip ? [proxy.ip] : [];
        outbound.peer_public_key = proxy['public-key'] || '';
        outbound.pre_shared_key = proxy['preshared-key'] || '';
        outbound.reserved = proxy.reserved;
    } else if (type === 'http' || type === 'https') {
        outbound.type = 'http';
        outbound.server = server;
        outbound.server_port = port;
        if (proxy.username) outbound.username = proxy.username;
        if (proxy.password) outbound.password = proxy.password;
        if (type === 'https' || proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            };
        }
    } else if (type === 'socks5' || type === 'socks5-tls') {
        outbound.type = 'socks';
        outbound.server = server;
        outbound.server_port = port;
        if (proxy.username) outbound.username = proxy.username;
        if (proxy.password) outbound.password = proxy.password;
        if (type === 'socks5-tls') {
            outbound.tls = {
                enabled: true,
                server_name: proxy.sni || proxy.servername || server,
            };
        }
    } else {
        return null;
    }

    if (proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true) {
        outbound.tls = outbound.tls || {};
        outbound.tls.enabled = true;
        outbound.tls.insecure = true;
    }
    if (
        (proxy.sni || proxy.servername) &&
        ((type !== 'ss' && type !== 'shadowsocks') || proxy.tls || outbound.tls?.enabled)
    ) {
        outbound.tls = outbound.tls || {};
        outbound.tls.server_name = proxy.sni || proxy.servername;
    }
    if (proxy['client-fingerprint']) {
        outbound.tls = outbound.tls || {};
        outbound.tls.utls = {
            enabled: true,
            fingerprint: proxy['client-fingerprint'],
        };
    }

    if (proxy.tfo) {
        outbound.tcp_fast_open = true;
    }

    return outbound;
}

export function generateBuiltinSingboxConfig(
    nodeList: string,
    options: SingboxGeneratorOptions = {}
) {
    const {
        managedConfigUrl = '',
        skipCertVerify = false,
        enableUdp = false,
        enableTfo = false,
        ruleLevel = 'std',
    } = options;
    const generatorOptions = normalizeGeneratorOptions(options.generatorOptions);

    const cleanedNodeList = cleanControlChars(nodeList);
    const nodeUrls = cleanedNodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

    const outbounds: SingboxOutbound[] = [];
    const usedNames = new Map<string, number>();
    const nodeEntries: Array<{ tag: string; outbound: SingboxOutbound }> = [];

    const proxies = urlsToClashProxies(nodeUrls, options);

    // 应用 UDP 开关
    // (已在 urlsToClashProxies 中全局处理)

    for (const clashProxy of proxies) {
        const baseName = sanitizeName(clashProxy!.name);
        clashProxy!.name = getUniqueName(baseName, usedNames);

        const outbound = buildOutbound(clashProxy);
        if (outbound) {
            outbounds.push(outbound);
            nodeEntries.push({ tag: outbound.tag, outbound });
        }
    }

    const proxyOutboundTags = outbounds.map((item) => item.tag);
    // 占位 DIRECT 只用于保证 outbounds 非空，不作为「节点」传给策略组工厂：
    // 零节点时工厂自身的 fail-closed 兜底（['REJECT']）+ 统一 REJECT/DIRECT 追加，
    // 才能与模板渲染路径保持一致
    const nodeOutbounds = [...outbounds];
    if (outbounds.length === 0) {
        outbounds.push({ tag: 'DIRECT', type: 'direct' });
    }

    const levelKey = (ruleLevel || 'std').toUpperCase();
    // 获取内置策略组
    const policyGroupsFactory =
        POLICY_GROUPS[levelKey as keyof typeof POLICY_GROUPS] || POLICY_GROUPS.STD;
    let proxyGroups = policyGroupsFactory(nodeOutbounds, options);
    proxyGroups = pruneProxyGroups(proxyGroups, outbounds);

    if (levelKey === 'RELAY') {
        const chainOutbounds = nodeEntries.map(({ tag, outbound }) => ({
            ...outbound,
            tag: `🔗 链式代理 - ${tag}`,
            detour: '入口节点',
        }));
        const chainTags = chainOutbounds.map((outbound) => outbound.tag);
        outbounds.push(...chainOutbounds);
        proxyGroups = proxyGroups
            .map((group) => {
                if (group.name === '🔗 链式代理') {
                    return {
                        ...group,
                        // Sing-box 通过 detour 表达链式出站。保持上一版可用结构：
                        // “链式代理”直接选择带 detour 的落地副本；同时隐藏“落地节点”分组。
                        type: 'select',
                        proxies: chainTags,
                    };
                }
                if (group.name === '落地节点') {
                    return null;
                }
                return group;
            })
            .filter((group): group is NonNullable<typeof group> => group !== null);
        proxyGroups = pruneProxyGroups(proxyGroups, outbounds);
    }

    // 国内 DNS 模式：整块 DNS 直连阿里/腾讯，不产生 #DNS 出口 引用；
    // 除非自定义 DNS 覆盖文本显式引用该组（fail-closed），否则整组移除
    const domesticDns = isDomesticDnsMode(options.dnsMode);
    if (domesticDns && !String(options.customDnsOverride || '').includes(DNS_PROXY_GROUP)) {
        proxyGroups = proxyGroups.filter((group) => group.name !== DNS_PROXY_GROUP);
    }

    // 将抽象分组转换为 Sing-Box Outbounds
    const groupOutbounds = proxyGroups.map((group) => {
        let type = 'selector';
        if (group.type === 'url-test') type = 'urltest';
        if (group.type === 'fallback') type = 'urltest'; // Sing-Box 暂时映射为 urltest

        return {
            tag: group.name,
            type: type,
            outbounds: group.proxies,
            ...(type === 'urltest'
                ? {
                      url: 'http://www.gstatic.com/generate_204',
                      interval: '10m',
                      tolerance: 50,
                  }
                : {}),
        };
    });

    // 从统一规则库获取分流规则
    const rawRules = getBuiltinRules(levelKey, 'singbox');

    // 提取远程 Rule Set 定义 (Sing-Box 格式)
    // 国内 DNS 模式下 DNS 出口组已被移除，rule-set 下载 detour 降级 DIRECT
    const dnsDetour = domesticDns ? 'DIRECT' : DNS_PROXY_GROUP;
    const ruleSetsMap = getRemoteProviderDefinitions('singbox', rawRules, {
        downloadDetour: dnsDetour,
    });
    const ruleSets = [
        getSingboxDnsRuleSet(dnsDetour),
        // 国外 DNS 模式下 DNS 分流规则引用 geolocation-!cn，需注入对应 rule-set 定义；
        // 国内模式无该引用，不注入（避免无谓下载）
        ...(domesticDns ? [] : [getSingboxForeignRuleSet(dnsDetour)]),
        ...Object.values(ruleSetsMap).filter((ruleSet) => {
            const tag = (ruleSet as { tag?: string }).tag;
            return tag !== SINGBOX_CN_RULE_SET && tag !== SINGBOX_FOREIGN_RULE_SET;
        }),
    ];

    // 转换路由规则：将中间对象映射为 Sing-Box 语法
    const routeRules = [
        {
            ip_cidr: ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
            outbound: 'DIRECT',
        },
        ...(generatorOptions.ipv6
            ? [
                  {
                      ip_cidr: ['::1/128', 'fc00::/7', 'fe80::/10'],
                      outbound: 'DIRECT',
                  },
              ]
            : []),
        { domain_suffix: ['localhost'], outbound: 'DIRECT' },
        ...rawRules.map((r) => {
            if (typeof r === 'string') return r;
            if (r.type === 'rule_set') return { rule_set: [r.tag], outbound: r.outbound };
            return r; // 已经是 Sing-Box 格式的普通规则
        }),
        { domain_suffix: ['cn'], outbound: 'DIRECT' },
    ];

    const dnsConfig = buildSingboxDnsConfig(options.customDnsOverride || '', {
        mode: options.dnsMode,
        proxyGroup: DNS_PROXY_GROUP,
        generatorOptions,
    });

    const config = {
        log: { level: 'info' },
        dns: dnsConfig,
        inbounds: [
            {
                type: 'tun',
                tag: 'tun-in',
                address: [
                    '172.19.0.1/30',
                    ...(generatorOptions.ipv6 ? ['fdfe:dcba:9876::1/126'] : []),
                ],
                auto_route: generatorOptions.singbox.tunAutoRoute,
                strict_route: generatorOptions.singbox.tunStrictRoute,
                stack: 'mixed',
            },
        ],
        outbounds: [
            { tag: 'DIRECT', type: 'direct' },
            { tag: 'REJECT', type: 'block' },
            ...outbounds,
            ...groupOutbounds,
        ],
        route: {
            auto_detect_interface: true,
            default_domain_resolver: dnsConfig.servers[0]?.tag || 'dns-cn-1',
            final: levelKey === 'RELAY' ? DEFAULT_RELAY_GROUP : DEFAULT_SELECT_GROUP,
            rule_set: ruleSets,
            rules: routeRules,
        },
    };

    return JSON.stringify(config, null, 2) + '\n';
}
