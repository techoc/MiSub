import { ref } from 'vue';
import { useToastStore } from '../stores/toast.ts';
import { extractNodeName } from '../lib/utils.ts';
import { generateNodeId } from '../utils/id.ts';
import { t } from '../i18n/index.ts';

const isDev = import.meta.env.DEV;

export function useNodeForms({ addNode, updateNode }) {
    const { showToast } = useToastStore();
    const showModal = ref(false);
    const isNew = ref(false);
    const editingNode = ref<any>(null);

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

    const openEdit = (node) => {
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

    const handleUrlInput = (event) => {
        if (!editingNode.value) return;
        const newUrl = event.target.value;
        if (newUrl && !(editingNode.value as Error).name) {
            (editingNode.value as Error).name = extractNodeName(newUrl);
        }
    };

    const handleSave = () => {
        if (!editingNode.value || !(editingNode.value as Record<string, any>).url) {
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
