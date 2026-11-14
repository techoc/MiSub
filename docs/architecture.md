# MiSub 架构说明

本文档记录 MiSub 当前代码库的真实结构与运行链路，用于新功能开发、问题排查和后续重构定位。本文不记录历史变更流水账；如代码发生结构调整，应同步更新本文档。

## 1. 项目定位

MiSub 是一个部署在 Cloudflare Pages Functions 上的订阅管理与转换工作台。

它的核心职责是：

- 管理机场订阅、手动节点和订阅分组（Profile）
- 拉取、缓存、清洗、重命名、过滤、排序和去重节点
- 根据客户端或 URL 参数生成不同订阅格式
- 提供公开订阅页、管理后台、调试接口和通知能力

当前技术栈：

- 前端：Vue 3、Vite、Pinia、Vue Router、Tailwind CSS
- 后端：Cloudflare Pages Functions，ES Modules
- 存储：Cloudflare KV 或 D1，通过统一适配层访问
- 测试：Vitest、@vue/test-utils、happy-dom、Miniflare

## 2. 顶层目录

```text
MiSub/
├── functions/             # Cloudflare Pages Functions 后端
├── src/                   # Vue 前端应用
├── tests/unit/            # 单元与回归测试
├── docs/                  # 项目文档
├── public/                # 静态资源
├── images/                # README 截图资源
├── scripts/               # 辅助脚本
├── package.json           # npm 脚本和依赖
├── vite.config.js         # Vite 构建配置
├── vitest.config.js       # Vitest 测试配置
├── wrangler-cf-pages.toml # Cloudflare Pages 本地/部署配置
└── schema.sql             # D1 表结构参考
```

常用命令：

```bash
npm run dev          # 启动 Vite 前端开发服务
npm run dev:server   # 启动 Wrangler Pages Functions 本地服务
# 如需同时启动，分别在两个终端运行以上两个命令
npm run build        # 构建前端
npm run test:run     # 运行测试
```

## 3. 后端总入口与路由分发

后端总入口是：

```text
functions/[[path]].ts
```

该文件负责 Cloudflare Pages Functions 的顶层请求分发：

```text
HTTP Request
└── functions/[[path]].ts:onRequest(context)
    ├── /api/*                         → functions/modules/api-router.ts
    ├── /sub/*                         → functions/modules/subscription-handler.ts
    ├── /<mytoken>/*, /<profileToken>/* → functions/modules/subscription-handler.ts
    ├── /cron                          → functions/modules/notifications.ts
    └── 其他路径                        → SPA 静态资源、公开页或伪装页
```

顶层入口还负责：

- 读取设置并执行设置迁移
- 判断自定义订阅 token 路由
- 处理本地开发时的 SPA fallback
- 应用 CORS、CSRF Origin 和安全响应头中间件
- 对 HTML 响应设置 no-store 缓存头

相关文件：

```text
functions/middleware/cors.ts
functions/modules/disguise-page.ts
functions/modules/handlers/disguise-handler.ts
functions/modules/notifications.ts
```

## 4. API 路由层

API 路由集中在：

```text
functions/modules/api-router.ts
```

它根据 `/api` 后的路径分发到各业务 handler。

公开或半公开接口包括：

```text
/api/login
/api/logout
/api/public_config
/api/config
/api/public/profiles
/api/public/preview
/api/public/guestbook
/api/telegram/webhook
/api/system/error_report
/api/clients/*
/api/github/release
```

需要登录态的管理接口包括：

```text
/api/data
/api/misubs
/api/settings
/api/settings/reset
/api/rule_templates
/api/node_count
/api/subscription_nodes
/api/batch_update_nodes
/api/clean_nodes
/api/debug_subscription
/api/system/info
/api/storage/test
/api/export_data
/api/migrate
/api/migrate_to_d1
/api/detect_legacy_d1
/api/migrate_legacy_d1
```

主要 handler 文件：

