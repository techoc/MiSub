import { parseIniTemplate } from './template-parsers/ini-template-parser.ts';
import { applySmartModelOptimizations } from './template-processor.ts';
import { renderClashFromTemplateModel } from './template-renderers/render-clash.ts';
import { renderSingboxFromTemplateModel } from './template-renderers/render-singbox.ts';
import { renderSurgeFromTemplateModel } from './template-renderers/render-surge.ts';
import { renderLoonFromTemplateModel } from './template-renderers/render-loon.ts';
import { renderQuanxFromTemplateModel } from './template-renderers/render-quanx.ts';
import { renderEgernFromTemplateModel } from './template-renderers/render-egern.ts';
import { urlsToClashProxies } from '../../utils/url-to-clash.ts';
import { getUniqueName } from './name-utils.ts';

/**
 * 处理重名节点，确保每个节点名称唯一
 * @param {Object[]} proxies - 代理对象数组
 */
function deduplicateNames(proxies) {
    if (!Array.isArray(proxies)) return;
    const usedNames = new Map();
    proxies.forEach((proxy) => {
        if (proxy && proxy.name) {
            proxy.name = getUniqueName(proxy.name, usedNames);
        }
    });
}

export function renderClashFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies)
        ? options.proxies
        : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies,
    });

    // 智能注入地区分组逻辑
    model = applySmartModelOptimizations(model, options);

    return renderClashFromTemplateModel(model, options);
}

export function renderSingboxFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies)
        ? options.proxies
        : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies,
    });
    model = applySmartModelOptimizations(model, options);
    return renderSingboxFromTemplateModel(model, options);
}

export function renderSurgeFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies)
        ? options.proxies
        : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies,
    });
    model = applySmartModelOptimizations(model, options);
    return renderSurgeFromTemplateModel(model, options);
}

export function renderLoonFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies)
        ? options.proxies
        : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies,
    });
    model = applySmartModelOptimizations(model, options);
    return renderLoonFromTemplateModel(model, options);
}

export function renderQuanxFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies)
        ? options.proxies
        : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies,
    });
    model = applySmartModelOptimizations(model, options);
    return renderQuanxFromTemplateModel(model, options);
}

export function renderEgernFromIniTemplate(templateText, options = {}) {
    const nodeList = typeof options.nodeList === 'string' ? options.nodeList : '';
    const proxyUrls = nodeList
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    const proxies = Array.isArray(options.proxies)
        ? options.proxies
        : urlsToClashProxies(proxyUrls, options);
    deduplicateNames(proxies);

    let model = parseIniTemplate(templateText, {
        ...options,
        proxies,
    });
    model = applySmartModelOptimizations(model, options);
    return renderEgernFromTemplateModel(model, options);
}
