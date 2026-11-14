/**
 * MiSub Core Processing Service
 * Handles the logic of: Profile Resolving -> Node Fetching -> Transformation Pipeline -> Response Rendering
 */

import { generateCombinedNodeList } from './subscription-service.ts';
import { transformBuiltinSubscription } from '../modules/subscription/transformer-factory.ts';
import {
    renderClashFromIniTemplate,
    renderSingboxFromIniTemplate,
    renderSurgeFromIniTemplate,
    renderLoonFromIniTemplate,
    renderQuanxFromIniTemplate,
    renderEgernFromIniTemplate,
} from '../modules/subscription/template-pipeline.ts';
import { getBuiltinTemplate } from '../modules/subscription/builtin-template-registry.ts';
import { fetchTransformTemplate } from '../modules/subscription/transform-template-cache.ts';
import { resolveRuleTemplateSource } from '../modules/rule-template-handler.ts';
import { base64EncodeUtf8 } from '../modules/utils.ts';
import yaml from 'js-yaml';
import { urlsToClashProxies } from '../utils/url-to-clash.ts';
import { resolveSafeDnsConfig } from '../modules/subscription/safe-dns.ts';
import { normalizeGeneratorOptions } from '../modules/subscription/generator-options.ts';
import { applyMihomoChainProxyToClashConfig } from '../modules/subscription/mihomo-chain-proxy.ts';

import type { KvRecord } from '../../types/models.ts';
function getTemplateExtension(templateUrl: unknown): string {
    const raw = typeof templateUrl === 'string' ? templateUrl.trim() : '';
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        return parsed.pathname.split('/').pop()?.split('.').pop()?.toLowerCase() || '';
    } catch {
        const cleanPath = raw.split('#')[0].split('?')[0];
        return cleanPath.split('/').pop()?.split('.').pop()?.toLowerCase() || '';
    }
}

export function isIniTemplateSource(
    templateSource: { kind?: string; value?: string } | null | undefined,
    builtinTemplateEntry: KvRecord | null = null
): boolean {
    if (builtinTemplateEntry?.format === 'ini') return true;
    if (templateSource?.kind === 'custom') return true;
    return getTemplateExtension(templateSource?.value) === 'ini';
}

function stripInternalProxyFields(proxy: unknown): unknown {
    if (!proxy || typeof proxy !== 'object') return proxy;
    const { metadata, ...publicProxy } = proxy as Record<string, unknown>;
    return publicProxy;
}

function deduplicateProxyNames(proxies: unknown[]) {
    const seen = new Map<string, number>();
    proxies.forEach((proxy) => {
        const record = proxy as { name?: string } | null;
        if (!record?.name) return;
        const originalName = record.name;
        const count = seen.get(originalName) || 0;
        seen.set(originalName, count + 1);
        if (count > 0) {
            record.name = `${originalName} ${count + 1}`;
        }
    });
}

export function isClashYamlProfileTemplate(templateText: unknown): boolean {
    if (typeof templateText !== 'string' || templateText.trim() === '') return false;

    try {
        const parsed = yaml.load(templateText);
        return Boolean(
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed) &&
            Array.isArray((parsed as Record<string, unknown>)['proxy-groups']) &&
            Array.isArray((parsed as Record<string, unknown>).rules)
        );
    } catch {
        return false;
    }
}

/**
 * Extract the MiSub-only YAML chain declaration and normalize it to the unified model.
 *
 * Example:
 * x-misub-chain-proxy:
 *   entry-group: 🔗 链式前置
 *   landing-group: 🔗 链式落地
 *   clone-prefix: "🔗 链式落地|"
 */
function normalizeYamlChainConfigs(
    config: Record<string, unknown>
): Array<Record<string, unknown>> {
    const rawDeclaration = config['x-misub-chain-proxy'];
    delete config['x-misub-chain-proxy'];

    let declarations: unknown[] = [];
    if (Array.isArray(rawDeclaration)) {
        declarations = rawDeclaration;
    } else if (rawDeclaration && typeof rawDeclaration === 'object') {
        declarations = [rawDeclaration];
    }

    return declarations
        .filter(
            (declaration) =>
                declaration && typeof declaration === 'object' && !Array.isArray(declaration)
        )
        .map((declaration) => {
            const record = declaration as Record<string, unknown>;
            return {
                ...record,
                // Long names are the documented YAML form; short names mirror the unified model.
                group: record.group ?? record['landing-group'],
                entry: record.entry ?? record['entry-group'],
                prefix: record.prefix ?? record['clone-prefix'],
            };
        });
}

