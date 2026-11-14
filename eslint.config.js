import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ESLint flat config（2026-11 引入，2026-11-14 随 TypeScript 迁移扩展）。
 *
 * 策略：先用宽松集（vue3-essential + js/ts recommended）扫全仓库，
 * 未用变量等噪音规则降为 warn，不阻塞 CI；后续再逐步收紧。
 * 格式类规则一律交给 Prettier（见 .prettierrc.json / npm run format）。
 *
 * TS 迁移期形态：.js（测试/脚本）沿用 JS 规则；functions/src 的 .ts 与
 * lang="ts" 的 .vue 走 typescript-eslint（非类型感知层，保持 lint 速度）。
 * 类型正确性由 vue-tsc / tsc 的 `npm run typecheck` 负责。
 */
export default [
    {
        ignores: [
            'dist/**',
            'dev-dist/**',
            'node_modules/**',
            'coverage/**',
            '.wrangler/**',
            '.idea/**',
        ],
    },
    js.configs.recommended,
    // TS 规则仅作用于 .ts / .vue（.vue 由 plugin-vue 的 parser 接管，TS parser 作为子 parser）
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: ['**/*.ts', '**/*.vue'],
    })),
    ...pluginVue.configs['flat/essential'],
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: {
                parser: tseslint.parser,
                extraFileExtensions: ['.vue'],
                sourceType: 'module',
            },
        },
    },
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        rules: {
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
        },
    },
    {
        // TS 规则覆盖块：必须位于上方通用块之后，才能覆盖其 no-unused-vars 等设置。
        // TS 的类型检查已覆盖部分核心规则，交给 @typescript-eslint/* 对应版本。
        files: ['**/*.ts', '**/*.vue'],
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            // 务实策略：动态对象（YAML 生成等）允许受控 any，先记录为技术债
            '@typescript-eslint/no-explicit-any': 'warn',
            // 与既有 JS 基线一致：噪音类规则降为 warn，不阻塞 CI
            'prefer-const': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
        },
    },
    {
        rules: {
            // App.vue、测试里的 Draggable stub 等单词名是既有约定，不作为问题
            'vue/multi-word-component-names': 'off',
            // 既有代码大量通过 props 对象字段直改（134 处），一次性修复风险过高，
            // 先降为 warn 记录为技术债，逐步收敛。
            'vue/no-mutating-props': 'warn',
        },
    },
    {
        // 测试依赖 Vitest globals（见 vitest.config.ts globals: true）
        files: ['tests/**/*.js', 'tests/**/*.ts'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                vi: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
    },
    {
        // Cloudflare Workers / Pages Functions 运行时全局（fetch、caches、crypto 等）
        files: ['functions/**/*.js', 'functions/**/*.ts', 'scripts/**/*.mjs', 'scripts/**/*.js'],
        languageOptions: {
            globals: { ...globals.worker, ...globals.browser, ...globals.node },
        },
    },
    {
        files: ['tests/**/*.js', 'tests/**/*.ts', 'scripts/**/*.mjs', 'scripts/**/*.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        // vite/wrangler 等配置文件使用 Node 全局
        files: ['*.config.js', '*.config.ts', 'vite.config.*', 'vitest.config.*'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
