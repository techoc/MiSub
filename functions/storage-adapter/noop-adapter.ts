/**
 * 无存储降级适配器（无可用持久化存储时，不读写持久数据）。
 * facade 拆分：原 storage-adapter.js 的 NoopStorageAdapter。
 */

/**
 * 无存储降级适配器（无可用持久化存储时，不读写持久数据）
 */
export class NoopStorageAdapter {
    async get() {
        return null;
    }
    async put() {
        return true;
    }
    async delete() {
        return true;
    }
    async list() {
        return [];
    }
    async getAllSubscriptions() {
        return [];
    }
    async getAllProfiles() {
        return [];
    }
    // 批量写接口与 put() 语义保持一致：无存储时视为成功、不落盘。
    // （telegram 回调流程会调用 putAll*；此前缺失会让该路径抛 TypeError，
    //  put() 一直是静默成功的，对齐之。）
    async putAllSubscriptions() {
        return true;
    }
    async putAllProfiles() {
        return true;
    }
}
