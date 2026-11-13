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
}