```text
functions/modules/api-handler.ts                  # 数据、设置、公开配置、密码更新
functions/modules/auth-middleware.ts              # 登录态、cookie、密码校验
functions/modules/rule-template-handler.ts        # 自定义规则模板
functions/modules/handlers/node-handler.ts        # 节点数量、批量刷新、节点清理、健康检查
functions/modules/handlers/debug-handler.ts       # 调试、系统信息、导出、预览内容
functions/modules/handlers/client-handler.ts      # 客户端配置接口
functions/modules/handlers/guestbook-handler.ts   # 留言板
functions/modules/handlers/telegram-webhook-handler.ts
functions/modules/handlers/github-proxy-handler.ts
functions/modules/handlers/error-report-handler.ts
```

## 5. 存储模型

存储抽象层是：

```text
functions/storage-adapter.ts
```

MiSub 支持两种存储后端：

- KV：以 JSON 数组/对象存储整体数据
- D1：以行级记录存储 subscriptions、profiles、settings 等数据

统一入口是 `StorageFactory`，业务代码应优先通过 storage adapter 读写数据，避免直接操作 KV 或 D1。

主要数据键：

```text
misub_subscriptions_v1                 # 订阅列表
misub_profiles_v1                      # Profile 列表
worker_settings_v1                     # 设置
misub_guestbook_v1                     # 留言板
misub_profile_download_count_<profile> # Profile 下载次数
```

默认设置定义在：

```text
functions/modules/config.ts
```

其中包括：

- 订阅 token 与 profile token
- 内置模板和第三方转换后端设置
- 节点前缀、国旗、操作符链、缓存、通知、公开页、留言板等开关
- 默认 UA 和系统常量

## 6. 订阅生成主链路

订阅输出的核心入口是：

```text
functions/modules/subscription-handler.ts
functions/modules/subscription/main-handler.ts
```

核心链路：

```text
订阅请求
└── handleMisubRequest(context)
    ├── resolveRequestContext()       # 解析 URL、UA、target、profile、缓存参数等
    ├── 读取 settings / profiles / subscriptions
    ├── resolveNodeListWithCache()    # 根据配置读缓存或生成节点
    ├── generateCombinedNodeList()    # 拉取并合并节点
    ├── ProcessorService              # 节点后处理
    ├── 判断目标格式                   # UA 和 URL 参数共同决定
    ├── 内置生成器或外部 subconverter
    ├── 写入缓存、访问日志、下载计数
    └── 返回订阅响应
```

关键文件：

```text
functions/modules/subscription/request-context.ts
functions/modules/subscription/cache-manager.ts
functions/services/subscription-service.ts
functions/services/processor-service.ts
functions/modules/subscription/user-agent-utils.ts
functions/modules/subscription/profile-handler.ts
functions/modules/subscription/single-subscription.ts
functions/modules/subscription/preview-handler.ts
functions/modules/subscription/node-fetcher.ts
```

订阅模式主要包括：

- Profile 模式：按订阅分组生成完整输出
- 单订阅模式：对某一个订阅生成输出
- Direct URL 模式：直接对 URL 生成预览或输出
- Public Preview 模式：公开页使用的节点预览

## 7. 节点获取、缓存与保护性缓存

订阅源拉取入口：

```text
functions/modules/subscription/node-fetcher.ts
functions/services/subscription-service.ts
```

相关能力：

- 自定义 User-Agent
- Clash 专用链接 UA 适配
- Fetch Proxy 转发
- 订阅流量信息解析
- 临时拉取失败时的保护性缓存
- 节点数量和错误信息反馈

Fetch Proxy URL 构建逻辑在：

```text
functions/utils/fetch-proxy-utils.ts
```

节点缓存服务在：

```text
functions/services/node-cache-service.ts
```

缓存相关设置包括：

```text
enableSubscriptionSync
subscriptionCacheExpireMinutes
maxSubscriptionConcurrency
```

## 8. 节点解析与协议转换

节点解析、协议转换和格式互转是 MiSub 的核心复杂区。

主要文件：

```text
functions/modules/utils/node-parser.ts     # 订阅内容解析，含 Clash YAML → 节点 URL
functions/utils/clash-to-url.ts            # Clash proxy 对象 → 节点 URL
functions/utils/url-to-clash.ts            # 节点 URL → Clash proxy / Clash config
functions/utils/xhttp-extra.ts              # xHTTP extra ↔ Clash xhttp-opts 字段双向映射
functions/utils/node-utils.ts              # 节点命名、国旗、编码修正、YAML 安全处理
functions/utils/node-transformer.ts        # 节点 record 化、过滤、重命名、排序、去重
functions/utils/operator-runner.ts         # 新版操作符链执行
functions/utils/format-utils.ts            # UA/URL 格式判断辅助
```

