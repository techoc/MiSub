<script setup lang="ts">
    import { computed } from 'vue';

    const props = defineProps({
        variant: {
            type: String,
            default: 'primary',
            validator: (value: unknown) =>
                ['primary', 'secondary', 'danger', 'ghost', 'outline'].includes(String(value)),
        },
        size: {
            type: String,
            default: 'md',
            validator: (value: unknown) => ['sm', 'md', 'lg'].includes(String(value)),
        },
        loading: {
            type: Boolean,
            default: false,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        icon: {
            type: String,
            default: null,
        },
        iconOnly: {
            type: Boolean,
            default: false,
        },
        type: {
            type: String,
            default: 'button',
        },
        ariaLabel: {
            type: String,
            // 默认 undefined：空字符串会渲染出 aria-label=""，
            // 反而覆盖按钮自身的文本内容，使读屏软件读不出按钮名。
            default: undefined,
        },
    });

    const emit = defineEmits(['click']);

    const variantClasses = computed(() => {
        const variants: Record<string, string> = {
            primary:
                'bg-primary-600 hover:bg-primary-500 text-white border border-primary-500/70 active:scale-[0.98]',
            secondary:
                'bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.055] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10',
            danger: 'bg-red-500 hover:bg-red-400 text-white border border-red-400/70 active:scale-[0.98]',
            ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.055] text-gray-600 dark:text-gray-300',
            outline:
                'bg-transparent hover:bg-primary-50 dark:hover:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/40 dark:border-primary-400/40',
        };
        return variants[props.variant];
    });

    const sizeClasses = computed(() => {
        if (props.iconOnly) {
            const sizes: Record<string, string> = {
                sm: 'p-1.5',
                md: 'p-2',
                lg: 'p-3',
            };
            return sizes[props.size];
        }
        const sizes: Record<string, string> = {
            sm: 'px-3 py-1.5 text-xs gap-1.5',
            md: 'px-4 py-2 text-sm gap-2',
            lg: 'px-6 py-2.5 text-base gap-2',
        };
        return sizes[props.size];
    });

    /** button 元素的 type 只接受这三种字面量 */
    const buttonType = computed(() => props.type as 'button' | 'submit' | 'reset');

    const handleClick = (event: MouseEvent) => {
        if (!props.disabled && !props.loading) {
            emit('click', event);
        }
    };
</script>

<template>
    <button
        :type="buttonType"
        :disabled="disabled || loading"
        :aria-label="ariaLabel"
        @click="handleClick"
        class="relative inline-flex items-center justify-center rounded-[var(--misub-radius-md)] font-medium tap-effect disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group tracking-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        :class="[variantClasses, sizeClasses]"
    >
        <svg
            v-if="loading"
            class="w-4 h-4 animate-spin relative z-10"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="3"
            ></circle>
            <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>

        <svg
            v-else-if="icon"
            class="w-4 h-4 relative z-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" :d="icon" />
        </svg>

        <span v-if="!iconOnly" class="relative z-10">
            <slot />
        </span>
    </button>
</template>
