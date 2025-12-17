import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSupabaseSync } from './useSupabaseSync';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export interface SKUActivity {
    sku: string;
    demand: number;
    actual: number | null;
    trucks: number;
}

export interface MasterLedger {
    [date: string]: SKUActivity[];
}

interface SKUStateData {
    demand: Record<string, number>;
    actuals: Record<string, number>;
    inbound: Record<string, number>;
}

export function useMasterSchedule(bottleSizes: string[], enabled: boolean = true) {
    const { user } = useAuth();
    const { fetchMRPState } = useSupabaseSync();

    // State: Map of SKU -> MRP State
    const [skuStates, setSkuStates] = useState<Record<string, SKUStateData>>({});
    const [loading, setLoading] = useState(false);

    // Trigger for re-fetching
    const [resyncCounter, setResyncCounter] = useState(0);

    // Debounce Ref
    const resyncTimeoutRef = useRef<any>(null);

    // 1. Fetch All SKUs
    useEffect(() => {
        if (!enabled) return; // Lazy load

        const loadAll = async () => {
            // If disabled, don't load
            if (!enabled) return;
            setLoading(true);
            const newState: Record<string, SKUStateData> = {};

            // Helper to get local state
            const getLocalState = (key: string, sku: string): Record<string, number> => {
                const legacyKey = `mrp_${key}`;
                const fullKey = `mrp_${sku}_${key}`;
                // Fallback logic
                let saved = localStorage.getItem(fullKey);
                if (saved === null && sku === '20oz') saved = localStorage.getItem(legacyKey); // Legacy fallback only for 20oz

                try { return JSON.parse(saved || '{}'); }
                catch { return {}; }
            };

            const promises = bottleSizes.map(async (sku) => {
                if (user) {
                    // Cloud Load
                    try {
                        const data = await fetchMRPState(user.id, sku);
                        return {
                            sku,
                            data: data ? {
                                demand: data.monthlyDemand || {},
                                actuals: data.monthlyProductionActuals || {},
                                inbound: data.monthlyInbound || {}
                            } : { demand: {}, actuals: {}, inbound: {} }
                        };
                    } catch (e) {
                        console.error(`Failed to load master state for ${sku}`, e);
                        return { sku, data: { demand: {}, actuals: {}, inbound: {} } };
                    }
                } else {
                    // Local Load
                    return {
                        sku,
                        data: {
                            demand: getLocalState('monthlyDemand', sku),
                            actuals: getLocalState('monthlyProductionActuals', sku),
                            inbound: getLocalState('monthlyInbound', sku)
                        }
                    };
                }
            });

            const results = await Promise.all(promises);
            results.forEach(({ sku, data }) => {
                newState[sku] = data as SKUStateData; // Type assertion needed due to complex inference
            });

            setSkuStates(newState);
            setLoading(false);
        };

        if (bottleSizes.length > 0) loadAll();

        // Fix: bottleSizes might be a new reference every render. Use a string key for stability.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bottleSizes.join(','), user?.id, enabled, resyncCounter]);

    // --- REALTIME SYNC ---
    // Listen for ANY changes to planning_entries and reload all.
    useRealtimeSubscription({
        table: 'planning_entries',
        enabled: enabled && !!user,
        onDataChange: () => {
            // Debounce updates to prevent swamping the UI (wait 1s after last event)
            if (resyncTimeoutRef.current) clearTimeout(resyncTimeoutRef.current);

            resyncTimeoutRef.current = setTimeout(() => {
                setResyncCounter(c => c + 1);
            }, 1000);
        }
    });

    // 2. Aggregate into Master Ledger
    const masterLedger = useMemo(() => {
        const ledger: MasterLedger = {};

        const allDates = new Set<string>();
        Object.values(skuStates).forEach(state => {
            Object.keys(state.demand).forEach(d => allDates.add(d));
            Object.keys(state.actuals).forEach(d => allDates.add(d));
            Object.keys(state.inbound).forEach(d => allDates.add(d));
        });

        // Sort dates
        const sortedDates = Array.from(allDates).sort();

        sortedDates.forEach(dateStr => {
            const dayActivity: SKUActivity[] = [];

            bottleSizes.forEach(sku => {
                const state = skuStates[sku];
                if (!state) return;

                const dem = Number(state.demand[dateStr]) || 0;
                const act = state.actuals[dateStr] !== undefined ? Number(state.actuals[dateStr]) : null;
                const trk = Number(state.inbound[dateStr]) || 0;

                // Only add if there is something happening
                if (dem > 0 || (act !== null && act > 0) || trk > 0) {
                    dayActivity.push({
                        sku,
                        demand: dem,
                        actual: act,
                        trucks: trk
                    });
                }
            });

            if (dayActivity.length > 0) {
                ledger[dateStr] = dayActivity;
            }
        });

        return ledger;
    }, [skuStates, bottleSizes]);

    return {
        masterLedger,
        loading,
        skuStates // exposed if needed
    };
}