当前支持的常见协议包括：

```text
ss, ssr, vmess, vless, trojan, hysteria, hysteria2, tuic,
snell, anytls, socks, wireguard, naive
```

开发协议相关修复时，应优先补充回归测试，覆盖至少一个完整回环：

```text
输入订阅内容
→ 解析为节点 URL
→ 转换为目标客户端对象或配置
→ 验证关键字段未丢失
```

## 9. 内置模板与目标格式输出

目标格式判断主要由 URL 参数和 User-Agent 决定。

UA 判断相关文件：

```text
functions/modules/subscription/user-agent-utils.ts
```

内置生成器：

```text
functions/modules/subscription/builtin-clash-generator.ts
functions/modules/subscription/builtin-singbox-generator.ts
functions/modules/subscription/builtin-surge-generator.ts
functions/modules/subscription/builtin-loon-generator.ts
functions/modules/subscription/builtin-quanx-generator.ts
functions/modules/subscription/builtin-egern-generator.ts
```

模板管线：

```text
functions/modules/subscription/template-pipeline.ts
functions/modules/subscription/template-model.ts
functions/modules/subscription/template-processor.ts
functions/modules/subscription/template-parsers/ini-template-parser.ts
functions/modules/subscription/template-renderers/
functions/modules/subscription/builtin-template-registry.ts
functions/modules/subscription/template-compatibility.ts
```

外部转换后端相关逻辑在：

```text
functions/modules/subscription/main-handler.ts
functions/modules/subscription/transform-template-cache.ts
functions/modules/subscription/transform-template-renderer.ts
```

内置模板是 MiSub 当前最可控的完整配置输出路径。外部后端适合作为兼容补充，但不应承担 MiSub 内部节点处理的主责。

## 10. 操作符链与节点后处理

新版节点处理以操作符链为中心，默认设置字段是：

```text
defaultOperators
```

旧字段仍存在，用于兼容：

```text
defaultNodeTransform
```

主要处理能力：

- include / exclude 过滤
- 协议过滤
- 地区过滤
- JS 表达式过滤或命名
- 正则重命名
- 模板重命名
- 排序
- 去重
- 无效节点清理

相关文件：

```text
functions/utils/operator-runner.ts
functions/utils/node-transformer.ts
functions/services/processor-service.ts
src/components/features/Operators/OperatorChain.vue
```

## 11. 前端应用结构

前端入口：

```text
src/main.ts
src/App.vue
src/router/index.ts
```

主要路由：

```text
/                         # 首页/公开入口包装页
/explore                  # 公开页
/dashboard                # 仪表盘
/dashboard/groups         # 订阅组
/dashboard/nodes          # 手动节点
/dashboard/subscriptions  # 我的订阅
/dashboard/settings       # 设置
/:pathMatch(.*)*          # 自定义登录路径或 404 入口
```

前端 API 封装：

```text
src/lib/http.ts
src/lib/api.ts
src/constants/api-endpoints.ts
```

主要状态 store：

```text
src/stores/useDataStore.ts # subscriptions、profiles、settings、保存状态
src/stores/session.ts      # 登录态、公开配置、初始数据
src/stores/theme.ts        # 主题
src/stores/toast.ts        # Toast
src/stores/ui.ts           # 布局状态
src/stores/version.ts      # 版本检查
```

主要业务 composables：

```text
src/composables/useSubscriptions.ts
src/composables/useProfiles.ts
src/composables/useManualNodes.ts
src/composables/useNodePreview.ts
src/composables/useSettingsLogic.ts
src/composables/useBulkImportLogic.ts
```

## 12. 前端组件分区

组件按功能大致分为：

