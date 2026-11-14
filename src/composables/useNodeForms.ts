import { ref } from 'vue';
import { useToastStore } from '../stores/toast.ts';
import { extractNodeName } from '../lib/utils.ts';
import { generateNodeId } from '../utils/id.ts';
import { t } from '../i18n/index.ts';

import type { SubscriptionItem } from '../../types/models.ts';

const isDev = import.meta.env.DEV;

/** 手动节点编辑弹窗需要的写入回调 */
interface NodeFormsHandlers {
    addNode: (node: SubscriptionItem) => void | Promise<void>;
    updateNode: (node: SubscriptionItem) => void;
}

export function useNodeForms({ addNode, updateNode }: NodeFormsHandlers) {
    const { showToast } = useToastStore();
    const showModal = ref(false);
    const isNew = ref(false);
    const editingNode = ref<SubscriptionItem | undefined>(undefined);

    const openAdd = () => {
        isNew.value = true;
        editingNode.value = {
            id: generateNodeId(),
            name: '',
            url: '',
            enabled: true,
            colorTag: null,
        };
        showModal.value = true;
    };

    const openEdit = (node: SubscriptionItem | undefined) => {
        if (!node) {
            console.error('UseNodeForms: openEdit called with null');
            return;
        }
        if (isDev) {
            console.debug('UseNodeForms: openEdit called with', node);
        }
        isNew.value = false;
        editingNode.value = { ...node };
        if (isDev) {
            console.debug('UseNodeForms: editingNode set to', editingNode.value);
        }
        showModal.value = true;
    };

    const handleUrlInput = (event: Event) => {
        if (!editingNode.value) return;
        const newUrl = (event.target as HTMLInputElement | null)?.value ?? '';
        if (newUrl && !editingNode.value.name) {
            editingNode.value.name = extractNodeName(newUrl);
        }
    };

    const handleSave = () => {
        if (!editingNode.value || !editingNode.value.url) {
            showToast(t('manualNodes.urlRequired'), 'error');
            return;
        }

        if (isNew.value) {
            addNode(editingNode.value);
        } else {
            updateNode(editingNode.value);
        }
        showModal.value = false;
    };

    return {
        showModal,
        isNew,
        editingNode,
        openAdd,
        openEdit,
        handleUrlInput,
        handleSave,
    };
}
