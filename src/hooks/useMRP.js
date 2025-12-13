import { useMRPState } from './mrp/useMRPState';
import { useMRPCalculations } from './mrp/useMRPCalculations';
import { useMRPActions } from './mrp/useMRPActions';

export function useMRP(poManifest = {}) {
    // 1. State & Persistence
    const state = useMRPState(poManifest);

    // 2. Calculations (Pure Logic)
    // Returns { totalScheduledCases, productionRate, calculations }
    const { calculations, totalScheduledCases, productionRate } = useMRPCalculations(state, poManifest);

    // 3. Actions (Handlers)
    // Returns { setters, formState }
    const { setters, formState: actionFormState } = useMRPActions(state, { calculations });

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
            manualYardOverride: state.manualYardOverride,
            isAutoReplenish: state.isAutoReplenish,
            inventoryAnchor: state.inventoryAnchor,

            // Merge values from calculations
            productionRate, // Derived from settings in hook
            totalScheduledCases,

            // Merge values from actions
            isSaving: actionFormState.isSaving,
            saveError: actionFormState.saveError,
        },
        setters,
        results: calculations
    };
}
