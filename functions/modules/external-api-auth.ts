import { createExternalError, getExternalApiSettings } from './external-api-utils.ts';

import type { ExternalStorageAdapter } from './external-api-utils.ts';
export async function authenticateExternalApiRequest(
    request: Request,
    env: Env,
    storageAdapter: ExternalStorageAdapter | null = null
) {
    const settings = await getExternalApiSettings(env, storageAdapter);
    if (settings.enabled !== true) {
        return {
            ok: false,
            response: createExternalError('forbidden', 'External API is disabled', 403),
        };
    }

    const authorization = request.headers.get('Authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        return {
            ok: false,
            response: createExternalError('unauthorized', 'Invalid or missing bearer token', 401),
        };
    }

    const token = match[1].trim();
    const tokens = Array.isArray(settings.tokens) ? settings.tokens : [];
    const matchedToken = tokens.find(
        (item) => String((item as { token?: unknown } | null)?.token || '') === token
    );
    if (!matchedToken) {
        return {
            ok: false,
            response: createExternalError('unauthorized', 'Invalid or missing bearer token', 401),
        };
    }

    return {
        ok: true,
        tokenName: String((matchedToken as { name?: unknown } | null)?.name || 'default'),
    };
}
