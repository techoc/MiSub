import { ref, computed, onUnmounted, getCurrentInstance } from 'vue';
import { useToastStore } from '../stores/toast.ts';
import { DEFAULT_SETTINGS } from '../constants/default-settings.ts';
import { fetchSettings, saveSettings, resetSettings } from '../lib/api.ts';
import { useBackupLogic } from './useBackupLogic.ts';
import { t, setLocale } from '../i18n/index.ts';
import { confirmAction } from './useConfirm.ts';
import { normalizeDnsMode } from '../../functions/modules/subscription/safe-dns.ts';

/** 外部 API token 条目 */
interface ExternalApiToken {
    name: string;
    token: string;
}

/** 伪装页配置 */
interface DisguiseConfig {
    enabled: boolean;
    pageType: string;
    redirectUrl: string;
}

/** 设置状态：默认设置字段 + 后端可能返回的额外字段 */
type SettingsState = typeof DEFAULT_SETTINGS & Record<string, unknown>;

/** 仅接受普通对象，其余归一为空记录 */
function toPlainObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function normalizeExternalApiConfig(value: unknown) {
    const defaults = DEFAULT_SETTINGS.externalApi;
    const externalApi: Record<string, unknown> =
        value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const tokens: ExternalApiToken[] = Array.isArray(externalApi.tokens)
        ? externalApi.tokens
              .map((item: unknown, index: number) => {
                  const entry = (item || {}) as { name?: unknown; token?: unknown };
                  const fallbackName = `token-${index + 1}`;
                  return {
                      name: String(entry.name || fallbackName).trim() || fallbackName,
                      token: String(entry.token || '').trim(),
                  };
              })
              .filter((item) => item.token || item.name)
        : [];

    const normalized: typeof DEFAULT_SETTINGS.externalApi = {
        ...defaults,
        ...(externalApi as Partial<typeof DEFAULT_SETTINGS.externalApi>),
        tokens: tokens.length > 0 ? tokens : defaults.tokens.map((item) => ({ ...item })),
    };
    return normalized;
}

function normalizeSettingsObject(source: Record<string, unknown> = {}): SettingsState {
    const merged: SettingsState = {
        ...DEFAULT_SETTINGS,
        ...(source as Partial<typeof DEFAULT_SETTINGS>),
    };
    merged.externalApi = normalizeExternalApiConfig(source.externalApi ?? merged.externalApi);
    const generatorOptions: Partial<typeof DEFAULT_SETTINGS.generatorOptions> =
        source.generatorOptions && typeof source.generatorOptions === 'object'
            ? (source.generatorOptions as Partial<typeof DEFAULT_SETTINGS.generatorOptions>)
            : {};
    const dns: Partial<typeof DEFAULT_SETTINGS.generatorOptions.dns> =
        generatorOptions.dns && typeof generatorOptions.dns === 'object'
            ? generatorOptions.dns
            : {};
    const singbox: Partial<typeof DEFAULT_SETTINGS.generatorOptions.singbox> =
        generatorOptions.singbox && typeof generatorOptions.singbox === 'object'
            ? generatorOptions.singbox
            : {};
    merged.generatorOptions = {
        ...DEFAULT_SETTINGS.generatorOptions,
        ...generatorOptions,
        dns: {
            ...DEFAULT_SETTINGS.generatorOptions.dns,
            ...dns,
        },
        singbox: {
            ...DEFAULT_SETTINGS.generatorOptions.singbox,
            ...singbox,
        },
    };
    merged.dnsMode = normalizeDnsMode(merged.dnsMode);
    return merged;
}

/**
 * 设置页面的核心逻辑 composable
 * 用于 SettingsView.vue 和 SettingsPanel.vue 的代码复用
 */
