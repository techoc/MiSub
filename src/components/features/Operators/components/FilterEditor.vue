<script setup lang="ts">
    import { computed } from 'vue';
    import { useI18n } from '../../../../i18n/index.ts';

    const props = defineProps({
        modelValue: {
            type: Object,
            default: () => ({}),
        },
    });

    const emit = defineEmits(['update:modelValue']);
    const { t } = useI18n();

    /** 过滤参数分组：include/exclude 用 rules，protocols/regions 用 values */
    interface FilterParamGroup {
        enabled: boolean;
        rules?: FilterRule[];
        values?: string[];
        [key: string]: unknown;
    }

    /** 单条正则规则 */
    interface FilterRule {
        pattern: string;
        flags?: string;
    }

    /** 过滤参数键 */
    type FilterParamKey = 'include' | 'exclude' | 'protocols' | 'regions';

    type FilterParams = Record<FilterParamKey, FilterParamGroup>;

    /** 名称规则（include/exclude）键，供模板 v-for 保持联合类型 */
    const ruleGroupTypes: Array<'include' | 'exclude'> = ['include', 'exclude'];

    /** 用默认值补齐单个分组（未知字段原样保留） */
    const withDefaults = (source: unknown, listKey: 'rules' | 'values'): FilterParamGroup => {
        const record: Partial<FilterParamGroup> =
            source && typeof source === 'object' ? (source as Partial<FilterParamGroup>) : {};
        return { enabled: false, [listKey]: [], ...record } as FilterParamGroup;
    };

    // Local working copy with defaults
    const params = computed<FilterParams>({
        get: () => {
            const source = (props.modelValue || {}) as Record<string, unknown>;
            return {
                include: withDefaults(source.include, 'rules'),
                exclude: withDefaults(source.exclude, 'rules'),
                protocols: withDefaults(source.protocols, 'values'),
                regions: withDefaults(source.regions, 'values'),
            };
        },
        set: (val) => emit('update:modelValue', val),
    });

    const updateParam = (key: FilterParamKey, value: FilterParamGroup) => {
        const newParams: FilterParams = { ...params.value, [key]: value };
        emit('update:modelValue', newParams);
    };

    const addRule = (type: 'include' | 'exclude') => {
        const current = { ...params.value[type] };
        current.rules = [...(current.rules || []), { pattern: '', flags: 'i' }];
        updateParam(type, current);
    };

    const normalizeRuleFlags = (type: 'include' | 'exclude', index: number) => {
        const current = { ...params.value[type] };
        current.rules = [...(current.rules || [])];
        const rule = current.rules[index];
        if (!rule) return;
        current.rules[index] = { ...rule, flags: 'i' };
        updateParam(type, current);
    };

    const removeRule = (type: 'include' | 'exclude', index: number) => {
        const current = { ...params.value[type] };
        current.rules = [...(current.rules || [])];
        current.rules.splice(index, 1);
        updateParam(type, current);
    };

    const commonProtocols = ['vless', 'vmess', 'trojan', 'ss', 'hysteria2', 'socks'];
    const commonRegions = ['香港', '美国', '日本', '新加坡', '台湾', '韩国', '英国', '德国'];
    const regionLabels: Record<string, string> = {
        香港: 'Hong Kong',
        美国: 'United States',
        日本: 'Japan',
        新加坡: 'Singapore',
        台湾: 'Taiwan',
        韩国: 'South Korea',
        英国: 'United Kingdom',
        德国: 'Germany',
    };
    const statusLabel = (enabled: unknown) =>
        t(enabled ? 'operators.statusOn' : 'operators.statusOff');
    const regionLabel = (region: string) =>
        t('operators.regionLabel', {
            region: regionLabels[region] || region,
        });

    const toggleValue = (type: 'protocols' | 'regions', value: string) => {
        const current = { ...params.value[type] };
        const values = new Set<string>(current.values || []);
        if (values.has(value)) {
            values.delete(value);
        } else {
            values.add(value);
        }
        current.values = Array.from(values);
        updateParam(type, current);
    };
</script>

