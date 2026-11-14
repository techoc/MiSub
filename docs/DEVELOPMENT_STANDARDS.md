---
title: Development Standards
created: 2026-09-06
updated: 2026-09-06
type: architecture
status: active
tags: [misub, architecture, frontend, backend, standards, conventions, testing]
sources: [package.json, src, functions, tests/unit]
related:
    [architecture/module-map, architecture/frontend-visual-system, SCHEMA, api/frontend-api-usage]
---

# Development Standards

## Purpose

MiSub 前后端开发规范。所有新代码与重构应遵循本页约定；与既有代码冲突时，以本页为准并顺手修正旧代码（小步、可逆）。

## When to Read This

- 新增前端组件 / 页面 / store / composable。
- 新增后端模块 / handler / service / utility。
- 编写或修改测试。
- 提交前自查格式与结构。

## Code Style（前端 + 后端）

### 强制约定（现状已高度一致，需保持）

- **单引号**：字符串一律单引号（173/180 文件已符合）。
- **分号**：语句以分号结尾（159/180 文件已符合；新代码必须带分号）。
- **缩进**：4 空格（与 `.prettierrc.json` 的 `tabWidth: 4`、`.editorconfig` 一致，`npm run format` 统一处理）。
- **命名**：文件/目录 kebab-case；函数/变量 camelCase；常量 UPPER_SNAKE；组件 PascalCase。
- **ESM**：统一 `import` / `export`，不使用 CommonJS（`require` / `module.exports`）。
- **无 TODO/FIXME 残留**：合并前清空。

### 尚未引入的自动化

- **自动化已就位**：ESLint（flat config，`npm run lint`）+ Prettier（`.prettierrc.json`，`npm run format`）+ EditorConfig。提交前跑 `npm run lint` 与 `npm run format:check`。如需批量统一历史文件，先引入工具 + 配置，再跑全量测试验证无行为变化，最后单独提交。

## TypeScript

- 项目为纯 TypeScript：`functions/` 与 `src/` 全部 `.ts`，Vue SFC 用 `<script setup lang="ts">`；仅 `tests/` 保持 `.js`（import 说明符显式带 `.ts` 后缀）。
- 类型检查：`npm run typecheck`（`vue-tsc` 覆盖 src + .vue；`tsc` 覆盖 functions），**必须 0 错误**。
- 严格度：`strict: true` 全量开启（含 `noImplicitAny`）。隐式 any 必须显式标注 `: any`，不得靠关闭规则兜底。
- 类型边界：
    - 后端入口/上下文用 `types/functions-env.d.ts` 的 `Env` / `PagesEventContext`。
    - 共享模型放 `types/models.ts`（已知字段精确 + `[key: string]: any` 长尾）。
- 务实标注（迁移债）：`as Record<string, any>`、非空断言 `!`、参数 `: any` 是已接受的现状；**新增代码优先写真实类型**，改动某文件时顺手收紧该文件的标注，不做全仓批量重写。

## Frontend Structure

- Vue 3 SFC，**一律 `<script setup lang="ts">`**（131/131 已符合）；SFC 脚本与 `src/` 下代码一律 TypeScript。
- 组件目录职责：
    - `src/components/ui/*`：基础原子组件（Button、Input），**禁止在业务页面复制一套按钮/输入框风格**。
    - `src/components/shared/*`：共享复合组件（FormModal）。
    - `src/components/features/*` / `modals/*` / `forms/*` / `layout/*` / `nodes/*` / `profiles/*` / `settings/*` / `subscriptions/*` / `public/*`：按业务域组织。
- 页面在 `src/views/*`，路由在 `src/router/index.ts`。
- 状态用 Pinia（`src/stores/*`）；可复用逻辑放 composable（`src/composables/*`）。
- API 调用统一走 `src/lib/api.ts` + `src/constants/api-endpoints.ts` 常量，**禁止在组件里硬编码 API 路径字面量**。
- i18n 文案统一进 `src/i18n/messages.ts`；语言切换只改文字，不改布局/样式/结构。
- 样式用 Tailwind（`src/assets/main.css` 定义 token）；组件样式尽量 scoped。视觉约束详见 [[architecture/frontend-visual-system]]。

## Backend Structure

- Cloudflare Pages Functions，入口 `functions/[[path]].ts`。
- 分层职责：
    - `functions/modules/handlers/*`：API controller（HTTP 语义、入参校验、响应组装）。
    - `functions/modules/subscription/*`：订阅链路专用模块（转换、缓存、预览、UA、DNS、分组）。
    - `functions/modules/*.ts`：路由 / 鉴权 / 外部 API / 工具。
    - `functions/services/*`：跨模块业务服务（订阅核心、渲染编排、日志、通知）。
    - `functions/utils/*` + `functions/modules/utils/*`：纯工具函数，无副作用。
- 数据访问统一走 `functions/storage-adapter.ts`（KV/D1 抽象），**禁止直接调 `env.KV` / `env.DB`**。
- 订阅输出格式差异隔离在 transformer/generator/renderer 层。
- 超过 ~800 行的文件应拆（当前最大 `handlers/telegram-webhook-handler.ts`（facade + telegram-webhook/ 子模块）为拆分候选）。

## Testing

- 测试文件统一放 `tests/unit/*.test.js`，kebab-case 命名。
- 行为变更用 TDD：先写复现失败的测试，再修复，再跑针对性测试。
- 涉及外部资源（订阅 URL、cookie、token、webhook）必须用 sanitized fixtures，**禁止真实凭据进测试/提交**。
- 提交前必跑：
    - `npm run typecheck`（0 错误）
    - `npm run test:run`（全量，须全绿）
    - `npm run lint`（0 error；warning 为已知技术债）
    - `npm run build`

## Git / Commit

- 小步提交：一个逻辑变更一个 commit，message 用 `fix:` / `feat:` / `refactor:` / `docs:` / `test:` 前缀。
- 行为变更 + 文档变更可分两个 commit。
- 推送 `origin/main` 前确认 `git status` 干净、全量测试通过。

## Related

- [[architecture/module-map]]
- [[architecture/frontend-visual-system]]
- [[SCHEMA]]
- [[api/frontend-api-usage]]