export function useSettingsLogic() {
    const { showToast } = useToastStore();

    // 使用备份 composable
    const { exportBackup, importBackup } = useBackupLogic();

    // ========== 状态定义 ==========
    const settings = ref(normalizeSettingsObject(DEFAULT_SETTINGS));
    const isLoading = ref(false);
    const isSaving = ref(false);
    const showMigrationModal = ref(false);
    const restartCountdown = ref<number | undefined>(undefined);
    let reloadTimer: ReturnType<typeof setInterval> | null = null;

    const clearReloadTimer = () => {
        if (reloadTimer !== null) {
            clearInterval(reloadTimer);
            reloadTimer = null;
        }
    };

    if (getCurrentInstance()) {
        onUnmounted(clearReloadTimer);
    }

    // 嵌套配置对象
    const disguiseConfig = ref<DisguiseConfig>({
        enabled: false,
        pageType: 'default',
        redirectUrl: '',
    });

    // ========== 计算属性 ==========
    const hasWhitespace = computed(() => {
        const fieldsCheck = [
            'FileName',
            'mytoken',
            'profileToken',
            'transformConfig',
            'BotToken',
            'ChatID',
        ];
        for (const key of fieldsCheck) {
            const value = settings.value[key];
            if (typeof value === 'string' && value && /\s/.test(value)) return true;
        }
        return false;
    });

    const isStorageTypeValid = computed(() => ['kv', 'd1'].includes(settings.value.storageType));

    // ========== 核心函数 ==========

    /**
     * 从 API 加载设置
     */
    const loadSettings = async () => {
        isLoading.value = true;
        try {
            const result = await fetchSettings();
            if (result.success) {
                const incoming: Record<string, unknown> =
                    result.data && typeof result.data === 'object'
                        ? (result.data as Record<string, unknown>)
                        : {};
                settings.value = normalizeSettingsObject(incoming);

                const disguise = settings.value.disguise as Partial<DisguiseConfig> | undefined;
                if (disguise) {
                    disguiseConfig.value = {
                        enabled: disguise.enabled ?? false,
                        pageType: disguise.pageType ?? 'default',
                        redirectUrl: disguise.redirectUrl ?? '',
                    };
                }

                if (!settings.value.storageType) {
                    settings.value.storageType = 'kv';
                }

                // 应用默认显示语言设置
                if (settings.value.defaultLocale) {
                    setLocale(settings.value.defaultLocale);
                }
            } else {
                showToast(
                    t('settings.loadFailedWithMessage', {
                        message: result.error,
                    }),
                    'error'
                );
                settings.value = normalizeSettingsObject(DEFAULT_SETTINGS);
            }
        } catch (error) {
            showToast(t('settings.loadFailed'), 'error');
            settings.value = normalizeSettingsObject(DEFAULT_SETTINGS);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * 保存设置到 API
     */
    const handleSave = async () => {
        if (hasWhitespace.value) {
            showToast(t('settings.noWhitespace'), 'error');
            return false;
        }
        if (!isStorageTypeValid.value) {
            showToast(t('settings.invalidStorageType'), 'error');
            return false;
        }

        isSaving.value = true;
        try {
            if (!settings.value.storageType) settings.value.storageType = 'kv';
            settings.value.externalApi = normalizeExternalApiConfig(settings.value.externalApi);

            const settingsToSave: Record<string, unknown> = {
                ...settings.value,
                externalApi: normalizeExternalApiConfig(settings.value.externalApi),
                disguise: disguiseConfig.value,
            };

            settingsToSave.ruleLevel =
                settingsToSave.ruleLevel || settingsToSave.clashRuleLevel || 'std';

            delete settingsToSave.prefixConfig;
            delete settingsToSave.prependSubName;
            delete settingsToSave.nodeTransform;
            delete settingsToSave.clashRuleLevel;

            const result = await saveSettings(settingsToSave);
            if (result.success) {
                showToast(t('settings.savedReloading'), 'success');
                clearReloadTimer();
                restartCountdown.value = 3;
                reloadTimer = setInterval(() => {
                    restartCountdown.value! -= 1;
                    if (restartCountdown.value! <= 0) {
                        clearReloadTimer();
                        window.location.reload();
                    }
                }, 1000);
                return true;
            } else {
                throw new Error(result.error || t('settings.saveFailed'));
            }
        } catch (error) {
            showToast((error as Error).message, 'error');
            return false;
        } finally {
            isSaving.value = false;
        }
    };

    /**
     * 处理 D1 迁移成功
     */
    const handleMigrationSuccess = () => {
        showMigrationModal.value = false;
        settings.value.storageType = 'd1';
        showToast(t('settings.migrationSuccess'), 'success');
    };

    /**
     * 处理恢复出厂设置
     */
    const handleReset = async () => {
        const firstConfirmed = await confirmAction({
            message: t('settings.resetConfirm'),
            variant: 'danger',
        });
        if (!firstConfirmed) {
            return;
        }

        const secondConfirmed = await confirmAction({
            message: t('settings.resetConfirmAgain'),
            variant: 'danger',
        });
        if (!secondConfirmed) {
            return;
        }

        isLoading.value = true;
        try {
            const result = await resetSettings();
            if (result.success) {
                showToast(t('settings.resetSuccess'), 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast(t('settings.resetFailedWithMessage', { message: result.error }), 'error');
            }
        } catch (error) {
            showToast(t('settings.resetRequestFailed'), 'error');
        } finally {
            isLoading.value = false;
        }
    };

    return {
        settings,
        disguiseConfig,
        isLoading,
        isSaving,
        showMigrationModal,
        restartCountdown,
        hasWhitespace,
        isStorageTypeValid,
        loadSettings,
        handleSave,
        handleMigrationSuccess,
        handleReset,
        exportBackup,
        importBackup,
    };
}
