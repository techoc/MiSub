import { urlsToClashProxies } from '../../../utils/url-to-clash.ts';
import { normalizeUnifiedTemplateModel } from '../template-model.ts';
import {
    buildSingboxDnsConfig,
    DNS_PROXY_GROUP,
    isDomesticDnsMode,
    SINGBOX_CN_RULE_SET,
    SINGBOX_FOREIGN_RULE_SET,
} from '../safe-dns.ts';
import { normalizeGeneratorOptions } from '../generator-options.ts';
import {
    getSingboxDnsRuleSet,
    getSingboxForeignRuleSet,
    pinRemoteRuleUrl,
} from '../builtin-rules-provider.ts';
import { stripPolicyMembersForAutoGroup, withPolicyFallbacks } from '../policy-fallbacks.ts';

function sanitizeTag(value) {
    return String(value || '').trim() || 'Untitled';
}

function parsePort(port) {
    const num = Number.parseInt(String(port), 10);
    return Number.isFinite(num) ? num : undefined;
}

function buildOutbound(proxy) {
    if (!proxy || !proxy.server || !proxy.port) return null;

    const type = String(proxy.type || '').toLowerCase();
    const tag = sanitizeTag(proxy.name);
    const server = proxy.server;
    const serverPort = parsePort(proxy.port);
    if (!serverPort) return null;

    if (type === 'http' || type === 'https') {
        const outbound: Record<string, any> = {
            tag,
            type: 'http',
            server,
            server_port: serverPort,
            username: proxy.username || undefined,
            password: proxy.password || undefined,
        };
        if (type === 'https' || proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            };
        }
        return outbound;
    }

    if (type === 'trojan') {
        return {
            tag,
            type: 'trojan',
            server,
            server_port: serverPort,
            password: proxy.password || '',
            tls: {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            },
        };
    }

    if (type === 'ss' || type === 'shadowsocks') {
        const outbound: Record<string, any> = {
            tag,
            type: 'shadowsocks',
            server,
            server_port: serverPort,
            method: proxy.cipher || 'aes-128-gcm',
            password: proxy.password || '',
        };
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
        return outbound;
    }

    if (type === 'vmess') {
        const outbound: Record<string, any> = {
            tag,
            type: 'vmess',
            server,
            server_port: serverPort,
            uuid: proxy.uuid || '',
            security: proxy.cipher || 'auto',
            congestion_control: proxy['congestion-control'] || 'cubic',
            alter_id: Number.isFinite(Number(proxy.alterId)) ? Number(proxy.alterId) : 0,
        };

        const network = proxy.network || '';
        if (network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            outbound.transport = {
                type: 'ws',
                path: wsOpts?.path || '/',
                headers: wsOpts?.headers || {},
            };
        } else if (network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            outbound.transport = {
                type: 'grpc',
                service_name: grpcOpts?.['grpc-service-name'] || grpcOpts?.serviceName || 'grpc',
            };
        } else if (network === 'h2' || network === 'http') {
            const opts = proxy[`${network}-opts`] || proxy[`${network}Opts`];
            outbound.transport = {
                type: network === 'h2' ? 'h2' : 'http',
                host: opts?.host ? (Array.isArray(opts.host) ? opts.host : [opts.host]) : [],
                path: opts?.path || '/',
            };
        }

        if (proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            };
            if (proxy.alpn)
                (outbound.tls as Record<string, any>).alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
        }
        return outbound;
    }

    if (type === 'vless') {
        const outbound: Record<string, any> = {
            tag,
            type: 'vless',
            server,
            server_port: serverPort,
            uuid: proxy.uuid || '',
        };
        if (proxy.flow) outbound.flow = proxy.flow;

        const network = proxy.network || '';
        if (network === 'ws') {
            const wsOpts = proxy['ws-opts'] || proxy.wsOpts;
            outbound.transport = {
                type: 'ws',
                path: wsOpts?.path || '/',
                headers: wsOpts?.headers || {},
            };
        } else if (network === 'grpc') {
            const grpcOpts = proxy['grpc-opts'] || proxy.grpcOpts;
            outbound.transport = {
                type: 'grpc',
                service_name: grpcOpts?.['grpc-service-name'] || grpcOpts?.serviceName || 'grpc',
            };
        } else if (network === 'httpupgrade') {
            const httpupgradeOpts = proxy['httpupgrade-opts'] || proxy.httpupgradeOpts;
            outbound.transport = {
                type: 'httpupgrade',
                path: httpupgradeOpts?.path || '/',
                host: httpupgradeOpts?.host || '',
            };
        }

        if (proxy.tls || proxy.sni || proxy.servername) {
            outbound.tls = {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            };

            const fingerprint = proxy['client-fingerprint'] || proxy.clientFingerprint || proxy.fp;
            if (fingerprint) {
                (outbound.tls as Record<string, any>).utls = {
                    enabled: true,
                    fingerprint: fingerprint,
                };
            }

            const realityOpts = proxy['reality-opts'] || proxy.realityOpts;
            if (realityOpts) {
                (outbound.tls as Record<string, any>).reality = {
                    enabled: true,
                    public_key: realityOpts['public-key'] || realityOpts.publicKey || '',
                    short_id: realityOpts['short-id'] || realityOpts.shortId || '',
                };
                if (realityOpts['spider-x'] || realityOpts.spiderX) {
                    (outbound.tls as Record<string, any>).reality.spider_x = realityOpts['spider-x'] || realityOpts.spiderX;
                }
            }
        }
        return outbound;
    }

    if (type === 'hysteria2' || type === 'hy2') {
        return {
            tag,
            type: 'hysteria2',
            server,
            server_port: serverPort,
            password: proxy.password || '',
            tls: {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            },
        };
    }

    if (type === 'tuic') {
        const outbound: Record<string, any> = {
            tag,
            type: 'tuic',
            server,
            server_port: serverPort,
            uuid: proxy.uuid || '',
            password: proxy.password || '',
            tls: {
                enabled: true,
                server_name: proxy.servername ?? proxy.sni ?? server,
                insecure: proxy['skip-cert-verify'] === true || proxy.skipCertVerify === true,
            },
        };
        if (proxy.alpn) outbound.tls.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn];
        const congestionControl =
            proxy['congestion-control'] || proxy['congestion-controller'] || proxy.congestion;
        if (congestionControl) outbound.congestion_control = congestionControl;
        // sing-box TUIC schema has no udp_relay_mode field.
        if (proxy['udp-over-stream'] !== undefined)
            outbound.udp_over_stream = Boolean(proxy['udp-over-stream']);
        if (proxy['zero-rtt-handshake'] !== undefined || proxy['reduce-rtt'] !== undefined) {
            outbound.zero_rtt_handshake = Boolean(
                proxy['zero-rtt-handshake'] ?? proxy['reduce-rtt']
            );
        }
        if (proxy.heartbeat) outbound.heartbeat = String(proxy.heartbeat);
        if (proxy.network) outbound.network = proxy.network;
        return outbound;
    }

    if (type === 'wireguard') {
        return {
            tag,
            type: 'wireguard',
            server,
            server_port: serverPort,
            local_address: Array.isArray(proxy.ip) ? proxy.ip : proxy.ip ? [proxy.ip] : [],
            private_key: proxy['private-key'] || '',
            peer_public_key: proxy['public-key'] || '',
            pre_shared_key: proxy['preshared-key'] || '',
        };
    }

    return null;
}

