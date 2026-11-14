/** 单目标的模板兼容规则 */
interface TemplateCompatibilityRule {
    allowExternalTemplate: boolean;
    externalTemplateTypes: string[];
    strategy: string;
    description: string;
}

export const TEMPLATE_COMPATIBILITY: Record<string, TemplateCompatibilityRule> = {
    clash: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description:
            'Clash 系列通过统一模板模型接入，当前内置引擎支持将 ini 模板转译为 Clash 配置。',
    },
    surge: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Surge 通过统一模板模型接入，支持将 ini 模板转译为 Surge 配置。',
    },
    loon: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Loon 通过统一模板模型接入，支持将 ini 模板转译为 Loon 配置。',
    },
    quanx: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Quantumult X 通过统一模板模型接入，支持将 ini 模板转译为 Quantumult X 配置。',
    },
    singbox: {
        allowExternalTemplate: true,
        externalTemplateTypes: ['ini'],
        strategy: 'model-driven',
        description: 'Sing-Box 通过统一模板模型接入，当前内置引擎支持将 ini 模板转译为 JSON 配置。',
    },
};

function getTemplateExtension(templateUrl: unknown): string {
    const normalizedTemplateUrl = typeof templateUrl === 'string' ? templateUrl.trim() : '';
    if (!normalizedTemplateUrl) return '';

    try {
        const url = new URL(normalizedTemplateUrl);
        return url.pathname.split('/').pop()?.split('.').pop()?.toLowerCase() || '';
    } catch {
        const cleanPath = normalizedTemplateUrl.split('#')[0].split('?')[0];
        return cleanPath.split('/').pop()?.split('.').pop()?.toLowerCase() || '';
    }
}

export function normalizeTemplateTarget(targetFormat: unknown): string {
    const normalizedTarget = typeof targetFormat === 'string' ? targetFormat.toLowerCase() : '';
    if (normalizedTarget.startsWith('surge&ver=')) return 'surge';
    if (normalizedTarget === 'sing-box') return 'singbox';
    return normalizedTarget;
}

export function getTemplateCompatibility(targetFormat: unknown) {
    const normalizedTarget = normalizeTemplateTarget(targetFormat);
    return TEMPLATE_COMPATIBILITY[normalizedTarget] || null;
}

export function shouldApplyExternalTemplateForTarget(
    targetFormat: unknown,
    templateUrl: unknown
): boolean {
    const normalizedTemplateUrl = typeof templateUrl === 'string' ? templateUrl.trim() : '';
    const targetRule = getTemplateCompatibility(targetFormat);

    if (!normalizedTemplateUrl) return false;
    if (!targetRule) return false;
    if (!targetRule.allowExternalTemplate) return false;

    return targetRule.externalTemplateTypes.includes(getTemplateExtension(normalizedTemplateUrl));
}
