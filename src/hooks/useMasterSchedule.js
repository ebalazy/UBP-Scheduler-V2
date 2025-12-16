import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSupabaseSync } from './useSupabaseSync';

export function useMasterSchedule(bottleSizes, enabled = true) {
    const { user } = useAuth();
    const { fetchMRPState } = useSupabaseSync();

    // State: Map of SKU -> MRP State
    // { "20oz": { monthlyDemand: {}, ... }, "12oz": ... }
    const [skuStates, setSkuStates] = useState({});
    const [loading, setLoading] = useState(false);

    // 1. Fetch All SKUs
    useEffect(() => {
        if (!enabled) return; // Lazy load

        const loadAll = async () => {
            setLoading(true);
            const newState = {};

            // Helper to get local state
            const getLocalState = (key, sku) => {
                const legacyKey = `mrp_${key}`;
                const fullKey = `mrp_${sku}_${key}`;
                // Fallback logic
                let saved = localStorage.getItem(fullKey);
                if (saved === null && sku === '20oz') saved = localStorage.getItem(legacyKey); // Legacy fallback only for 20oz

                try { return JSON.parse(saved) || {}; }
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
                newState[sku] = data;
            });

            setSkuStates(newState);
            setLoading(false);
        };

        if (bottleSizes.length > 0) loadAll();

    }, [bottleSizes, user, fetchMRPState, enabled]); // Re-run if enabled toggles

    // 2. Aggregate into Master Ledger
    const masterLedger = useMemo(() => {
        // Date -> Array of SKU Activity
        // { "2023-10-14": [ { sku: "20oz", run: 5000, trucks: 0 }, ... ] }
        const ledger = {};
        const today = new Date();

        // Look ahead 60 days + Look back 7 days? 
        // Or just iterate all keys found?
        // Let's do a wide range to catch everything.

        const allDates = new Set();
        Object.values(skuStates).forEach(state => {
            Object.keys(state.demand).forEach(d => allDates.add(d));
            Object.keys(state.actuals).forEach(d => allDates.add(d));
            Object.keys(state.inbound).forEach(d => allDates.add(d));
        });

        // Sort dates
        const sortedDates = Array.from(allDates).sort();

        sortedDates.forEach(dateStr => {
            const dayActivity = [];

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
