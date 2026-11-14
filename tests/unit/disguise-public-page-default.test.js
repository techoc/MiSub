import { describe, it, expect, vi } from 'vitest';

// 统一按「未登录」走伪装判定（不触碰真实 cookie/storage）
vi.mock('../../functions/modules/auth-middleware.ts', () => ({
    authMiddleware: vi.fn(async () => false),
}));

import { handleDisguiseRequest } from '../../functions/modules/handlers/disguise-handler.ts';

const disguiseOn = {
    enabled: true,
    pageType: 'redirect',
    redirectUrl: 'https://example.com/disguised',
};

function contextFor(pathname) {
    return { request: new Request(`https://misub.example${pathname}`), env: {} };
}

describe('handleDisguiseRequest 与 enablePublicPage 默认值一致性', () => {
    it('settings 未持久化 enablePublicPage 时按默认值(true)放行公开页', async () => {
        // 回归：public_config 用 {...defaultSettings, ...settings} 对外宣告
        // enablePublicPage=true，但伪装判定直接读原始 settings（undefined→false），
        // 导致公开页在 API 里显示开启、实际却被伪装拦掉。
        const response = await handleDisguiseRequest(contextFor('/'), { disguise: disguiseOn });
        expect(response).toBeNull();
    });

    it('/explore 同样按默认值放行', async () => {
        const response = await handleDisguiseRequest(contextFor('/explore'), {
            disguise: disguiseOn,
        });
        expect(response).toBeNull();
    });

    it('显式关闭公开页时仍伪装根路径与 /explore', async () => {
        for (const pathname of ['/', '/explore']) {
            const response = await handleDisguiseRequest(contextFor(pathname), {
                disguise: disguiseOn,
                enablePublicPage: false,
            });
            expect(response?.status).toBe(302);
        }
    });

    it('非公开路径在未登录时保持伪装', async () => {
        const response = await handleDisguiseRequest(contextFor('/dashboard'), {
            disguise: disguiseOn,
        });
        expect(response?.status).toBe(302);
    });

    it('伪装未开启时不拦截', async () => {
        const response = await handleDisguiseRequest(contextFor('/dashboard'), {
            disguise: { enabled: false },
        });
        expect(response).toBeNull();
    });
});