export function renderClashYamlProfileTemplate(
    templateText: string,
    nodeList: unknown,
    options: Record<string, unknown> = {}
): string {
    const loadedConfig = yaml.load(templateText);
    if (!loadedConfig || typeof loadedConfig !== 'object' || Array.isArray(loadedConfig)) {
        return '';
    }
    const config = loadedConfig as Record<string, unknown>;

    const nodeUrls = String(nodeList || '')
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = urlsToClashProxies(nodeUrls, options).map(stripInternalProxyFields);
    deduplicateProxyNames(proxies);
    const rawGeneratorOptions = options.generatorOptions;
    const generatorOptions = normalizeGeneratorOptions(
        rawGeneratorOptions && typeof rawGeneratorOptions === 'object'
            ? (rawGeneratorOptions as Record<string, unknown>)
            : {}
    );

    const chainConfigs = normalizeYamlChainConfigs(config);
    config.proxies = proxies;
    if (chainConfigs.length > 0) {
        applyMihomoChainProxyToClashConfig(config, {
            chainConfigs,
            enableDialerProxy: Boolean(options.isMeta),
        });
    }

    return yaml.dump(
        {
            ...config,
            'allow-lan': generatorOptions.allowLan,
            'bind-address': generatorOptions.allowLan ? '0.0.0.0' : '127.0.0.1',
            ipv6: generatorOptions.ipv6,
            'external-controller': '127.0.0.1:9090',
            dns: resolveSafeDnsConfig(config.dns, {
                mode: options.dnsMode,
                proxyGroup: '🌐 DNS 出口',
                generatorOptions,
            }),
            proxies: config.proxies,
        },
        {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: '"',
            forceQuotes: false,
        }
    );
}

export class ProcessorService {
    /**
     * Generate nodes based on target format and configuration
     * @param {Object} context
     * @param {Object} config
     * @param {Object} params
     */
    static async processNodes(
        context: unknown,
        config: Record<string, unknown>,
        params: Record<string, unknown>
    ) {
        const {
            userAgent,
            targetMisubs,
            prependedContent,
            generationSettings,
            isDebugToken,
            shouldSkipCertVerify,
        } = params;

        // 1. Fetch and combine nodes
        const combinedNodeList = await generateCombinedNodeList(
            context,
            { ...config, enableAccessLog: false },
            userAgent,
            targetMisubs,
            String(prependedContent ?? ''),
            (generationSettings as KvRecord | null) ?? null,
            Boolean(isDebugToken),
            Boolean(shouldSkipCertVerify)
        );

        return combinedNodeList;
    }

