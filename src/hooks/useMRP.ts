import { useMemo } from 'react';
import { useMRPState } from './mrp/useMRPState';
import { useMRPCalculations } from './mrp/useMRPCalculations';
import { useMRPActions } from './mrp/useMRPActions';
import { CalculateMRPResult } from '../utils/mrpLogic';

export function useMRP(poManifest: any = {}) {
    // 1. State & Persistence
    const state = useMRPState(); // poManifest is not passed to state, it seems. Original code didn't pass it to useMRPState either.

    // 1.5 Filter & Merge Manifest (Manual POs + SAP Data)
    const filteredManifest = useMemo(() => {
        const filtered: any = {};

        // A. Process Global POs (Manual entries from ProcurementContext)
        if (state.selectedSize && poManifest) {
            Object.entries(poManifest).forEach(([date, day]: [string, any]) => {
                const items = day.items?.filter((item: any) => item.sku === state.selectedSize) || [];
                if (items.length > 0) {
                    filtered[date] = { items: [...items] };
                }
            });
        }

        // B. Merge Product-Specific Manifest (Includes SAP Imports & Manual planning entries)
        if (state.truckManifest) {
            Object.entries(state.truckManifest).forEach(([date, items]: [string, any]) => {
                if (!Array.isArray(items)) return;

                if (!filtered[date]) filtered[date] = { items: [] };

                items.forEach((item: any) => {
                    // Avoid duplicates if the same PO is in both (prefer ProcurementContext data if clash)
                    const isDuplicate = filtered[date].items.some((existing: any) =>
                        (existing.po && item.po && existing.po === item.po) ||
                        (existing.id && item.id && existing.id === item.id)
                    );

                    if (!isDuplicate) {
                        filtered[date].items.push(item);
                    }
                });
            });
        }

        return filtered;
    }, [poManifest, state.selectedSize, state.truckManifest]);

    // 2. Calculations (Pure Logic)
    const { calculations, totalScheduledCases, productionRate } = useMRPCalculations(state, filteredManifest);

    // 3. Actions (Handlers)
    const actionDeps = useMemo<{ calculations: CalculateMRPResult | null }>(() => ({ calculations }), [calculations]);
    const { setters, formState: actionFormState } = useMRPActions(state, actionDeps);

    // 4. Combine & Return (Maintaining Original API Surface)
    return {
        formState: {
            // Merge state from useMRPState
            selectedSize: state.selectedSize,
            monthlyDemand: state.monthlyDemand,
            monthlyProductionActuals: state.monthlyProductionActuals,
            monthlyInbound: state.monthlyInbound,
            truckManifest: state.truckManifest,
            downtimeHours: state.downtimeHours,
            currentInventoryPallets: state.currentInventoryPallets,
            incomingTrucks: state.incomingTrucks,
            yardInventory: state.yardInventory,

            isAutoReplenish: state.isAutoReplenish,
            inventoryAnchor: state.inventoryAnchor,

            // Merge values from calculations
            productionRate: actionFormState.productionRate ?? productionRate, // Prefer local optimistic state
            totalScheduledCases,

            // Merge values from actions
            isSaving: actionFormState.isSaving,
            saveError: actionFormState.saveError,
        },
        setters,
        results: calculations ? {
            ...calculations,
            poManifest: filteredManifest // Pass filtered manifest to UI
        } : null,
        refreshData: state.refreshData
    };
}