```text
src/components/features/       # 仪表盘、公告、操作符链等业务组件
src/components/forms/          # 表单、模态框基础能力
src/components/layout/         # Header、Footer、导航、布局骨架
src/components/modals/         # 登录、订阅编辑、Profile、预览、导入等弹窗
src/components/nodes/          # 手动节点管理
src/components/profiles/       # Profile 卡片和面板
src/components/public/         # 公开页组件
src/components/settings/       # 设置页分区
src/components/shared/         # 通用表格、筛选、拖拽列表等
src/components/subscriptions/  # 订阅面板
src/components/ui/             # Button、Card、Input、Toast 等基础 UI
```

复杂度较高、改动需谨慎的组件：

```text
src/components/modals/NodePreview/NodePreviewModal.vue
src/components/modals/SubscriptionEditModal.vue
src/components/modals/ProfileModal.vue
src/components/settings/sections/ClientSettings.vue
src/stores/useDataStore.ts
src/composables/useSubscriptions.ts
```

## 13. 测试布局

测试集中在：

```text
tests/unit/
```

当前重点测试类型：

- 订阅请求回归：`misub-request-regression.test.js`
- 模板管线：`template-pipeline.test.js`
- 内置生成器：`builtin-*-generator.test.js`
- 协议转换：`protocolConverter.test.js`、`node-utils.test.js`、`node-transformer.test.js`
- UA 判断：`user-agent-utils.test.js`
- 存储：`storage-adapter-row-level.test.js`
- 安全：`security-hardening.test.js`
- Fetch Proxy：`fetch-proxy-utils.test.js`、`node-fetcher-fetch-proxy-ua.test.js`
- 前端组件回归：若干 `*.test.js`

推荐测试命令：

```bash
npm run test:run
npm run build
```

针对协议或订阅输出 bug，优先运行相关小测试，再运行更宽的订阅管线测试。例如：

```bash
npm run test:run -- tests/unit/node-utils.test.js tests/unit/template-pipeline.test.js tests/unit/misub-request-regression.test.js
```

## 14. 开发与排查建议

### 14.1 修订阅输出问题

优先定位请求属于哪种模式：

```text
Profile / Single Subscription / Direct URL / Public Preview
```

再沿链路检查：

```text
request-context
→ storage adapter
→ subscription-service
→ node-fetcher
→ node-parser
→ processor-service
→ target format resolver
→ builtin generator 或 external backend
```

### 14.2 修协议字段丢失问题

重点检查：

```text
Clash YAML → node-parser → clash-to-url → URL
URL → url-to-clash → builtin generator
```

必须补充字段保留测试，避免只修单向转换。

### 14.3 修前端保存或展示问题

重点检查：

```text
组件表单字段
→ composable
→ useDataStore
→ src/lib/api.ts
→ functions/modules/api-router.ts
→ storage-adapter
```

### 14.4 修 KV/D1 问题

优先通过 `StorageFactory` 和 adapter 层排查，不要在业务 handler 中直接绕过存储抽象。

### 14.5 修 Cloudflare 平台问题

需区分：

- Pages Functions 运行时限制
- KV 延迟和写入限制
- D1 结构与迁移状态
- Edge/Node 环境差异
- Fetch Proxy 是否真实转发 UA、响应头和纯 IP 请求

## 15. 当前主要治理方向

短期优先级：

1. 为真实 issue 补齐端到端回归测试
2. 统一协议字段保留测试，尤其是 Clash YAML 与 URL 互转
3. 保持内置生成器输出稳定，减少外部后端依赖导致的不可控问题
4. 让错误反馈更可诊断：上游拉取失败、格式识别失败、转换失败应返回可读原因

中期优先级：

1. 拆薄 `functions/modules/api-router.ts`
2. 拆薄 `functions/modules/subscription/main-handler.ts`
3. 收敛协议转换边界，减少前后端重复转换逻辑
4. 为 subscription、profile、settings 建立明确 schema 文档或运行时校验
5. 将 KV/D1 迁移和兼容逻辑从普通业务 handler 中进一步隔离

长期目标：

MiSub 应保持为一个清晰、可信、排错友好的订阅转换工作台。功能新增应优先服务于：

- 订阅是否能稳定拉取
- 节点字段是否不丢失
- 客户端链接是否明确可用
- 出错时用户是否知道错在哪里
- 维护者是否能快速定位问题所在链路
