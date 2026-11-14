/**
 * 策略组成员兜底工具（模板渲染器与内置生成器共享）。
 *
 * 生成约定：
 * 1. 成员只有 REJECT/DIRECT 的组（fail-closed 存根，如零节点的 🌐 DNS 出口 `['REJECT']`）
 *    不做剥离——剥空会导致整组丢弃、`#🌐 DNS 出口` 引用悬空；
 * 2. 所有策略组统一补 REJECT；手动选择类组额外补 DIRECT。
 *    自动测速组（url-test/fallback/load-balance）不补 DIRECT：DIRECT 参与测速会有
 *    延迟偏差，直连可达测速地址的环境里自动选择会偏向 DIRECT（意外直连泄漏）。
 */

// url-test/fallback/load-balance 组需剥离的内置策略成员
const AUTO_GROUP_POLICY_MEMBERS = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'];

// 自动测速组类型（含 sing-box 的 urltest 等价写法）
const AUTO_GROUP_TYPES = new Set(['url-test', 'urltest', 'fallback', 'load-balance']);

// 手动选择类组统一追加的兜底成员（按此顺序排在真实成员之后）
const FALLBACK_POLICY_MEMBERS = ['REJECT', 'DIRECT'];

function isBuiltinPolicyMember(member: any) {
    return AUTO_GROUP_POLICY_MEMBERS.includes(
        String(member || '')
            .trim()
            .toUpperCase()
    );
}

function isAutoGroupType(groupType: any) {
    return AUTO_GROUP_TYPES.has(
        String(groupType || '')
            .trim()
            .toLowerCase()
    );
}

/**
 * 剥离自动测速组（url-test/fallback/load-balance）中的内置策略成员；
 * 剥离后为空（纯策略存根组）时保留原成员——这类组是有意为之的 fail-closed 形态。
 * @param {string[]} members
 * @returns {string[]}
 */
export function stripPolicyMembersForAutoGroup(members: any) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    const stripped = list.filter((member) => !isBuiltinPolicyMember(member));
    return stripped.length > 0 ? stripped : list;
}

/**
 * 判断成员中是否还存在真实节点/组（剔除 REJECT/DIRECT 等内置策略兜底成员后）。
 * 链式代理等「成员为空才引导填充」的逻辑必须用它判断，否则统一兜底成员会被
 * 误当成真实成员而跳过引导。
 * @param {string[]} members
 * @returns {boolean}
 */
export function hasRealPolicyMembers(members: any) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    return list.some((member) => !isBuiltinPolicyMember(member));
}

/**
 * 按序追加兜底成员（大小写不敏感去重，保持原有顺序）：
 * 自动测速组只补 REJECT（fail-closed，不引入测速延迟偏差），
 * 其余组（select/selector 等手动选择）补 REJECT + DIRECT。
 * @param {string[]} members
 * @param {string} [groupType] 组类型；未知类型按手动选择类处理
 * @returns {string[]}
 */
export function withPolicyFallbacks(members: any, groupType: any) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    const seen = new Set(list.map((member) => String(member).toUpperCase()));
    const fallbacks = isAutoGroupType(groupType) ? ['REJECT'] : FALLBACK_POLICY_MEMBERS;
    for (const fallback of fallbacks) {
        if (!seen.has(fallback)) {
            list.push(fallback);
            seen.add(fallback);
        }
    }
    return list;
}