function mapGroupType(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'select') return 'selector';
    if (normalized === 'url-test') return 'urltest';
    if (normalized === 'load-balance') return 'selector';
    return 'selector';
}

function buildGroupOutbounds(groups) {
    return groups.map((group) => {
        const mappedType = mapGroupType(group.type);
        const rawMembers = Array.isArray(group.members) ? group.members.filter(Boolean) : [];
        // urltest 剥离内置策略成员；纯 REJECT/DIRECT 存根组（剥后为空）原样保留，
        // 随后所有组统一补 REJECT/DIRECT 兜底
        const members = ['urltest'].includes(mappedType)
            ? stripPolicyMembersForAutoGroup(rawMembers)
            : rawMembers;
        const outbound: Record<string, any> = {
            tag: sanitizeTag(group.name),
            type: mappedType,
            outbounds: withPolicyFallbacks(members, mappedType),
        };

        if (mappedType === 'urltest') {
            outbound.url = group.options?.url || 'http://www.gstatic.com/generate_204';
            outbound.interval = `${group.options?.interval || 300}s`;
        }

        if (outbound.outbounds.length > 0) {
            outbound.default = outbound.outbounds[0];
        }

        return outbound;
    });
}

const SINGBOX_BUILTIN_OUTBOUNDS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'GLOBAL']);

