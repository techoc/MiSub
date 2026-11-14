import { afterEach, describe, expect, it, vi } from 'vitest';
import { installLogGate } from '../../functions/utils/log-gate.ts';

// installLogGate 直接替换/还原 console 方法（还原目标是模块加载时绑定的原实现），
// 因此用引用恒等断言，而不是 spy（spy 会在替换时被丢弃）。
describe('log gate', () => {
    afterEach(() => {
        installLogGate(undefined); // 回到默认全透传，避免污染其他测试
    });

    it('unknown/absent level keeps console methods untouched (passthrough)', () => {
        const before = console.log;
        installLogGate(undefined);
        expect(console.log).toBe(before);
        installLogGate({ MISUB_LOG_LEVEL: 'verbose' });
        expect(console.log).toBe(before);
    });

    it('MISUB_LOG_LEVEL=warn suppresses log, keeps warn/error working', () => {
        const log = console.log;
        installLogGate({ MISUB_LOG_LEVEL: 'warn' });

        expect(console.log === log).toBe(false); // 已替换为抑制桩
        expect(console.log).toBeTypeOf('function');
        expect(() => console.log('suppressed')).not.toThrow();

        const warnSpy = vi.spyOn(console, 'warn');
        const errorSpy = vi.spyOn(console, 'error');
        console.warn('important');
        console.error('critical');
        expect(warnSpy).toHaveBeenCalledWith('important');
        expect(errorSpy).toHaveBeenCalledWith('critical');
    });

    it('MISUB_LOG_LEVEL=error suppresses warn as well', () => {
        const warn = console.warn;
        installLogGate({ MISUB_LOG_LEVEL: 'error' });
        expect(console.warn === warn).toBe(false);
        expect(() => console.warn('suppressed')).not.toThrow();

        const errorSpy = vi.spyOn(console, 'error');
        console.error('critical');
        expect(errorSpy).toHaveBeenCalledWith('critical');
    });

    it('re-installing with a different level updates gating (isolate reuse)', () => {
        const before = console.log;
        installLogGate({ MISUB_LOG_LEVEL: 'error' });
        expect(console.log === before).toBe(false);

        installLogGate({ MISUB_LOG_LEVEL: 'all' });
        expect(console.log).toBe(before); // 已还原为透传
    });
});
