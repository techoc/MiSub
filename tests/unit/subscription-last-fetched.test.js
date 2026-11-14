import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Card from '../../src/components/ui/Card.vue';
import { createI18n } from '../../src/i18n/index.ts';

function withZhI18n() {
    return {
        plugins: [createI18n({ initialLocale: 'zh-CN' })],
        stubs: { Switch: { template: '<button class="switch-stub"></button>' } },
    };
}

function mountCard(misub) {
    return mount(Card, {
        props: {
            misub: {
                id: 'sub_1',
                name: '测试机场',
                url: 'https://api.example.com/sub?target=clash',
                enabled: true,
                nodeCount: 10,
                ...misub,
            },
        },
        global: withZhI18n(),
    });
}

vi.mock('../../src/stores/toast.js', () => ({
    useToastStore: () => ({ showToast: vi.fn() }),
}));

describe('subscription last fetched time', () => {
    it('shows the fetch time next to the refresh button when fetched today', () => {
        const today = new Date();
        today.setHours(9, 5, 0, 0);

        const wrapper = mountCard({ lastFetchedAt: today.toISOString() });

        const label = wrapper.get('[data-testid="subscription-last-fetched"]');
        expect(label.text()).toBe('上次获取 09:05');

        // 时间展示必须位于刷新按钮之前
        const refreshButton = wrapper.get('button[title="更新节点信息"]');
        expect(
            label.element.compareDocumentPosition(refreshButton.element) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('shows the date as well when the last fetch happened on an earlier day', () => {
        const earlier = new Date();
        earlier.setDate(earlier.getDate() - 3);
        earlier.setHours(18, 30, 0, 0);

        const wrapper = mountCard({ lastFetchedAt: earlier.toISOString() });

        const label = wrapper.get('[data-testid="subscription-last-fetched"]');
        const pad = (value) => String(value).padStart(2, '0');
        expect(label.text()).toBe(
            `上次获取 ${pad(earlier.getMonth() + 1)}-${pad(earlier.getDate())} 18:30`
        );
    });

    it('falls back to a never-fetched label when no timestamp is stored', () => {
        const wrapper = mountCard({ lastFetchedAt: null });

        const label = wrapper.get('[data-testid="subscription-last-fetched"]');
        expect(label.text()).toBe('尚未获取');
    });

    it('ignores an invalid timestamp', () => {
        const wrapper = mountCard({ lastFetchedAt: 'not-a-date' });

        const label = wrapper.get('[data-testid="subscription-last-fetched"]');
        expect(label.text()).toBe('尚未获取');
    });
});