/**
 * 规则出口必须指向真实渲染出的组/节点或内置策略；
 * 渲染时被丢弃的组（空成员 fail-closed 等）不能留下悬空规则或 route.final。
 */
function isRenderableRuleOutbound(policy, groupTags, proxyTags) {
    const value = String(policy || '').trim();
    if (!value) return false;
    return SINGBOX_BUILTIN_OUTBOUNDS.has(value) || groupTags.has(value) || proxyTags.has(value);
}

function mapRuleToSingbox(rule) {
    const type = String(rule.type || '').toLowerCase();
    if (type === 'rule-set') {
        return {
            rule_set: sanitizeTag(`${rule.policy}_${rule.value}`),
            outbound: rule.policy,
        };
    }
    if (type === 'geoip') {
        const value = String(rule.value || 'cn').toLowerCase();
        return {
            rule_set: [`geoip-${value}`],
            outbound: rule.policy,
        };
    }
    if (type === 'geosite') {
        const value = String(rule.value || 'cn').toLowerCase();
        return {
            rule_set: [`geosite-${value}`],
            outbound: rule.policy,
        };
    }
    if (type === 'match' || type === 'final') {
        return {
            outbound: rule.policy,
        };
    }
    if (type === 'domain-suffix') {
        return {
            domain_suffix: [rule.value],
            outbound: rule.policy,
        };
    }
    if (type === 'domain-keyword') {
        return {
            domain_keyword: [rule.value],
            outbound: rule.policy,
        };
    }
    return null;
}

function detectRuleSetFormat(url) {
    const raw = String(url || '')
        .trim()
        .toLowerCase();
    if (!raw) return 'source';
    return raw.endsWith('.srs') ? 'binary' : 'source';
}

function buildRuleSets(rules, dnsDetour = DNS_PROXY_GROUP) {
    const remoteRuleSets = rules
        .filter(
            (rule) =>
                String(rule.type || '').toLowerCase() === 'rule-set' && rule.source === 'remote'
        )
        .map((rule) => ({
            tag: sanitizeTag(`${rule.policy}_${rule.value}`),
            type: 'remote',
            format: detectRuleSetFormat(rule.value),
            url: pinRemoteRuleUrl(rule.value),
            update_interval: '24h',
            download_detour: dnsDetour,
        }));

    const implicitRuleSets: any[] = [];
    const seen = new Set();

    rules.forEach((rule) => {
        const type = String(rule.type || '').toLowerCase();
        if (type === 'geoip' || type === 'geosite') {
            const value = String(rule.value || 'cn').toLowerCase();
            const tag = `${type}-${value}`;
            if (!seen.has(tag)) {
                seen.add(tag);
                implicitRuleSets.push({
                    tag,
                    type: 'remote',
                    format: 'binary',
                    url:
                        type === 'geoip'
                            ? pinRemoteRuleUrl(
                                  `https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-${value}.srs`
                              )
                            : pinRemoteRuleUrl(
                                  `https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-${value}.srs`
                              ),
                    update_interval: '24h',
                    download_detour: dnsDetour,
                });
            }
        }
    });

    return [...remoteRuleSets, ...implicitRuleSets];
}

