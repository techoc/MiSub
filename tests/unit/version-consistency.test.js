import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYSTEM_CONSTANTS } from '../../functions/modules/config.js';

/**
 * 应用版本号散落在多处展示位，历史上靠手工同步，容易漏改。
 * 本测试固定这些位置必须与 package.json 一致；发版时改完 package.json
 * 后跑 `npm run test:run` 即可发现遗漏。
 */

// vitest 的 import.meta.url 非 file:// 协议，这里依赖 npm script 固定 cwd 为仓库根。
const repoRoot = process.cwd();

function readRepoFile(relativePath) {
    return readFileSync(`${repoRoot}/${relativePath}`, 'utf8');
}

describe('app version consistency', () => {
    const packageVersion = JSON.parse(readRepoFile('package.json')).version;

    it('package.json has a version', () => {
        expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('functions/modules/config.js SYSTEM_CONSTANTS.VERSION matches', () => {
        expect(SYSTEM_CONSTANTS.VERSION).toBe(packageVersion);
    });

    it('CustomPublicRenderer.vue exposed version matches', () => {
        const source = readRepoFile('src/components/public/CustomPublicRenderer.vue');
        const matches = [...source.matchAll(/version:\s*'([^']+)'/g)].map((m) => m[1]);
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((v) => v === packageVersion)).toBe(true);
    });

    it('README version badge matches', () => {
        const readme = readRepoFile('README.md');
        const badgeMatches = [...readme.matchAll(/version-v([\d.]+)-/g)].map((m) => m[1]);
        expect(badgeMatches.length).toBeGreaterThan(0);
        expect(badgeMatches.every((v) => v === packageVersion)).toBe(true);
    });
});
