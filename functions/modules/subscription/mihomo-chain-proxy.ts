/**
 * Mihomo/Meta 链式代理（dialer-proxy）模型变换
 *
 * 背景：mihomo 已移除 relay 策略组，节点级 `dialer-proxy` 是当前唯一受支持的链式实现方式。
 * 该变换把模板中的链式声明展开为：
 * 1. 为每个节点生成一份带 `dialer-proxy` 的落地副本（副本名带前缀，避免与原始节点重名）；
 * 2. 落地策略组改为选择这些落地副本；
 * 3. 前置策略组保持只引用原始节点，避免 dialer-proxy 环路。
 *
 * 渲染层在所有客户端调用；仅 Mihomo/Meta 生成 dialer-proxy，其他客户端保留普通策略组。
 */

import { hasRealPolicyMembers } from './policy-fallbacks.ts';

/** 统一模板模型中的节点（仅本模块用到的字段） */
interface ModelProxy {
    name?: string;
    tag?: string;
    [key: string]: unknown;
}

/** 统一模板模型中的策略组 */
interface ModelGroup {
    name?: string;
    type?: string;
    members: unknown[];
    filters: unknown[];
    options: Record<string, unknown>;
    [key: string]: unknown;
}

/** 统一模板模型（仅声明本模块用到的部分） */
interface UnifiedTemplateModel {
    proxies?: ModelProxy[];
    groups?: ModelGroup[];
    extras?: { chainProxy?: unknown[]; [key: string]: unknown };
    [key: string]: unknown;
}

/** Clash YAML 配置（仅声明本模块用到的部分） */
interface ClashConfig {
    proxies?: unknown[];
    'proxy-groups'?: unknown[];
    [key: string]: unknown;
}

/** 链式声明条目（YAML 长/短字段名已由 normalizeYamlChainConfigs 归一） */
interface ChainConfig {
    group?: unknown;
    entry?: unknown;
    prefix?: unknown;
    [key: string]: unknown;
}

/**
 * 查找策略组，不存在时创建。
 * @param groups - 策略组数组（模型内数组引用）
 * @param name - 策略组名称
 * @param members - 新建时的初始成员
 * @returns 策略组
 */
function ensureGroup(groups: ModelGroup[], name: string, members: unknown[]): ModelGroup {
    let group = groups.find((item) => item.name === name);
    if (group) {
        if (!Array.isArray(group.members)) group.members = [];
        return group;
    }
    group = { name, type: 'select', members: [...members], filters: [], options: {} };
    groups.push(group);
    return group;
}

const DYNAMIC_MEMBER_OPTION_KEYS = [
    'include-all',
    'include-all-proxies',
    'use',
    'filter',
    'exclude-filter',
];

function removeDynamicMemberOptions(group: ModelGroup) {
    group.filters = [];
    DYNAMIC_MEMBER_OPTION_KEYS.forEach((key) => {
        if (group.options) delete group.options[key];
    });
}

/**
 * 展开链式代理落地副本。
 * 模板未声明 `custom_chain_proxy` 时原样返回，保证既有模板行为不变。
 * @param model - 统一模板模型
 * @param options - 转换选项
 * @param options.enableDialerProxy - 是否生成 Mihomo 专属 dialer-proxy 副本
 * @returns 处理后的模型
 */
