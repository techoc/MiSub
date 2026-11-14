import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DEFAULT_SETTINGS } from '@/constants/default-settings';

export const useSettingsStore = defineStore('settings', () => {
    const config = ref({ ...DEFAULT_SETTINGS });

    function setConfig(newConfig: any) {
        config.value = { ...DEFAULT_SETTINGS, ...newConfig };
    }

    function updateConfig(updates: any) {
        config.value = { ...config.value, ...updates };
    }

    return {
        config,
        setConfig,
        updateConfig,
    };
});
