
import { getLocalISOString, addDays } from '../../utils/dateUtils';
import { MRPSpecs, CalculateMRPResult, DailyLedgerItem } from '../../utils/mrpLogic';

interface SolveParams {
    currentResults: CalculateMRPResult | null;
    safetyStockLoads: number;
    bottleDefinitions: Record<string, MRPSpecs>;
    selectedSize: string;
    schedulerSettings: any; // Ideally typed
    state: any; // Ideally typed
    effectiveLeadTime?: number;
}

export function useMRPSolver() {

    const solve = (
        currentResults: CalculateMRPResult | null,
        safetyStockLoads: number,
        bottleDefinitions: Record<string, MRPSpecs>,
        selectedSize: string,
        schedulerSettings: any,
        state: any,
        effectiveLeadTime?: number
    ) => {
        // Validation
        if (!currentResults || !currentResults.dailyResults || !selectedSize || !bottleDefinitions[selectedSize]) {
            console.warn("Solver: Missing Data", { currentResults, selectedSize });
            return null;
        }

        const specs = bottleDefinitions[selectedSize];

        // 1. Inputs
        const plannedInbound: Record<string, number> = { ...(state.monthlyInbound || {}) }; // Mutable copy
        const dailyResults = currentResults.dailyResults; // Sorted Array Day 1 -> N

        // Lead Time Gate (Frozen Period)
        const todayStr = getLocalISOString();
        // Use specific lead time if provided, else fallback to global setting
        const frozenDays = effectiveLeadTime !== undefined ? effectiveLeadTime : (schedulerSettings?.leadTimeDays || 2);
        // Fix: Subtract 1 day. 
        const frozenUntil = addDays(todayStr, Math.max(0, frozenDays - 1));

        let cumulativeAddedBottles = 0; // The "Rolling Wave" of added inventory
        const proposedUpdates: Record<string, number> = {};

        // 2. Iterate Logic
        let operationsCount = 0;

        dailyResults.forEach((day: DailyLedgerItem, index: number) => {
            const dateStr = day.dateStr;

            // Base Inventory (from Grid Calculation)
            const baseInventory = day.projectedEndInventory;

            // Adjusted Inventory (Base + What we added in previous loops)
            const adjustedInventory = baseInventory + cumulativeAddedBottles;

            // Lead Time Gate (Frozen Period)
            if (dateStr <= frozenUntil) return;

            // Skip updates if Actuals represent a locked reality (Past)
            if (state.monthlyProductionActuals && state.monthlyProductionActuals[dateStr]) return;

            // Target Calc
            const safetyTarget = day.safetyStockTarget || ((safetyStockLoads || 0) * specs.bottlesPerTruck);

            // Deficit?
            if (adjustedInventory < safetyTarget) {
                const deficit = safetyTarget - adjustedInventory;
                const trucksNeeded = Math.ceil(deficit / specs.bottlesPerTruck);

                if (trucksNeeded > 0) {
                    // Update the Plan
                    const currentPlan = plannedInbound[dateStr] || 0;
                    const newPlan = Number(currentPlan) + trucksNeeded;

                    plannedInbound[dateStr] = newPlan;
                    proposedUpdates[dateStr] = newPlan;

                    // Accumulate for future days
                    cumulativeAddedBottles += (trucksNeeded * specs.bottlesPerTruck);
                    operationsCount++;
                }
            }
            // Excess? (Reduce Trucks)
            else if (adjustedInventory > (safetyTarget + specs.bottlesPerTruck)) {
                let currentPlan = Number(plannedInbound[dateStr] || 0);

                if (currentPlan > 0) {
                    const surplus = adjustedInventory - safetyTarget;
                    const maxRemovable = Math.floor(surplus / specs.bottlesPerTruck);
                    const toRemove = Math.min(maxRemovable, currentPlan);

                    if (toRemove > 0) {
                        const newPlan = currentPlan - toRemove;
                        plannedInbound[dateStr] = newPlan;
                        proposedUpdates[dateStr] = newPlan;

                        cumulativeAddedBottles -= (toRemove * specs.bottlesPerTruck);
                        operationsCount++;
                    }
                }
            }
        });

        // 3. Return Result
        return {
            newInbound: plannedInbound,
            updatesCount: operationsCount
        };
    };

    return { solve };
}