export function renderSingboxFromTemplateModel(model, options: Record<string, any> = {}) {
    const normalizedModel = normalizeUnifiedTemplateModel(model);
    const generatorOptions = normalizeGeneratorOptions(
        options.generatorOptions || normalizedModel.settings?.generatorOptions
    );
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies =
        Array.isArray(normalizedModel.proxies) && normalizedModel.proxies.length > 0
            ? normalizedModel.proxies
            : urlsToClashProxies(proxyUrls);
    const proxyOutbounds = proxies.map(buildOutbound).filter(Boolean);
    // 渲染组集合：每个组统一补 REJECT/DIRECT 兜底（纯 REJECT/DIRECT 存根组原样保留，
    // 不再剥离），因此任何组都不会为空——sing-box 对空 outbounds 的 urltest/selector
    // 直接解析失败
    const groupOutbounds = buildGroupOutbounds(normalizedModel.groups).filter(
        (outbound) => (outbound.outbounds || []).length > 0
    );
    const renderedGroupTags = new Set(groupOutbounds.map((outbound) => outbound.tag));
    const renderedProxyTags = new Set(proxyOutbounds.map((outbound) => outbound.tag));
    // DNS 出口 detour 只能引用真实渲染出来的组；组已不再因空成员被丢弃，
    // 降级只剩两种来源：injectDnsExitGroup=false 显式关闭，或 explicit DNS
    // 覆盖跳过注入导致模型中没有该组
    const dnsDetour =
        options.injectDnsExitGroup !== false && renderedGroupTags.has(DNS_PROXY_GROUP)
            ? DNS_PROXY_GROUP
            : 'DIRECT';
    // 国外 DNS 模式下 DNS 分流规则引用 geolocation-!cn，需注入对应 rule-set 定义；
    // 国内模式无该引用，不注入（避免无谓下载）
    const foreignDns = !isDomesticDnsMode(normalizedModel.settings?.dnsMode);
    const ruleSetObjects = [
        { ...getSingboxDnsRuleSet(), download_detour: dnsDetour },
        ...(foreignDns ? [{ ...getSingboxForeignRuleSet(), download_detour: dnsDetour }] : []),
        ...buildRuleSets(normalizedModel.rules, dnsDetour).filter(
            (ruleSet) =>
                ruleSet.tag !== SINGBOX_CN_RULE_SET && ruleSet.tag !== SINGBOX_FOREIGN_RULE_SET
        ),
    ];
    const routeRules = [
        ...(generatorOptions.ipv6
            ? [
                  {
                      ip_cidr: ['::1/128', 'fc00::/7', 'fe80::/10'],
                      outbound: 'DIRECT',
                  },
              ]
            : []),
        ...normalizedModel.rules
            .filter((rule) =>
                isRenderableRuleOutbound(rule.policy, renderedGroupTags, renderedProxyTags)
            )
            .map(mapRuleToSingbox)
            .filter(Boolean),
    ];
    const defaultOutbound =
        groupOutbounds.find((outbound) => outbound.tag !== DNS_PROXY_GROUP)?.tag || 'DIRECT';
    const dnsConfig = buildSingboxDnsConfig(normalizedModel.settings?.customDnsOverride, {
        mode: normalizedModel.settings?.dnsMode,
        proxyGroup: dnsDetour,
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
            ...proxyOutbounds,
            ...groupOutbounds,
        ],
        route: {
            auto_detect_interface: true,
            default_domain_resolver: dnsConfig.servers[0]?.tag || 'dns-cn-1',
            final: defaultOutbound,
            rule_set: ruleSetObjects,
            rules: routeRules,
        },
    };

    return JSON.stringify(config, null, 2) + '\n';
}
