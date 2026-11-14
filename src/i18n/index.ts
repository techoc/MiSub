import { computed, inject, readonly, ref } from 'vue';
import { readRawPreference, writeRawPreference } from '../utils/local-preference.ts';
import zhCN from './locales/zh-CN.ts';

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
const runtimeMessages = ref({ 'zh-CN': zhCN });
const loadedLocales = new Set(['zh-CN']);
const localeLoaders = new Map();

/**
 * 直接注入某个语言的文案（替换式覆盖）。
 * 生产链路由 ensureLocaleMessages 使用；tests/setup.js 也用它静态预注入
 * en-US，因为大量测试同步断言英文文案，无法等待异步加载。
 */
export function registerLocaleMessages(locale, messages) {
    const normalized = normalizeLocale(locale);
    loadedLocales.add(normalized);
    runtimeMessages.value = { ...runtimeMessages.value, [normalized]: messages };
}

/**
 * 确保某语言包已加载（已加载/正在加载时立即 resolve）。
 * 失败时清除加载记录，下次切换可重试；期间 t() 回退默认语言。
 */
export function ensureLocaleMessages(locale) {
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
    return localeLoaders.get(normalized);
}

function readStoredLocale() {
    return readRawPreference(LOCALE_STORAGE_KEY) || '';
}

function writeStoredLocale(locale) {
    // 写入失败（隐私模式 / 存储被禁用）只影响「下次启动的语言」，
    // 本次切换已经生效，不需要打扰用户。
    writeRawPreference(LOCALE_STORAGE_KEY, locale);
}

export function hasStoredLocale() {
    return supportedCodes.has(readStoredLocale());
}

export function normalizeLocale(locale) {
    if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
    if (supportedCodes.has(locale)) return locale;
    const lower = locale.toLowerCase();
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('en')) return 'en-US';
    return DEFAULT_LOCALE;
}

export function detectInitialLocale(browserLanguages: any[] = []) {
    const stored = readStoredLocale();
    if (supportedCodes.has(stored)) return stored;

    const candidates =
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

function lookupMessage(locale, key) {
    return key.split('.').reduce((current, part) => {
        if (!current || typeof current !== 'object') return undefined;
        return current[part];
    }, runtimeMessages.value[locale]);
}

function interpolate(template, params: Record<string, any> = {}) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export function createI18n(options: Record<string, any> = {}) {
    const locale = ref(normalizeLocale(options.initialLocale || detectInitialLocale()));
    // 初始语言若非默认语言（例如浏览器语言/存储偏好是 en-US），立刻开始加载其语言包
    ensureLocaleMessages(locale.value);

    const translate = (key, params = {}, forcedLocale) => {
        const targetLocale = normalizeLocale(forcedLocale || locale.value);
        const resolved = lookupMessage(targetLocale, key) ?? lookupMessage(DEFAULT_LOCALE, key);
        return resolved === undefined ? key : interpolate(resolved, params);
    };

    const set = (nextLocale) => {
        const normalized = normalizeLocale(nextLocale);
        ensureLocaleMessages(normalized);
        locale.value = normalized;
        writeStoredLocale(normalized);
        if (typeof document !== 'undefined') {
            document.documentElement.lang = normalized;
        }
    };

    const instance = {
        locale,
        supportedLocales: SUPPORTED_LOCALES,
        t: translate,
        setLocale: set,
        install(app) {
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

export function t(key, params: Record<string, any> = {}, forcedLocale?: string) {
    return i18n.t(key, params, forcedLocale);
}

export function setLocale(locale) {
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
