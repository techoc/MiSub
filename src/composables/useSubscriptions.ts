// FILE: src/composables/useSubscriptions.js
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useDataStore } from '../stores/useDataStore';
import { useToastStore } from '../stores/toast.ts';
import { fetchNodeCount, batchUpdateNodes } from '../lib/api.ts';
import { handleError } from '../utils/errorHandler.ts';
import { TIMING } from '../constants/timing.ts';
import { t } from '../i18n/index.ts';
import { getAirportIdentityKey } from '../utils/airport-identity.ts';

const isDev = import.meta.env.DEV;

export function useSubscriptions(markDirty: any) {
    const { showToast } = useToastStore();
    const dataStore = useDataStore();
    // Rename the store ref to avoid confusion, as it contains ALL items
    const { subscriptions: allSubscriptions } = storeToRefs(dataStore);

    // Filtered computed property: Only http/https links are "Subscriptions"
    const subscriptions = computed(() => {
        return (allSubscriptions.value || []).filter(
            (sub) =>
                (sub as Record<string, any>).url &&
                /^https?:\/\//.test((sub as Record<string, any>).url)
        );
    });

    const searchQuery = ref('');
    const refreshError = ref(false);
    const lastRefreshAt = ref<any>(null);
    const isRefreshing = ref(false);
    const filteredSubscriptions = computed(() => {
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return subscriptions.value;

        return subscriptions.value.filter((sub) =>
            [
                (sub as Error).name,
                (sub as Record<string, any>).description,
                (sub as Record<string, any>).remark,
                (sub as Record<string, any>).note,
                (sub as Record<string, any>).website,
                (sub as Record<string, any>).url,
                (sub as Record<string, any>).customId,
            ].some((value) =>
                String(value || '')
                    .toLowerCase()
                    .includes(query)
            )
        );
    });

    const subsCurrentPage = ref(1);
    const subsItemsPerPage = 6;
    const enabledSubscriptions = computed(() =>
        subscriptions.value.filter((s) => (s as Record<string, any>).enabled)
    );

    /** 保持同一站点订阅相邻，避免分页后多个机场组交错出现。 */
    const orderedFilteredSubscriptions = computed(() => {
        const filteredIds = new Set(
            filteredSubscriptions.value.map((sub) => (sub as Record<string, any>).id)
        );
        const ordered: any[] = [];
        const groups = new Map();
        (allSubscriptions.value || []).forEach((sub) => {
            if (
                !filteredIds.has((sub as Record<string, any>).id) ||
                !/^https?:\/\//i.test(String((sub as Record<string, any>).url || ''))
            )
                return;
            const key = getAirportIdentityKey(sub);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(sub);
        });
        const grouped = [...groups.entries()].sort(([, left], [, right]) => {
            const leftMerged = left.length > 1 ? 1 : 0;
            const rightMerged = right.length > 1 ? 1 : 0;
            return rightMerged - leftMerged;
        });
        grouped.forEach(([, items]) => ordered.push(...items));
        return ordered;
    });

    const totalRemainingTraffic = computed(() => {
        const REASONABLE_TRAFFIC_LIMIT_BYTES = 10 * 1024 * 1024 * 1024 * 1024 * 1024; // 10 PB in bytes
        return subscriptions.value.reduce((acc, sub) => {
            if ((sub as Record<string, any>).excludeTraffic) return acc;
            if (
                (sub as Record<string, any>).enabled &&
                (sub as Record<string, any>).userInfo &&
                (sub as Record<string, any>).userInfo.total > 0 &&
                (sub as Record<string, any>).userInfo.total < REASONABLE_TRAFFIC_LIMIT_BYTES
            ) {
                const used =
                    ((sub as Record<string, any>).userInfo.upload || 0) +
                    ((sub as Record<string, any>).userInfo.download || 0);
                const remaining = (sub as Record<string, any>).userInfo.total - used;
                return acc + Math.max(0, remaining);
            }
            return acc;
        }, 0);
    });

    const subsTotalPages = computed(() =>
        Math.ceil(orderedFilteredSubscriptions.value.length / subsItemsPerPage)
    );
    const paginatedSubscriptions = computed(() => {
        const start = (subsCurrentPage.value - 1) * subsItemsPerPage;
        const end = start + subsItemsPerPage;
        return orderedFilteredSubscriptions.value.slice(start, end);
    });

    watch([searchQuery, () => filteredSubscriptions.value.length], () => {
        subsCurrentPage.value = 1;
    });

    watch([filteredSubscriptions, subsTotalPages], () => {
        if (subsCurrentPage.value > subsTotalPages.value) {
            subsCurrentPage.value = Math.max(1, subsTotalPages.value);
        }
    });

    function changeSubsPage(page: any) {
        if (page < 1 || page > subsTotalPages.value) return;
        subsCurrentPage.value = page;
    }

    async function handleUpdateNodeCount(subId: any, isInitialLoad = false) {
        // Find in the filtered list
        const subToUpdate = subscriptions.value.find(
            (s) => (s as Record<string, any>).id === subId
        );
        if (!subToUpdate) return false;
        // Double check URL just in case
        if (!(subToUpdate as Record<string, any>).url.startsWith('http')) return false;

        if (!isInitialLoad) {
            (subToUpdate as Record<string, any>).isUpdating = true;
        }

        // 添加超时保护:如果30秒后仍在更新状态,强制重置
        const timeoutId = setTimeout(() => {
            if ((subToUpdate as Record<string, any>).isUpdating) {
                console.warn(
                    `[handleUpdateNodeCount] Timeout protection triggered for ${(subToUpdate as Error).name}`
                );
                (subToUpdate as Record<string, any>).isUpdating = false;
                if (!isInitialLoad) {
                    showToast(
                        t('subscriptions.updateTimeoutReset', {
                            name: (subToUpdate as Error).name || t('subscriptions.fallbackName'),
                        }),
                        'warning'
                    );
                }
            }
        }, TIMING.REQUEST_TIMEOUT_MS);

        try {
            const result = await fetchNodeCount(
                (subToUpdate as Record<string, any>).url,
                (subToUpdate as Record<string, any>).fetchProxy,
                Boolean((subToUpdate as Record<string, any>).plusAsSpace),
                (subToUpdate as Record<string, any>).customUserAgent
            );

            // 清除超时保护
            clearTimeout(timeoutId);

            // 检查是否成功
            if (!result.success) {
                const subscriptionName =
                    (subToUpdate as Error).name || t('subscriptions.fallbackName');
                let userMessage = t('subscriptions.updateFailed', { name: subscriptionName });

                // 根据 errorType 提供更友好的错误提示
                switch ((result as Record<string, any>).errorType) {
                    case 'timeout':
                        userMessage = t('subscriptions.updateTimeoutRetry', {
                            name: subscriptionName,
                        });
                        break;
                    case 'network':
                        userMessage = t('subscriptions.networkFailed', { name: subscriptionName });
                        break;
                    case 'server':
                        userMessage = t('subscriptions.serverError', { name: subscriptionName });
                        break;
                    default:
                        userMessage = t('subscriptions.updateFailedWithMessage', {
                            name: subscriptionName,
                            message:
                                (result as Record<string, any>).error ||
                                t('subscriptions.unknownError'),
                        });
                }

                if (
                    (result as Record<string, any>).errorType === 'server' &&
                    ((result as Record<string, any>).error ||
                        (result as { status?: number }).status)
                ) {
                    userMessage = t('subscriptions.updateFailedWithMessage', {
                        name: subscriptionName,
                        message:
                            (result as Record<string, any>).error ||
                            `HTTP ${(result as { status?: number }).status}`,
                    });
                }

                // 只有非静默加载时才显示 Toast
                if (!isInitialLoad) showToast(userMessage, 'error');
                console.error(
                    `[handleUpdateNodeCount] Failed for ${(subToUpdate as Error).name}:`,
                    (result as Record<string, any>).error
                );

                // 重要: 记录错误到本地对象中(非持久化,仅用于UI展示,直到下次持久化保存)
                (subToUpdate as Record<string, any>).lastError = (
                    result as Record<string, any>
                ).error;
                if ((subToUpdate as Record<string, any>).enableNodeCache !== true) {
                    (subToUpdate as Record<string, any>).nodeCount = 0;
                    (subToUpdate as Record<string, any>).userInfo = null;
                    if (!isInitialLoad) {
                        markDirty();
                        void dataStore.saveData();
                    }
                }
                return false; // 开启保护性缓存节点时，失败保留旧值
            }

            // 成功获取数据
            const data =
                (result as Record<string, any>).data.data || (result as Record<string, any>).data; // 兼容后端返回结构
            (subToUpdate as Record<string, any>).nodeCount = data.count || 0;
            (subToUpdate as Record<string, any>).userInfo = data.userInfo || null;
            (subToUpdate as Record<string, any>).lastError = null; // 成功后清除错误状态
            // 记录上一次成功获取订阅的时间（随订阅一起持久化）
            (subToUpdate as Record<string, any>).lastFetchedAt = new Date().toISOString();

            if (!isInitialLoad) {
                showToast(
                    t('subscriptions.updateSuccess', {
                        name: (subToUpdate as Error).name || t('subscriptions.fallbackName'),
                    }),
                    'success'
                );
                markDirty();
                // 自动保存手动更新的结果
                void dataStore.saveData();
            }
            return true;
        } catch (error) {
            // 清除超时保护
            clearTimeout(timeoutId);

            handleError(error, 'Subscription Update Error', {
                subscriptionName: (subToUpdate as Error).name,
                subscriptionId: subId,
                isInitialLoad,
            });

            const errorMessage = t('subscriptions.updateUnexpectedError', {
                name: (subToUpdate as Error).name || t('subscriptions.fallbackName'),
            });
            if (!isInitialLoad) {
                showToast(errorMessage, 'error');
            }
            return false;
        } finally {
            if (subToUpdate) (subToUpdate as Record<string, any>).isUpdating = false;
        }
    }

    function addSubscription(sub: any) {
        dataStore.addSubscription(sub);
        subsCurrentPage.value = 1;
        handleUpdateNodeCount(sub.id);
        markDirty();
    }

    function updateSubscription(updatedSub: any) {
        // Verify it exists in our filtered list
        const originalSub = subscriptions.value.find(
            (s) => (s as Record<string, any>).id === updatedSub.id
        );
        if (originalSub) {
            const urlChanged = (originalSub as Record<string, any>).url !== updatedSub.url;
            dataStore.updateSubscription(updatedSub.id, updatedSub);

            if (urlChanged) {
                // Re-fetch from filtered list to get the reactive object
                const sub = subscriptions.value.find(
                    (s) => (s as Record<string, any>).id === updatedSub.id
                );
                if (sub) {
                    (sub as Record<string, any>).nodeCount = 0;
                    handleUpdateNodeCount((sub as Record<string, any>).id);
                }
            }
            markDirty();
        }
    }

    function deleteSubscription(subId: any) {
        dataStore.removeSubscription(subId);
        // 清理组合订阅中对该订阅源的引用
        dataStore.removeSubscriptionFromProfiles(subId);
        if (paginatedSubscriptions.value.length === 0 && subsCurrentPage.value > 1) {
            subsCurrentPage.value--;
        }
        markDirty();
    }

    function deleteAllSubscriptions() {
        // Only remove the subscriptions visible in this composable (i.e. HTTP subs)
        // Avoid removing manual nodes which are also in dataStore but filtered out here
        const idsToRemove = subscriptions.value.map((s) => (s as Record<string, any>).id);

        // 如果没有订阅，提示并返回
        if (idsToRemove.length === 0) {
            showToast(t('subscriptions.noSubscriptionsToDelete'), 'info');
            return;
        }

        idsToRemove.forEach((id) => dataStore.removeSubscription(id));
        // 清理组合订阅中对这些订阅源的引用
        dataStore.removeSubscriptionFromProfiles(idsToRemove);

        subsCurrentPage.value = 1;
        markDirty();
        showToast(t('subscriptions.clearedCount', { count: idsToRemove.length }), 'success');
    }

    async function addSubscriptionsFromBulk(subs: any) {
        // Reverse insert to maintain order
        for (let i = subs.length - 1; i >= 0; i--) {
            dataStore.addSubscription(subs[i]);
        }
        markDirty();

        const subsToUpdate = subs.filter((sub: any) => sub.url && sub.url.startsWith('http'));

        if (subsToUpdate.length > 0) {
            showToast(t('subscriptions.batchUpdating', { count: subsToUpdate.length }), 'info');

            // Use individual updates instead of batch backend update
            // This avoids 400 error because backend doesn't have these IDs yet.
            const updatePromises = subsToUpdate.map((sub: any) => handleUpdateNodeCount(sub.id));

            // handleUpdateNodeCount 内部已逐个提示失败，自身不抛出，
            // 所以 Promise.allSettled 恒为 fulfilled —— 原先包在这里的 try/catch 是死代码。
            // 改为按返回值统计真实失败数，避免「有失败却提示全部完成」。
            const results = await Promise.allSettled(updatePromises);
            const failedCount = results.filter(
                (result) => result.status === 'rejected' || result.value === false
            ).length;
            if (failedCount > 0) {
                showToast(
                    t('subscriptions.bulkUpdatePartial', {
                        failed: failedCount,
                        total: subsToUpdate.length,
                    }),
                    'warning'
                );
            } else {
                showToast(t('subscriptions.bulkImportUpdateDone'), 'success');
            }
        } else {
            showToast(t('subscriptions.bulkImportDone'), 'success');
        }
    }

    async function batchUpdateAllSubscriptions() {
        const subsToUpdate = subscriptions.value.filter(
            (sub) =>
                (sub as Record<string, any>).enabled &&
                (sub as Record<string, any>).url &&
                (sub as Record<string, any>).url.startsWith('http') &&
                !(sub as Record<string, any>).isUpdating
        );

        if (subsToUpdate.length === 0) {
            showToast(t('subscriptions.noRefreshableSubscriptions'), 'info');
            return;
        }

        isRefreshing.value = true;
        refreshError.value = false;
        subsToUpdate.forEach((sub) => {
            (sub as Record<string, any>).isUpdating = true;
        });
        showToast(t('subscriptions.refreshing', { count: subsToUpdate.length }), 'info');

        try {
            const result = await batchUpdateNodes(
                subsToUpdate.map((sub) => (sub as Record<string, any>).id)
            );

            if (result && result.success) {
                let successCount = 0;
                const resultList = Array.isArray(result.results) ? result.results : [];

                resultList.forEach((updateResult: any) => {
                    const id = updateResult.subscriptionId || updateResult.id;
                    const sub = subscriptions.value.find(
                        (s) => (s as Record<string, any>).id === id
                    );
                    if (!sub) return;

                    if (updateResult.success) {
                        (sub as Record<string, any>).nodeCount = updateResult.nodeCount || 0;
                        // 记录上一次成功获取订阅的时间（随订阅一起持久化）
                        (sub as Record<string, any>).lastFetchedAt = new Date().toISOString();
                        successCount++;
                    }
                });

                for (const sub of subsToUpdate) {
                    try {
                        const result = await fetchNodeCount((sub as Record<string, any>).url);
                        if (result.success && (result as Record<string, any>).data.userInfo) {
                            (sub as Record<string, any>).userInfo = (
                                result as Record<string, any>
                            ).data.userInfo;
                        }
                    } catch (error) {
                        if (isDev) {
                            console.debug(
                                '[Subscriptions] Failed to fetch node info during batch update:',
                                error
                            );
                        }
                    }
                }

                const failedCount = subsToUpdate.length - successCount;
                refreshError.value = failedCount > 0;
                showToast(
                    t('subscriptions.refreshDone', {
                        success: successCount,
                        total: subsToUpdate.length,
                        failed: failedCount,
                    }),
                    'success'
                );
                markDirty();
            } else {
                showToast(
                    t('subscriptions.refreshFailed', {
                        message: result?.message || t('subscriptions.unknownError'),
                    }),
                    'error'
                );
                refreshError.value = true;
                for (const sub of subsToUpdate) {
                    await handleUpdateNodeCount((sub as Record<string, any>).id);
                }
            }
        } catch (error) {
            refreshError.value = true;
            handleError(error, 'Batch Subscription Update Error', {
                subscriptionCount: subsToUpdate.length,
            });
            showToast(t('subscriptions.refreshFallback'), 'error');
            for (const sub of subsToUpdate) {
                await handleUpdateNodeCount((sub as Record<string, any>).id);
            }
        } finally {
            lastRefreshAt.value = new Date().toISOString();
            isRefreshing.value = false;
            subsToUpdate.forEach((sub) => {
                (sub as Record<string, any>).isUpdating = false;
            });
        }
    }

    // ========== 定时自动更新功能 ==========
    const DEFAULT_INTERVAL_MS = TIMING.AUTO_UPDATE_INTERVAL_MS;
    let autoUpdateTimerId: any = null;
    let currentIntervalMs = DEFAULT_INTERVAL_MS;

    async function autoUpdateAllSubscriptions() {
        try {
            const subsToUpdate = subscriptions.value.filter(
                (sub) =>
                    (sub as Record<string, any>).enabled &&
                    (sub as Record<string, any>).url &&
                    (sub as Record<string, any>).url.startsWith('http') &&
                    !(sub as Record<string, any>).isUpdating
            );
            for (const sub of subsToUpdate) {
                await handleUpdateNodeCount((sub as Record<string, any>).id, true);
            }
        } catch (e) {
            // 后台定时任务：handleUpdateNodeCount 内部已逐个提示失败，
            // 且用户此刻可能不在页面上，这里只记日志，避免无意义的打扰。
            console.error('Auto update failed', e);
        }
    }

    function startAutoUpdate(intervalMinutes: any = null) {
        // 如果传入间隔，使用传入值；否则从 settings 读取
        let intervalMs;
        if (intervalMinutes !== null) {
            intervalMs = intervalMinutes * 60 * 1000;
        } else {
            const settings = dataStore.settings;
            const settingsInterval = Number(settings?.autoUpdateInterval);
            if (settingsInterval === 0) {
                intervalMs = 0;
            } else if (Number.isFinite(settingsInterval) && settingsInterval > 0) {
                intervalMs = settingsInterval * 60 * 1000;
            } else {
                intervalMs = DEFAULT_INTERVAL_MS;
            }
        }

        // 如果间隔为0，表示禁用自动更新
        if (intervalMs === 0) {
            stopAutoUpdate();
            if (isDev) console.debug('[AutoUpdate] Disabled by user setting');
            return;
        }

        // 如果间隔没变且定时器已运行，不需要重启
        if (autoUpdateTimerId && intervalMs === currentIntervalMs) {
            return;
        }

        // 停止旧定时器
        stopAutoUpdate();

        // 启动新定时器
        currentIntervalMs = intervalMs;
        autoUpdateTimerId = setInterval(() => {
            void autoUpdateAllSubscriptions();
        }, intervalMs);

        if (isDev)
            console.debug(`[AutoUpdate] Started with interval: ${intervalMs / 60000} minutes`);
    }

    function stopAutoUpdate() {
        if (autoUpdateTimerId) {
            clearInterval(autoUpdateTimerId);
            autoUpdateTimerId = null;
            if (isDev) console.debug('[AutoUpdate] Stopped');
        }
    }

    function restartAutoUpdate(intervalMinutes: any) {
        stopAutoUpdate();
        startAutoUpdate(intervalMinutes);
    }

    function reorderSubscriptions(newOrder: any) {
        // 1. Get all Manual Nodes (to preserve them)
        // We can't rely just on manualNodes computed because it might be filtered or not imported here.
        // Instead, filter from source of truth: allSubscriptions
        const currentManualNodes = (allSubscriptions.value || []).filter(
            (item) =>
                !(item as Record<string, any>).url ||
                !/^https?:\/\//.test((item as Record<string, any>).url)
        );

        // 2. Combine New Ordered Subscriptions + Existing Manual Nodes
        // Logic: Manual Nodes at top, Subscriptions at bottom
        const mergedList = [...currentManualNodes, ...newOrder];

        // 3. Update Store
        dataStore.overwriteSubscriptions(mergedList);

        // 4. Mark Dirty
        markDirty();
    }

    return {
        subscriptions,
        searchQuery,
        filteredSubscriptions,
        filteredCount: computed(() => filteredSubscriptions.value.length),
        isRefreshing,
        refreshError,
        lastRefreshAt,
        subsCurrentPage,
        subsTotalPages,
        paginatedSubscriptions,
        totalRemainingTraffic,
        enabledSubscriptionsCount: computed(() => enabledSubscriptions.value.length),
        changeSubsPage,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        deleteAllSubscriptions,
        addSubscriptionsFromBulk,
        handleUpdateNodeCount,
        batchUpdateAllSubscriptions,
        startAutoUpdate,
        stopAutoUpdate,
        restartAutoUpdate,
        reorderSubscriptions,
    };
}
