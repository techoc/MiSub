/**
 * 存储适配器 facade。
 *
 * 原单文件（~1100 行）按仓库惯例拆分为 ./storage-adapter/ 子模块：
 *   shared.js          —— 常量（键名/存储类型）、D1 集合缓存、KV 解析、schema 初始化
 *   kv-adapter.js      —— KVStorageAdapter
 *   d1-adapter.js      —— D1StorageAdapter
 *   noop-adapter.js    —— NoopStorageAdapter
 *   settings-cache.js  —— SettingsCache（10s isolate 内 memo）
 *   storage-factory.js —— StorageFactory
 *   data-migrator.js   —— DataMigrator 与迁移键定义
 * 本文件保留全部历史公共导出面（调用方与测试无需改动）；
 * 新增逻辑放进对应子模块，facade 只做再导出。
 */

export { STORAGE_TYPES } from './storage-adapter/shared.ts';
export { SettingsCache } from './storage-adapter/settings-cache.ts';
export { StorageFactory } from './storage-adapter/storage-factory.ts';
export {
    DataMigrator,
    D1_MIGRATION_KEYS,
    D1_MIGRATION_KEY_PREFIXES,
} from './storage-adapter/data-migrator.ts';