<template>
    <div class="space-y-5">
        <!-- Protocol & Region Filter Layer -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Protocol -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <label
                        class="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                        >{{ t('operators.protocolLimit') }}</label
                    >
                    <button
                        @click="
                            updateParam('protocols', {
                                ...params.protocols,
                                enabled: !params.protocols.enabled,
                            })
                        "
                        :class="[
                            'text-[10px] font-medium transition-colors',
                            params.protocols.enabled
                                ? 'text-indigo-600'
                                : 'text-gray-500 dark:text-gray-400',
                        ]"
                    >
                        {{ statusLabel(params.protocols.enabled) }}
                    </button>
                </div>
                <div
                    v-if="params.protocols.enabled"
                    class="flex flex-wrap gap-1.5 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800"
                >
                    <button
                        v-for="p in commonProtocols"
                        :key="p"
                        @click="toggleValue('protocols', p)"
                        :class="[
                            'px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all',
                            params.protocols.values?.includes(p)
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700',
                        ]"
                    >
                        {{ p }}
                    </button>
                </div>
            </div>

            <!-- Region -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <label
                        class="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                        >{{ t('operators.regionLimit') }}</label
                    >
                    <button
                        @click="
                            updateParam('regions', {
                                ...params.regions,
                                enabled: !params.regions.enabled,
                            })
                        "
                        :class="[
                            'text-[10px] font-medium transition-colors',
                            params.regions.enabled
                                ? 'text-indigo-600'
                                : 'text-gray-500 dark:text-gray-400',
                        ]"
                    >
                        {{ statusLabel(params.regions.enabled) }}
                    </button>
                </div>
                <div
                    v-if="params.regions.enabled"
                    class="flex flex-wrap gap-1.5 p-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700"
                >
                    <button
                        v-for="r in commonRegions"
                        :key="r"
                        @click="toggleValue('regions', r)"
                        :class="[
                            'px-2 py-1 rounded-md text-[10px] font-bold transition-all',
                            params.regions.values?.includes(r)
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700',
                        ]"
                    >
                        {{ regionLabel(r) }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Name Rules (Include/Exclude) -->
        <div v-for="type in ruleGroupTypes" :key="type" class="space-y-2">
            <div class="flex items-center justify-between">
                <label
                    class="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"
                >
                    {{
                        t(type === 'include' ? 'operators.includeRegex' : 'operators.excludeRegex')
                    }}
                </label>
                <div class="flex items-center gap-3">
                    <button
                        v-if="params[type].enabled"
                        @click="addRule(type)"
                        class="text-[10px] text-indigo-600 font-bold"
                    >
                        + {{ t('operators.add') }}
                    </button>
                    <button
                        @click="
                            updateParam(type, { ...params[type], enabled: !params[type].enabled })
                        "
                        :class="[
                            'text-[10px] font-medium',
                            params[type].enabled
                                ? 'text-indigo-600'
                                : 'text-gray-500 dark:text-gray-400',
                        ]"
                    >
                        {{ statusLabel(params[type].enabled) }}
                    </button>
                </div>
            </div>

            <div v-if="params[type].enabled" class="space-y-1.5">
                <div
                    v-for="(rule, idx) in params[type].rules"
                    :key="idx"
                    class="flex items-center gap-2 group"
                >
                    <input
                        v-model="rule.pattern"
                        @input="normalizeRuleFlags(type, idx)"
                        :placeholder="t('operators.regexPlaceholder')"
                        class="flex-1 px-3 py-1.5 text-[11px] rounded-lg bg-gray-50 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500/30 transition-all outline-none"
                        :aria-label="t('operators.regexPlaceholder')"
                    />
                    <button
                        @click="removeRule(type, idx)"
                        class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-rose-500 touch-target"
                        :aria-label="t('operators.removeRule')"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                    {{ t('operators.regexFlagsHint') }}
                </p>
                <div
                    v-if="!params[type].rules?.length"
                    class="text-center py-2 text-[10px] text-gray-500 dark:text-gray-400 italic"
                >
                    {{ t('operators.filterEmptyRules') }}
                </div>
            </div>
        </div>
    </div>
</template>
