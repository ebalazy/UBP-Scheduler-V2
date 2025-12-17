import { useMemo } from 'react';
import { useMRPState } from './mrp/useMRPState';
import { useMRPCalculations } from './mrp/useMRPCalculations';
import { useMRPActions } from './mrp/useMRPActions';
import { CalculateMRPResult } from '../utils/mrpLogic';

interface UseMRPProps {
    poManifest?: any;
}

export function useMRP(poManifest: any = {}) {
    // 1. State & Persistence
    const state = useMRPState(); // poManifest is not passed to state, it seems. Original code didn't pass it to useMRPState either.

    // 2. Calculations (Pure Logic)
    const { calculations, totalScheduledCases, productionRate } = useMRPCalculations(state, poManifest);

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
        results: calculations
    };
}
