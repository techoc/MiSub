import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

/**
 * ESLint flat config（2026-11 引入）。
 *
 * 策略：先用宽松集（vue3-essential + js recommended）扫全仓库，
 * 未用变量等噪音规则降为 warn，不阻塞 CI；后续再逐步收紧。
 * 格式类规则一律交给 Prettier（见 .prettierrc.json / npm run format）。
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
    ...pluginVue.configs['flat/essential'],
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
        // 测试依赖 Vitest globals（见 vitest.config.js globals: true）
        files: ['tests/**/*.js'],
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
        files: ['functions/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js'],
        languageOptions: {
            globals: { ...globals.worker, ...globals.browser, ...globals.node },
        },
    },
    {
        files: ['tests/**/*.js', 'scripts/**/*.mjs'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        // vite/wrangler 等配置文件使用 Node 全局
        files: ['*.config.js', 'vite.config.js', 'vitest.config.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
