import { afterEach, describe, expect, it, vi } from 'vitest';
import { D1StorageAdapter } from '../../functions/storage-adapter/d1-adapter.ts';

function makeAdapter() {
    // _parseKey 不触碰连接，构造一个最小 db 即可
    return new D1StorageAdapter({ prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('D1StorageAdapter._parseKey 键映射与告警策略', () => {
    it('node_cache_* 静默映射到 settings 表（订阅生成高频读写，不应刷未知键告警）', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const parsed = makeAdapter()._parseKey('node_cache_profile_e2e-test');
        expect(parsed).toEqual({
            table: 'settings',
            queryField: 'key',
            queryValue: 'node_cache_profile_e2e-test',
        });
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('诊断日志 / 备份锁等按设计落在 settings 表的键同样静默', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const key of [
            'misub_system_logs',
            'misub_error_reports',
            'misub_webdav_backup_lock',
            'misub_data_v1',
        ]) {
            expect(makeAdapter()._parseKey(key).table).toBe('settings');
        }
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('真正未知的键仍会告警（防止拼写错误被静默吞掉）', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(makeAdapter()._parseKey('totally_unknown_key').table).toBe('settings');
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });
});
