import { ref } from 'vue';
import { defineStore } from 'pinia';
import router from '../router';
import { fetchInitialData, login as apiLogin, fetchPublicConfig } from '../lib/api';
import { api } from '../lib/http.ts';
import { handleError } from '../utils/errorHandler.ts';
import { useDataStore } from './useDataStore';
import { t } from '../i18n/index.ts';

import type { KvRecord } from '../../types/models.ts';

/** 公开页配置 */
interface PublicConfig {
    enablePublicPage: boolean;
    isLoginPath: boolean;
    customLoginPath: string;
    customPage: {
        enabled: boolean;
        useDefaultLayout: boolean;
        allowExternalStylesheets: boolean;
        allowScripts: boolean;
        hideBranding: boolean;
        hideHeader: boolean;
        hideFooter: boolean;
    };
    [key: string]: unknown;
}

export const useSessionStore = defineStore('session', () => {
    const sessionState = ref('loading'); // loading, loggedIn, loggedOut
    const initialData = ref<unknown>(null);
    const subscriptionConfig = ref<Record<string, unknown>>({}); // [NEW] Added subscriptionConfig
    const securityWarning = ref<unknown>(null);
    const defaultPublicConfig = Object.freeze({
        enablePublicPage: true,
        isLoginPath: false,
        customLoginPath: 'login',
        customPage: {
            enabled: false,
            useDefaultLayout: true,
            allowExternalStylesheets: false,
            allowScripts: false,
            hideBranding: false,
            hideHeader: false,
            hideFooter: false,
        },
    });

    const disabledPublicConfig = Object.freeze({
        ...defaultPublicConfig,
        enablePublicPage: false,
    });

    const publicConfig = ref<PublicConfig>({
        ...defaultPublicConfig,
        customPage: { ...defaultPublicConfig.customPage },
    }); // Default true until fetched
    const hasLoadedPublicConfig = ref(false);

    async function checkSession() {
        // Parallel fetch of initial data (auth check) and public config
        const [dataResult, pConfigResult] = await Promise.all([
            fetchInitialData(),
            fetchPublicConfig(),
        ]);

        // Update public config
        if (pConfigResult.success) {
            publicConfig.value = pConfigResult.data as PublicConfig;
            hasLoadedPublicConfig.value = true;
        } else if (!hasLoadedPublicConfig.value) {
            // Fail closed on the first load; preserve a known-good config on later retries.
            publicConfig.value = {
                ...disabledPublicConfig,
                customPage: { ...disabledPublicConfig.customPage },
            };
        }

        if (dataResult.success) {
            const dataRecord = (dataResult.data || {}) as KvRecord;
            initialData.value = dataRecord;
            if (dataRecord.config) {
                subscriptionConfig.value = dataRecord.config as Record<string, unknown>;
            }

            // 直接注入数据到 dataStore，避免 Dashboard 重复请求
            const dataStore = useDataStore();
            dataStore.hydrateFromData(dataRecord);

            sessionState.value = 'loggedIn';
        } else {
            // Auth failed or other error
            if (dataResult.errorType === 'auth') {
                sessionState.value = 'loggedOut';
            } else {
                // Network or other error, still show logged out
                console.error('Session check failed:', dataResult.error);
                handleError(
                    new Error(dataResult.error || t('settings.sessionCheckFailed')),
                    t('settings.sessionCheckContext'),
                    {
                        errorType: dataResult.errorType,
                    }
                );
                sessionState.value = 'loggedOut';
            }
        }
    }

    async function login(password: string) {
        const result = await apiLogin(password);
        if (result.success) {
            const resultData = result.data as KvRecord | undefined;
            securityWarning.value = resultData?.securityWarning || null;
            const authenticated = await handleLoginSuccess();
            if (!authenticated) {
                throw new Error(t('settings.sessionCheckFailed'));
            }
            // 登录成功后跳转到仪表盘
            await router.push({ path: '/dashboard' });
        } else {
            throw new Error(result.error || t('settings.loginFailed'));
        }
    }

    async function handleLoginSuccess() {
        sessionState.value = 'loading';
        await checkSession();
        return sessionState.value === 'loggedIn';
    }

    async function handleUnauthorized() {
        if (sessionState.value !== 'loggedIn') return false;
        sessionState.value = 'loggedOut';
        initialData.value = null;
        securityWarning.value = null;
        useDataStore().clearCachedData();
        return true;
    }

    async function logout() {
        let logoutConfirmed = false;
        try {
            await api.get('/api/logout');
            logoutConfirmed = true;
        } catch (error) {
            console.warn('Logout request failed:', error);
        }

        if (!logoutConfirmed) {
            const sessionCheck = await fetchInitialData();
            if (sessionCheck.success || sessionCheck.errorType !== 'auth') {
                sessionState.value = 'loggedIn';
                handleError(new Error(t('settings.logoutFailed')), t('settings.logoutContext'), {
                    errorType: 'logout_failed',
                });
                return false;
            }
        }

        sessionState.value = 'loggedOut';
        initialData.value = null;
        securityWarning.value = null;

        // 清除缓存数据
        const dataStore = useDataStore();
        dataStore.clearCachedData();

        // 跳转到首页（公开页）
        router.push({ path: '/' });
    }

    return {
        sessionState,
        initialData,
        publicConfig,
        subscriptionConfig,
        securityWarning,
        checkSession,
        handleUnauthorized,
        login,
        logout,
    };
});
