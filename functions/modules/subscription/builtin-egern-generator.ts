import { getBuiltinTemplate } from './builtin-template-registry.ts';
import { renderEgernFromIniTemplate } from './template-pipeline.ts';

export function generateBuiltinEgernConfig(nodeList, options = {}) {
    const templateEntry =
        getBuiltinTemplate('clash_misub_minimal') || getBuiltinTemplate('clash_acl4ssr_lite');
    if (!templateEntry?.content) {
        throw new Error('No builtin template available for Egern');
    }

    return renderEgernFromIniTemplate(templateEntry.content, {
        nodeList,
        fileName: options.fileName || 'MiSub',
        targetFormat: 'egern',
        ruleLevel: options.ruleLevel || 'std',
        interval: options.interval || 86400,
        managedConfigUrl: options.managedConfigUrl || '',
        skipCertVerify: options.skipCertVerify,
        enableUdp: options.enableUdp,
        enableTfo: options.enableTfo,
        generatorOptions: options.generatorOptions,
        addFlagEmoji: options.addFlagEmoji,
    });
}
