import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DEFAULT_SETTINGS } from '@/constants/default-settings';

import type { KvRecord } from '../../types/models.ts';

export const useSettingsStore = defineStore('settings', () => {
    const config = ref({ ...DEFAULT_SETTINGS });

    function setConfig(newConfig: KvRecord) {
        config.value = { ...DEFAULT_SETTINGS, ...newConfig };
    }

    function updateConfig(updates: KvRecord) {
        config.value = { ...config.value, ...updates };
    }

    return {
        config,
        setConfig,
        updateConfig,
    };
});