    /**
     * Render the combined node list into the final format
     * @param {Object} options
     */
    static async renderOutput(options: Record<string, unknown> = {}) {
        const {
            targetFormat = 'base64',
            combinedNodeList = '',
            subName = '',
            config = {},
            builtinOptions = {},
            templateSource = { kind: 'none', value: '' },
            managedConfigUrl = '',
            storageAdapter = null,
            userInfoHeader = '',
        } = options as {
            targetFormat?: string;
            combinedNodeList?: string;
            subName?: string;
            config?: Record<string, unknown>;
            builtinOptions?: Record<string, unknown>;
            templateSource?: { kind?: string; value?: string };
            managedConfigUrl?: string;
            storageAdapter?: unknown;
            userInfoHeader?: string;
        };

        // Check for Base64 (simplest case)
        if (targetFormat === 'base64') {
            return {
                content: base64EncodeUtf8(combinedNodeList),
                contentType: 'text/plain; charset=utf-8',
                headers: userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {},
            };
        }

        // Handle built-in generation with optional templates
        const builtinProxyContent = transformBuiltinSubscription(combinedNodeList, targetFormat, {
            ...builtinOptions,
            managedConfigUrl,
        });

        if (!builtinProxyContent) {
            // Fallback to raw Base64 if generator fails
            return {
                content: base64EncodeUtf8(combinedNodeList),
                contentType: 'text/plain; charset=utf-8',
                headers: userInfoHeader ? { 'Subscription-Userinfo': userInfoHeader } : {},
            };
        }

        let finalContent = builtinProxyContent;
        let contentType = 'text/plain; charset=utf-8';
        const headers: Record<string, string> = userInfoHeader
            ? { 'Subscription-Userinfo': userInfoHeader }
            : {};

        const shouldApplyTemplate = !builtinOptions.hiddifyCompatible;
        const builtinTemplateEntry =
            shouldApplyTemplate && templateSource.kind === 'builtin'
                ? getBuiltinTemplate(templateSource.value)
                : null;
        const customTemplateEntry =
            shouldApplyTemplate && templateSource.kind === 'custom'
                ? await resolveRuleTemplateSource(storageAdapter, templateSource)
                : null;
        const remoteTemplateUrl =
            shouldApplyTemplate && templateSource.kind === 'remote'
                ? templateSource.value || ''
                : '';

        if (builtinTemplateEntry || customTemplateEntry || remoteTemplateUrl) {
            const templateText =
                builtinTemplateEntry?.content ||
                customTemplateEntry?.content ||
                (await fetchTransformTemplate(
                    storageAdapter as Parameters<typeof fetchTransformTemplate>[0],
                    remoteTemplateUrl
                ));
            const isIniTemplate = isIniTemplateSource(
                templateSource,
                builtinTemplateEntry || customTemplateEntry
            );

            if (templateText && isIniTemplate) {
                const renderParams = {
                    nodeList: combinedNodeList,
                    fileName: subName,
                    targetFormat,
                    ruleLevel: builtinOptions.ruleLevel,
                    interval: config.UpdateInterval || 86400,
                    managedConfigUrl,
                    skipCertVerify: builtinOptions.skipCertVerify,
                    enableUdp: builtinOptions.enableUdp,
                    isMeta: builtinOptions.isMeta,
                    customDnsOverride: builtinOptions.customDnsOverride || '',
                    dnsMode: builtinOptions.dnsMode || 'clean',
                    generatorOptions: builtinOptions.generatorOptions,
                    injectAiPolicy: builtinOptions.injectAiPolicy !== false,
                    injectDnsExitGroup: builtinOptions.injectDnsExitGroup !== false,
                };

                switch (targetFormat) {
                    case 'clash':
                        finalContent = renderClashFromIniTemplate(templateText, renderParams);
                        contentType = 'application/x-yaml; charset=utf-8';
                        break;
                    case 'singbox':
                    case 'sing-box':
                        finalContent = renderSingboxFromIniTemplate(templateText, renderParams);
                        contentType = 'application/json; charset=utf-8';
                        break;
                    case 'surge':
                    case 'surge&ver=4':
                        finalContent = renderSurgeFromIniTemplate(templateText, renderParams);
                        break;
                    case 'loon':
                        finalContent = renderLoonFromIniTemplate(templateText, renderParams);
                        break;
                    case 'quanx':
                        finalContent = renderQuanxFromIniTemplate(templateText, renderParams);
                        break;
                    case 'egern':
                        finalContent = renderEgernFromIniTemplate(templateText, renderParams);
                        contentType = 'application/x-yaml; charset=utf-8';
                        break;
                }
            } else if (
                templateText &&
                targetFormat === 'clash' &&
                isClashYamlProfileTemplate(templateText)
            ) {
                finalContent = renderClashYamlProfileTemplate(
                    templateText,
                    combinedNodeList,
                    builtinOptions
                );
                contentType = 'application/x-yaml; charset=utf-8';
                headers['X-MiSub-Template-Mode'] = 'clash-yaml-profile';
            }
        }

        // Set proper content type for built-in formats if not set by template
        if (contentType === 'text/plain; charset=utf-8') {
            if (targetFormat === 'clash' || targetFormat === 'egern')
                contentType = 'application/x-yaml; charset=utf-8';
            else if (targetFormat === 'singbox' || targetFormat === 'sing-box')
                contentType = 'application/json; charset=utf-8';
        }

        return {
            content: finalContent,
            contentType,
            headers,
        };
    }
}
