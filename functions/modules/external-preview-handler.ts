import {
    createExternalError,
    createExternalSuccess,
    getExternalStorageAdapter,
} from './external-api-utils.ts';
import {
    detectNodeProtocol,
    isManualNode,
    isRemoteSubscription,
    toExternalProfile,
} from './external-api-mappers.ts';

/** 预览用到的订阅/节点记录 */
interface PreviewSubscription {
    id: string;
    name?: string;
    url?: string;
    [key: string]: unknown;
}

/** 预览输出的来源条目 */
interface PreviewSource {
    id: string;
    type: string;
    name: string;
    url: string;
    protocol?: string;
    nodeCount?: number;
}

export async function handleExternalPreviewRequest(_request: Request, env: Env, profileId: string) {
    const storageAdapter = await getExternalStorageAdapter(env);
    const profile = await storageAdapter.getProfileById(profileId);
    if (!profile) return createExternalError('profile_not_found', 'Profile not found', 404);

    const allSubscriptions = await storageAdapter.getAllSubscriptions();
    const byId = new Map<string, PreviewSubscription>(
        allSubscriptions.map((item) => {
            const record = item as PreviewSubscription;
            return [record.id, record] as const;
        })
    );
    const subscriptionIds: unknown[] = Array.isArray(profile.subscriptions)
        ? profile.subscriptions
        : [];
    const manualNodeIds: unknown[] = Array.isArray(profile.manualNodes) ? profile.manualNodes : [];

    const remoteSources: PreviewSource[] = subscriptionIds
        .map((id) => byId.get(id as string))
        .filter((item): item is PreviewSubscription => Boolean(item) && isRemoteSubscription(item))
        .map((item) => ({
            id: item.id,
            type: 'subscription',
            name: item.name || '',
            url: item.url || '',
        }));

    const manualSources: PreviewSource[] = manualNodeIds
        .map((id) => byId.get(id as string))
        .filter((item): item is PreviewSubscription => Boolean(item) && isManualNode(item))
        .map((item) => ({
            id: item.id,
            type: 'manual_node',
            name: item.name || '',
            protocol: detectNodeProtocol(item.url),
            nodeCount: 1,
            url: item.url || '',
        }));

    const byProtocol: Record<string, number> = {};
    manualSources.forEach((item) => {
        const protocol = item.protocol || '';
        byProtocol[protocol] = (byProtocol[protocol] || 0) + 1;
    });

    return createExternalSuccess({
        profile: toExternalProfile(profile),
        counts: {
            subscriptions: remoteSources.length,
            manualNodes: manualSources.length,
            totalNodes: manualSources.length,
        },
        byProtocol,
        sources: [...remoteSources, ...manualSources],
    });
}
