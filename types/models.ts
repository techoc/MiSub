/**
 * MiSub 共享领域模型（务实类型策略）。
 *
 * 后端大量数据来自 KV / 订阅解析 / 客户端表单，字段集合随协议与版本扩展。
 * 策略：高频且语义稳定的字段给精确类型，长尾用显式索引签名兜住；
 * 这样能保住「已知字段拼错/类型错」的检查，又不把整条流水线钉死成 unknown。
 */

/** Clash/mihomo 风格代理节点对象（字段随协议而异，如 vless 的 flow/reality-opts 等） */
export interface ProxyNode {
    name: string;
    type: string;
    server: string;
    port: number;
    [key: string]: any;
}

/** 订阅条目（KV misub_subscriptions_v1 / profiles 内的元素，或手动节点） */
export interface SubscriptionItem {
    id: string;
    name: string;
    /** 手动节点：协议分享链接；远程订阅：订阅 URL */
    url?: string;
    [key: string]: any;
}

/** 订阅分组（KV misub_profiles_v1 中的元素） */
export interface ProfileItem {
    id: string;
    name: string;
    [key: string]: any;
}

/**
 * 全局设置（KV worker_settings_v1）。
 * 字段集合见 functions/modules/config.ts 的 DEFAULT_SETTINGS；
 * 这里只固定被广泛读取且类型稳定的字段。
 */
export interface MisubSettings {
    FileName?: string;
    mytoken?: string;
    profileToken?: string;
    transformConfigMode?: string;
    ruleLevel?: string;
    dnsMode?: string;
    storageType?: string;
    enableSubscriptionSync?: boolean;
    subscriptionCacheExpireMinutes?: number;
    enableAccessLog?: boolean;
    accessLogPersistenceMode?: string;
    generatorOptions?: {
        ipv6?: boolean;
        allowLan?: boolean;
        dns?: Record<string, any>;
        singbox?: Record<string, any>;
        [key: string]: any;
    };
    [key: string]: any;
}

/** KV 读出的通用记录形状 */
export type KvRecord = Record<string, any>;
