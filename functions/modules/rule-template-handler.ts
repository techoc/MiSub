import { StorageFactory } from '../storage-adapter.ts';
import {
    createJsonResponse,
    createErrorResponse,
    JSON_BODY_LIMITS,
    readJsonWithLimit,
} from './utils.ts';

export const KV_KEY_RULE_TEMPLATES = 'misub_rule_templates_v1';
const MAX_TEMPLATE_COUNT = 50;
const MAX_TEMPLATE_CONTENT_LENGTH = 128 * 1024;

/** 自定义规则模板记录 */
interface RuleTemplate {
    id: string;
    name: string;
    description: string;
    type: string;
    content: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

/** 规则模板用到的存储适配器最小面 */
interface RuleTemplateStorage {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown): Promise<unknown>;
}

function nowIso() {
    return new Date().toISOString();
}

function sanitizeId(value: unknown = ''): string {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}

function createId() {
    const random = Math.random().toString(36).slice(2, 10);
    return `rule-template-${Date.now().toString(36)}-${random}`;
}

function hasIniShape(content: unknown): boolean {
    return /\[(custom|proxy\s*group|rule|ruleset|proxy)\]/i.test(String(content ?? ''));
}

export function normalizeCustomRuleTemplates(input: unknown = []): RuleTemplate[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const normalized: RuleTemplate[] = [];

    for (const item of input.slice(0, MAX_TEMPLATE_COUNT)) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;

        const content = typeof record.content === 'string' ? record.content.trim() : '';
        if (!content || content.length > MAX_TEMPLATE_CONTENT_LENGTH || !hasIniShape(content))
            continue;

        let id = sanitizeId(record.id) || createId();
        while (seen.has(id)) {
            id = `${id}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 80);
        }
        seen.add(id);

        const name =
            String(record.name || '')
                .trim()
                .slice(0, 80) || '未命名规则模板';
        const createdAtValue = String(record.createdAt || '');
        const createdAt =
            createdAtValue && !Number.isNaN(Date.parse(createdAtValue)) ? createdAtValue : nowIso();

        normalized.push({
            id,
            name,
            description: String(record.description || '')
                .trim()
                .slice(0, 300),
            type: 'ini',
            content,
            enabled: record.enabled !== false,
            createdAt,
            updatedAt: nowIso(),
        });
    }

    return normalized;
}

async function getStorageAdapter(env: Env): Promise<RuleTemplateStorage> {
    const testAdapter = (env as { __TEST_STORAGE_ADAPTER?: unknown }).__TEST_STORAGE_ADAPTER;
    if (testAdapter) return testAdapter as RuleTemplateStorage;
    const storageType = await StorageFactory.getStorageType(env);
    return StorageFactory.createAdapter(env, storageType) as unknown as RuleTemplateStorage;
}

export async function listRuleTemplates(
    storageAdapter: RuleTemplateStorage
): Promise<RuleTemplate[]> {
    const raw = await storageAdapter.get(KV_KEY_RULE_TEMPLATES);
    return normalizeCustomRuleTemplates(Array.isArray(raw) ? raw : []);
}

export async function resolveRuleTemplateSource(storageAdapter: unknown, templateSource: unknown) {
    const source = templateSource as { kind?: unknown; value?: unknown } | null;
    if (!source || source.kind !== 'custom') return null;
    const templateId = sanitizeId(source.value);
    if (!templateId) return null;

    const templates = await listRuleTemplates(storageAdapter as RuleTemplateStorage);
    const template = templates.find((item) => item.enabled !== false && item.id === templateId);
    if (!template) return null;

    return {
        ...template,
        content: template.content,
        format: template.type || 'ini',
    };
}

export async function handleRuleTemplatesRequest(request: Request, env: Env) {
    try {
        const storageAdapter = await getStorageAdapter(env);

        if (request.method === 'GET') {
            const templates = await listRuleTemplates(storageAdapter);
            return createJsonResponse({ success: true, data: templates });
        }

        if (request.method === 'POST') {
            let body;
            try {
                body = await readJsonWithLimit(request, JSON_BODY_LIMITS.normal);
            } catch (e) {
                if ((e as { status?: number } | undefined)?.status === 413) {
                    return createJsonResponse(
                        {
                            success: false,
                            message: (e as Error).message,
                            error: (e as Error).message,
                        },
                        413
                    );
                }
                return createJsonResponse({ success: false, message: '请求数据格式错误' }, 400);
            }

            const templates = normalizeCustomRuleTemplates(body?.templates || body?.data || []);
            await storageAdapter.put(KV_KEY_RULE_TEMPLATES, templates);
            return createJsonResponse({
                success: true,
                message: '自定义规则模板已保存',
                data: templates,
            });
        }

        return createErrorResponse('Method Not Allowed', 405);
    } catch (error) {
        console.error('[RuleTemplates] request failed:', error);
        return createJsonResponse(
            {
                success: false,
                message: `自定义规则模板操作失败: ${(error as Error).message || '服务器内部错误'}`,
            },
            500
        );
    }
}