export function applyMihomoChainProxy(
    model: UnifiedTemplateModel,
    { enableDialerProxy = true }: { enableDialerProxy?: boolean } = {}
): UnifiedTemplateModel {
    const chainConfigs = model?.extras?.chainProxy;
    if (!Array.isArray(chainConfigs) || chainConfigs.length === 0) return model;
    if (!Array.isArray(model.proxies) || !Array.isArray(model.groups)) return model;

    // normalizeUnifiedTemplateModel 保留了数组引用。先复制模型，避免重复渲染时不断叠加副本。
    const baseProxies: ModelProxy[] = (model.proxies as unknown[])
        .filter(Boolean)
        .map((proxy) => ({ ...(proxy as ModelProxy) }));
    const namedBaseProxies = baseProxies.filter((proxy) => proxy.name || proxy.tag);
    const baseNames: string[] = Array.from(
        new Set(namedBaseProxies.map((proxy) => String(proxy.name || proxy.tag)))
    );
    if (baseNames.length === 0) return model;

    model.proxies = baseProxies;
    model.groups = (model.groups as unknown[]).filter(Boolean).map((group) => {
        const record = group as ModelGroup;
        return {
            ...record,
            members: Array.isArray(record.members) ? [...record.members] : [],
            filters: Array.isArray(record.filters) ? [...record.filters] : [],
            options:
                typeof record.options === 'object' && record.options !== null
                    ? { ...record.options }
                    : {},
        };
    });

    const proxies = model.proxies;
    const groups = model.groups;

    const usedNames = new Set<string>(baseNames);
    const reservedNames = new Set<string>();
    const handledGroups = new Set<string>();
    const landingNames = new Set<string>(
        chainConfigs
            .map((config) => String((config as ChainConfig | null)?.group || '').trim())
            .filter(Boolean)
    );

    chainConfigs.forEach((rawConfig) => {
        const config = (rawConfig || {}) as ChainConfig;
        const landingName = String(config.group || '').trim();
        const entryName = String(config.entry || '').trim();
        if (
            !landingName ||
            !entryName ||
            landingName === entryName ||
            handledGroups.has(landingName) ||
            landingNames.has(entryName)
        ) {
            return;
        }
        handledGroups.add(landingName);

        const prefix =
            typeof config.prefix === 'string' && config.prefix !== ''
                ? config.prefix
                : `${landingName} - `;
        const entryGroup = ensureGroup(groups, entryName, baseNames);
        const landingGroup = ensureGroup(groups, landingName, []);

        // 用「真实成员」判断而不是 length：模型层统一追加的 REJECT/DIRECT 兜底
        // 不应被当成真实成员而跳过引导填充
        if (!hasRealPolicyMembers(entryGroup.members)) entryGroup.members = [...baseNames];
        if (!enableDialerProxy) {
            if (!hasRealPolicyMembers(landingGroup.members)) landingGroup.members = [...baseNames];
            return;
        }

        const copies = namedBaseProxies.map((proxy) => {
            const baseName = String(proxy.name || proxy.tag);
            let name = `${prefix}${baseName}`;
            let suffix = 2;
            while (usedNames.has(name)) {
                name = `${prefix}${baseName} (${suffix++})`;
            }
            usedNames.add(name);
            reservedNames.add(name);
            return { ...proxy, name, 'dialer-proxy': entryName };
        });

        proxies.push(...copies);

        landingGroup.type = 'select';
        landingGroup.members = copies.map((proxy) => proxy.name);
        // 成员已物化，移除动态筛选，避免客户端再次纳入其它节点或提供商节点。
        removeDynamicMemberOptions(landingGroup);

        // 前置组只能引用原始节点：引用落地组或落地副本都会形成 dialer-proxy 环路。
        entryGroup.members = entryGroup.members.filter(
            (member) => member !== landingName && !reservedNames.has(String(member))
        );
        removeDynamicMemberOptions(entryGroup);
    });

    return model;
}

/**
 * 将原始 Clash YAML 配置中的链式声明适配到统一链式转换。
 *
 * YAML profile 模板不经过 INI 的 UnifiedTemplateModel，因此在 YAML renderer 中
 * 需要保留原始 group 选项，同时复用 applyMihomoChainProxy 的节点复制和环路清理逻辑。
 * @param config - Parsed Clash YAML config
 * @param options - Conversion options
 * @param options.chainConfigs - YAML chain declarations
 * @param options.enableDialerProxy - Whether to materialize dialer-proxy copies
 * @returns The mutated Clash YAML config
 */
export function applyMihomoChainProxyToClashConfig(
    config: ClashConfig | null,
    {
        chainConfigs = [],
        enableDialerProxy = true,
    }: { chainConfigs?: ChainConfig[]; enableDialerProxy?: boolean } = {}
): ClashConfig | null {
    if (
        !config ||
        !Array.isArray(config.proxies) ||
        !Array.isArray(config['proxy-groups']) ||
        !Array.isArray(chainConfigs) ||
        chainConfigs.length === 0
    ) {
        return config;
    }

    const rawGroups = config['proxy-groups'] as unknown[];
    const model: UnifiedTemplateModel = {
        proxies: (config.proxies as unknown[]).map((proxy) => ({ ...(proxy as ModelProxy) })),
        groups: rawGroups.map((group) => {
            const { name, type, proxies, ...options } = (group || {}) as Record<string, unknown>;
            return {
                name: typeof name === 'string' ? name : undefined,
                type: typeof type === 'string' ? type : undefined,
                members: Array.isArray(proxies) ? [...proxies] : [],
                filters: [],
                options: { ...options },
            };
        }),
        extras: { chainProxy: chainConfigs },
    };

    applyMihomoChainProxy(model, { enableDialerProxy });

    const chainGroupNames = new Set<string>(
        chainConfigs
            .flatMap((chain) => [chain?.group, chain?.entry])
            .map((name) => String(name || '').trim())
            .filter(Boolean)
    );
    const rawGroupsByName = new Map<string, Record<string, unknown>>(
        rawGroups
            .map((group) => group as Record<string, unknown> | null | undefined)
            .filter((group): group is Record<string, unknown> => Boolean(group?.name))
            .map((group) => [String(group.name), group])
    );

    config.proxies = model.proxies;
    config['proxy-groups'] = (model.groups || []).map((group) => {
        const rawGroup = group.name ? rawGroupsByName.get(group.name) : undefined;
        const outputGroup: Record<string, unknown> = rawGroup
            ? { ...rawGroup }
            : { name: group.name };

        outputGroup.name = group.name;
        if (group.type) outputGroup.type = group.type;
        if (
            (group.name && chainGroupNames.has(group.name)) ||
            !rawGroup ||
            Object.prototype.hasOwnProperty.call(rawGroup, 'proxies')
        ) {
            outputGroup.proxies = Array.isArray(group.members) ? [...group.members] : [];
        }

        if (group.name && chainGroupNames.has(group.name)) {
            DYNAMIC_MEMBER_OPTION_KEYS.forEach((key) => delete outputGroup[key]);
        }

        return outputGroup;
    });

    return config;
}
