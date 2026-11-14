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

/** 订阅流量信息（后端 userInfo / 订阅头解析产物） */
export interface SubscriptionUserInfo {
    upload?: number;
    download?: number;
    total?: number;
    /** 到期时间戳（秒） */
    expire?: number;
    [key: string]: any;
}

/** 订阅条目（KV misub_subscriptions_v1 / profiles 内的元素，或手动节点） */
export interface SubscriptionItem {
    id: string;
    name: string;
    /** 手动节点：协议分享链接或节点说明；远程订阅：订阅 URL */
    url?: string;
    /** 'manual' 等来源标记 */
    type?: string;
    enabled?: boolean;
    customId?: string;
    description?: string;
    remark?: string;
    note?: string;
    website?: string;
    nodeCount?: number;
    userInfo?: SubscriptionUserInfo | null;
    lastError?: string | null;
    error?: string | null;
    errorType?: string | null;
    lastFetchedAt?: string | number | null;
    /** 机场身份：把同一机场的多个订阅归入一个显示组（前端派生，不落库） */
    airportIdentity?: { groupId: string; name: string } | null;
    /** 前端瞬时态：保存前会被剥离（不落库） */
    isUpdating?: boolean;
    enableNodeCache?: boolean;
    excludeTraffic?: boolean;
    fetchProxy?: string;
    plusAsSpace?: boolean;
    customUserAgent?: string;
    /** 长尾字段随协议/版本扩展 */
    [key: string]: any;
}

/** 尚未落库的订阅草稿：id 由后端保存流程补齐 */
export type SubscriptionDraft = Omit<SubscriptionItem, 'id'> & { id?: string };

/** 订阅分组（KV misub_profiles_v1 中的元素） */
export interface ProfileItem {
    id: string;
    name: string;
    customId?: string;
    enabled?: boolean;
    /** 引用的远程订阅 id 列表（也兼容内联对象的历史格式） */
    subscriptions?: Array<string | SubscriptionItem>;
    /** 引用的手动节点（订阅条目）id 列表 */
    manualNodes?: Array<string | SubscriptionItem>;
    /** 嵌套订阅组 id 列表 */
    subProfiles?: string[];
    ruleLevel?: string;
    clashRuleLevel?: string;
    expiresAt?: string | number | null;
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

/** 尚未落库的分组草稿：id 由保存流程生成 */
export type ProfileDraft = Omit<ProfileItem, 'id'> & { id?: string };

/** KV 读出的通用记录形状 */
export type KvRecord = Record<string, any>;
