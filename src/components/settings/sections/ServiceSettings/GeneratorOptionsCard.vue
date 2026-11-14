<script setup lang="ts">
    import Switch from '@/components/ui/Switch.vue';
    import SectionHeader from '../../SectionHeader.vue';
    import { useI18n } from '@/i18n/index.ts';

    const { t } = useI18n();

    const props = defineProps({
        settings: {
            type: Object,
            required: true,
        },
    });

    const groups = [
        {
            titleKey: 'settings.generatorGeneralGroup',
            options: [
                {
                    path: 'generatorOptions.ipv6',
                    labelKey: 'settings.generatorIpv6',
                    hintKey: 'settings.generatorIpv6Hint',
                    scopeKey: 'settings.generatorAllClients',
                },
                {
                    path: 'generatorOptions.allowLan',
                    labelKey: 'settings.generatorAllowLan',
                    hintKey: 'settings.generatorAllowLanHint',
                    scopeKey: 'settings.generatorClashOnly',
                },
            ],
        },
        {
            titleKey: 'settings.generatorDnsGroup',
            options: [
                {
                    path: 'generatorOptions.dns.enable',
                    labelKey: 'settings.generatorDnsEnable',
                    hintKey: 'settings.generatorDnsEnableHint',
                    scopeKey: 'settings.generatorDnsClients',
                },
                {
                    path: 'generatorOptions.dns.ipv6',
                    labelKey: 'settings.generatorDnsIpv6',
                    hintKey: 'settings.generatorDnsIpv6Hint',
                    scopeKey: 'settings.generatorDnsClients',
                },
                {
                    path: 'generatorOptions.dns.useHosts',
                    labelKey: 'settings.generatorDnsUseHosts',
                    hintKey: 'settings.generatorDnsUseHostsHint',
                    scopeKey: 'settings.generatorClashOnly',
                },
                {
                    path: 'generatorOptions.dns.useSystemHosts',
                    labelKey: 'settings.generatorDnsUseSystemHosts',
                    hintKey: 'settings.generatorDnsUseSystemHostsHint',
                    scopeKey: 'settings.generatorClashOnly',
                },
                {
                    path: 'generatorOptions.dns.respectRules',
                    labelKey: 'settings.generatorDnsRespectRules',
                    hintKey: 'settings.generatorDnsRespectRulesHint',
                    scopeKey: 'settings.generatorClashOnly',
                },
            ],
        },
        {
            titleKey: 'settings.generatorSingboxGroup',
            options: [
                {
                    path: 'generatorOptions.singbox.tunAutoRoute',
                    labelKey: 'settings.generatorTunAutoRoute',
                    hintKey: 'settings.generatorTunAutoRouteHint',
                    scopeKey: 'settings.generatorSingboxOnly',
                },
                {
                    path: 'generatorOptions.singbox.tunStrictRoute',
                    labelKey: 'settings.generatorTunStrictRoute',
                    hintKey: 'settings.generatorTunStrictRouteHint',
                    scopeKey: 'settings.generatorSingboxOnly',
                },
            ],
        },
    ];

    function readPath(path: string): boolean {
        const value = path.split('.').reduce<unknown>((current, key) => {
            if (!current || typeof current !== 'object') return undefined;
            return (current as Record<string, unknown>)[key];
        }, props.settings);
        return Boolean(value);
    }

    function writePath(path: string, value: unknown) {
        const keys = path.split('.');
        let target = props.settings;
        for (const key of keys.slice(0, -1)) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            target = target[key];
        }
        const lastKey = keys[keys.length - 1];
        if (lastKey) target[lastKey] = value;
    }
</script>

<template>
    <div
        class="rounded-xl border border-gray-100/80 bg-white/90 p-6 shadow-xs dark:border-white/10 dark:bg-gray-900/70"
    >
        <SectionHeader
            :title="t('settings.generatorOptionsTitle')"
            :description="t('settings.generatorOptionsDesc')"
            tone="emerald"
        >
            <template #icon>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 6V4m0 16v-2m6-6h2M4 12h2m9.657-4.657l1.414-1.414M6.929 17.071l-1.414 1.414m12.728 0l-1.414-1.414M6.929 6.929L5.515 5.515M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
            </template>
        </SectionHeader>

        <div class="mt-5 space-y-6">
            <section v-for="group in groups" :key="group.titleKey">
                <h4
                    class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                    {{ t(group.titleKey) }}
                </h4>
                <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div
                        v-for="option in group.options as any[]"
                        :key="option.path"
                        class="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-white/5 dark:bg-white/5"
                    >
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span
                                    class="text-xs font-medium text-gray-800 dark:text-gray-200"
                                    >{{ t(option.labelKey) }}</span
                                >
                                <span
                                    class="rounded-full bg-gray-200/70 px-2 py-0.5 text-[9px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400"
                                >
                                    {{ t(option.scopeKey) }}
                                </span>
                            </div>
                            <p
                                class="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400"
                            >
                                {{ t(option.hintKey) }}
                            </p>
                        </div>
                        <Switch
                            :model-value="readPath(option.path)"
                            size="sm"
                            @update:model-value="writePath(option.path, $event)"
                        />
                    </div>
                </div>
            </section>

            <div
                class="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-white/5"
            >
                <div>
                    <span class="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {{ t('settings.generatorDnsMode') }}
                    </span>
                    <p class="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                        {{ t('settings.generatorDnsModeHint') }}
                    </p>
                </div>
                <select
                    v-model="settings.dnsMode"
                    class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 focus-visible:ring-emerald-500 sm:w-52 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                    <option value="clean">{{ t('settings.generatorDnsModeClean') }}</option>
                    <option value="polluted">{{ t('settings.generatorDnsModePolluted') }}</option>
                    <option value="domestic-clean">
                        {{ t('settings.generatorDnsModeDomesticClean') }}
                    </option>
                    <option value="domestic-polluted">
                        {{ t('settings.generatorDnsModeDomesticPolluted') }}
                    </option>
                </select>
            </div>

            <p
                class="rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
            >
                {{ t('settings.generatorOptionsHint') }}
            </p>
        </div>
    </div>
</template>
