/**
 * 拓扑图与循环依赖检测工具
 * 用于 Profile (我的订阅) 互相嵌套时的依赖安全校验
 */

/**
 * 检测将 candidateId 添加为 targetProfileId 的子订阅时，是否会导致循环依赖
 * @param {string} targetProfileId - 当前正在编辑的 Profile ID（新建时为 null 或空字符串）
 * @param {string} candidateId - 候选子 Profile ID
 * @param {Array} allProfiles - 所有 Profile 对象列表
 * @returns {boolean} true 表示会导致循环引用，必须禁止
 */
export function wouldCreateCycle(
    targetProfileId: unknown,
    candidateId: unknown,
    allProfiles: unknown[] = []
): boolean {
    if (!targetProfileId || !candidateId) return false;
    if (targetProfileId === candidateId) return true;

    const profileMap = new Map<string, Record<string, unknown>>();
    allProfiles.forEach((p) => {
        const record = p as Record<string, unknown> | null;
        if (record && record.id) profileMap.set(String(record.id), record);
        if (record && record.customId) profileMap.set(String(record.customId), record);
    });

    const targetProfile = profileMap.get(String(targetProfileId));
    const targetIds = new Set<string>([String(targetProfileId)]);
    if (targetProfile) {
        if (targetProfile.id) targetIds.add(String(targetProfile.id));
        if (targetProfile.customId) targetIds.add(String(targetProfile.customId));
    }

    const candidateProfile = profileMap.get(String(candidateId));
    if (candidateProfile) {
        if (candidateProfile.id && targetIds.has(String(candidateProfile.id))) return true;
        if (candidateProfile.customId && targetIds.has(String(candidateProfile.customId)))
            return true;
    }

    // 从 candidate 出发进行 BFS/DFS 遍历，查看其依赖链路上是否包含 target Profile
    const visited = new Set<string>();
    const queue: string[] = [String(candidateId)];

    while (queue.length > 0) {
        const currId = queue.shift();
        if (!currId) break;
        if (targetIds.has(currId)) return true;
        if (visited.has(currId)) continue;
        visited.add(currId);

        const curr = profileMap.get(currId);
        if (curr && Array.isArray(curr.subProfiles)) {
            for (const nextId of curr.subProfiles as unknown[]) {
                const nextKey = String(nextId);
                if (targetIds.has(nextKey)) return true;
                if (!visited.has(nextKey)) {
                    queue.push(nextKey);
                }
            }
        }
    }

    return false;
}
