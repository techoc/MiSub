import { ref } from 'vue';

// Promise-based confirmation dialog.
//
// Replaces the native window.confirm() so the prompt can be styled, translated
// and driven by the shared Modal component (which already provides focus trap,
// Escape handling and focus restoration).
//
// Only one dialog can be pending at a time. If a second call arrives while a
// dialog is open, the first one resolves to false instead of leaking a promise.
interface ConfirmDialogState {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: string;
    resolve: (value: boolean) => void;
}

const pending = ref<ConfirmDialogState | null>(null);

// Whether a <ConfirmDialog /> host is currently mounted. When no host exists
// (unit tests, or a component mounted outside App.vue) confirmAction falls back
// to the native window.confirm() so callers never hang on an unresolved promise.
let hostMounted = false;

export function setConfirmHost(mounted: unknown) {
    hostMounted = Boolean(mounted);
    if (!hostMounted && pending.value) {
        // Host went away while a dialog was open — release the waiter.
        settleConfirm(false);
    }
}

export function confirmAction(options: Record<string, unknown> = {}): Promise<boolean> {
    if (!hostMounted) {
        const accepted =
            typeof window !== 'undefined' && typeof window.confirm === 'function'
                ? window.confirm(String(options.message || ''))
                : false;
        return Promise.resolve(accepted);
    }

    return new Promise<boolean>((resolve) => {
        if (pending.value) {
            pending.value.resolve(false);
        }
        pending.value = {
            title: String(options.title || ''),
            message: String(options.message || ''),
            confirmText: String(options.confirmText || ''),
            cancelText: String(options.cancelText || ''),
            variant: String(options.variant || 'primary'),
            resolve,
        };
    });
}

export function useConfirmState() {
    return pending;
}

export function settleConfirm(result: boolean) {
    const current = pending.value;
    pending.value = null;
    if (current) {
        current.resolve(result);
    }
}
