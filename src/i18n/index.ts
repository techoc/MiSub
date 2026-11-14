import type { App, Ref } from 'vue';
import { computed, inject, readonly, ref } from 'vue';
import { readRawPreference, writeRawPreference } from '../utils/local-preference.ts';
import zhCN from './locales/zh-CN.ts';

/** 语言包：嵌套文案（叶子为字符串） */
export interface LocaleMessages {
    [key: string]: string | LocaleMessages;
}

/** 翻译参数 */
export type TranslateParams = Record<string, unknown>;

export const DEFAULT_LOCALE = 'zh-CN';
export const LOCALE_STORAGE_KEY = 'misub:locale';
export const SUPPORTED_LOCALES = [
    { code: 'zh-CN', label: '简体中文' },
    { code: 'en-US', label: 'English' },
];

const supportedCodes = new Set(SUPPORTED_LOCALES.map((item) => item.code));
const I18N_KEY = Symbol('misub-i18n');

// zh-CN 是默认语言，静态打包进首屏；其余语言按需动态 import，
// 不进首屏 bundle（约省一半文案体积）。t() 在模板渲染中调用时会读取
// runtimeMessages ref，语言包加载完成后触发依赖它的组件重渲染；
// 未加载完成期间 translate 的 ?? 回退到默认语言文案。
const runtimeMessages = ref<Record<string, LocaleMessages>>({ 'zh-CN': zhCN });
const loadedLocales = new Set(['zh-CN']);
const localeLoaders = new Map<string, Promise<void>>();

/**
 * 直接注入某个语言的文案（替换式覆盖）。
 * 生产链路由 ensureLocaleMessages 使用；tests/setup.js 也用它静态预注入
 * en-US，因为大量测试同步断言英文文案，无法等待异步加载。
 */
export function registerLocaleMessages(locale: unknown, messages: LocaleMessages) {
    const normalized = normalizeLocale(locale);
    loadedLocales.add(normalized);
    runtimeMessages.value = { ...runtimeMessages.value, [normalized]: messages };
}

/**
 * 确保某语言包已加载（已加载/正在加载时立即 resolve）。
 * 失败时清除加载记录，下次切换可重试；期间 t() 回退默认语言。
 */
export function ensureLocaleMessages(locale: unknown): Promise<void> {
    const normalized = normalizeLocale(locale);
    if (loadedLocales.has(normalized)) return Promise.resolve();
    if (!localeLoaders.has(normalized)) {
        localeLoaders.set(
            normalized,
            import(`./locales/${normalized}.ts`)
                .then((mod) => registerLocaleMessages(normalized, mod.default))
                .catch((error) => {
                    console.warn(`[i18n] Failed to load locale ${normalized}:`, error);
                    localeLoaders.delete(normalized);
                })
        );
    }
    return localeLoaders.get(normalized) ?? Promise.resolve();
}

function readStoredLocale(): string {
    return readRawPreference(LOCALE_STORAGE_KEY) || '';
}

function writeStoredLocale(locale: string) {
    // 写入失败（隐私模式 / 存储被禁用）只影响「下次启动的语言」，
    // 本次切换已经生效，不需要打扰用户。
    writeRawPreference(LOCALE_STORAGE_KEY, locale);
}

export function hasStoredLocale() {
    return supportedCodes.has(readStoredLocale());
}

export function normalizeLocale(locale: unknown): string {
    if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
    if (supportedCodes.has(locale)) return locale;
    const lower = locale.toLowerCase();
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('en')) return 'en-US';
    return DEFAULT_LOCALE;
}

export function detectInitialLocale(browserLanguages: unknown[] = []) {
    const stored = readStoredLocale();
    if (supportedCodes.has(stored)) return stored;

    const candidates: unknown[] =
        Array.isArray(browserLanguages) && browserLanguages.length > 0
            ? browserLanguages
            : typeof navigator !== 'undefined'
              ? [navigator.language, ...(navigator.languages || [])]
              : [];

    for (const candidate of candidates) {
        const normalized = normalizeLocale(candidate);
        if (supportedCodes.has(normalized) && normalized !== DEFAULT_LOCALE) return normalized;
    }

    return DEFAULT_LOCALE;
}

function lookupMessage(locale: string, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (!current || typeof current !== 'object') return undefined;
        return (current as Record<string, unknown>)[part];
    }, runtimeMessages.value[locale]);
}

function interpolate(template: string, params: TranslateParams = {}): string {
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** i18n 实例（供 app.use 安装） */
export interface I18nInstance {
    locale: Ref<string>;
    supportedLocales: typeof SUPPORTED_LOCALES;
    t: (key: string, params?: TranslateParams, forcedLocale?: string) => string;
    setLocale: (nextLocale: unknown) => void;
    install(app: App): void;
}

export function createI18n(options: Record<string, unknown> = {}): I18nInstance {
    const locale = ref(normalizeLocale(options.initialLocale || detectInitialLocale()));
    // 初始语言若非默认语言（例如浏览器语言/存储偏好是 en-US），立刻开始加载其语言包
    ensureLocaleMessages(locale.value);

    const translate = (
        key: string,
        params: TranslateParams = {},
        forcedLocale?: string
    ): string => {
        const targetLocale = normalizeLocale(forcedLocale || locale.value);
        const resolved = lookupMessage(targetLocale, key) ?? lookupMessage(DEFAULT_LOCALE, key);
        if (typeof resolved !== 'string') return key;
        return interpolate(resolved, params);
    };

    const set = (nextLocale: unknown) => {
        const normalized = normalizeLocale(nextLocale);
        ensureLocaleMessages(normalized);
        locale.value = normalized;
        writeStoredLocale(normalized);
        if (typeof document !== 'undefined') {
            document.documentElement.lang = normalized;
        }
    };

    const instance: I18nInstance = {
        locale,
        supportedLocales: SUPPORTED_LOCALES,
        t: translate,
        setLocale: set,
        install(app: App) {
            app.provide(I18N_KEY, instance);
            app.config.globalProperties.$t = translate;
            app.config.globalProperties.$locale = readonly(locale);
            if (typeof document !== 'undefined') {
                document.documentElement.lang = locale.value;
            }
        },
    };

    return instance;
}

export const i18n = createI18n();

export function t(key: string, params: TranslateParams = {}, forcedLocale?: string): string {
    return i18n.t(key, params, forcedLocale);
}

export function setLocale(locale: unknown) {
    i18n.setLocale(locale);
}

export function useI18n() {
    const instance = inject(I18N_KEY, i18n);
    return {
        locale: instance.locale,
        supportedLocales: instance.supportedLocales,
        t: instance.t,
        setLocale: instance.setLocale,
        currentLocaleLabel: computed(
            () =>
                SUPPORTED_LOCALES.find((item) => item.code === instance.locale.value)?.label ||
                instance.locale.value
        ),
    };
}
