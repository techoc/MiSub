import { generateBuiltinClashConfig } from './builtin-clash-generator.ts';
import { generateBuiltinSurgeConfig } from './builtin-surge-generator.ts';
import { generateBuiltinLoonConfig } from './builtin-loon-generator.ts';
import { generateBuiltinQuanxConfig } from './builtin-quanx-generator.ts';
import { generateBuiltinSingboxConfig } from './builtin-singbox-generator.ts';
import { generateBuiltinEgernConfig } from './builtin-egern-generator.ts';

export function transformBuiltinSubscription(
    nodeList: any,
    targetFormat: any,
    options: Record<string, any> = {}
) {
    const normalized = (targetFormat || '').toLowerCase();
    const targetKey = normalized.startsWith('surge&ver=') ? 'surge' : normalized;

    switch (targetKey) {
        case 'clash':
            return generateBuiltinClashConfig(nodeList, options);
        case 'surge':
            return generateBuiltinSurgeConfig(nodeList, options);
        case 'loon':
            return generateBuiltinLoonConfig(nodeList, options);
        case 'quanx':
            return generateBuiltinQuanxConfig(nodeList, options);
        case 'singbox':
        case 'sing-box':
            return generateBuiltinSingboxConfig(nodeList, options);
        case 'egern':
            return generateBuiltinEgernConfig(nodeList, options);
        default:
            return null;
    }
}
