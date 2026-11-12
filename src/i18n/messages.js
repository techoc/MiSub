/**
 * i18n 文案兼容 barrel(静态合并全部语言)。
 *
 * 生产运行时不再从这里读取:src/i18n/index.js 中 zh-CN 静态打包、en-US
 * 动态 import 懒加载,避免两种语言全量进首屏 bundle。本文件仅供测试与
 * 脚本(需要一次性拿到全部语言)使用;若测试改用 registerLocaleMessages
 * 预注入,可逐步移除该静态合并。
 */
import zhCN from './locales/zh-CN.js';
import enUS from './locales/en-US.js';

export const messages = {
    'zh-CN': zhCN,
    'en-US': enUS,
};
