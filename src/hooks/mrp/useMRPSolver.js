/**
 * useMRPSolver.js
 * 
 * "The Engine"
 * A pure calculation module that drafts a proposed schedule to solve inventory gaps.
 * It does NOT mutate state directly. It returns a proposal object.
 */
import { getLocalISOString, addDays } from '../../utils/dateUtils';

export function useMRPSolver() {

    const solve = (currentResults, safetyStockLoads, bottleDefinitions, selectedSize, schedulerSettings, state, effectiveLeadTime) => {
        // Validation
        if (!currentResults || !currentResults.dailyResults || !selectedSize || !bottleDefinitions[selectedSize]) {
            console.warn("Solver: Missing Data", { currentResults, selectedSize });
            return null;
        }

        const specs = bottleDefinitions[selectedSize];

        // 1. Inputs
        const plannedInbound = { ...(state.monthlyInbound || {}) }; // Mutable copy
        const dailyResults = currentResults.dailyResults; // Sorted Array Day 1 -> N

        // Lead Time Gate (Frozen Period)
        const todayStr = getLocalISOString();
        // Use specific lead time if provided, else fallback to global setting
        const frozenDays = effectiveLeadTime !== undefined ? effectiveLeadTime : (schedulerSettings?.leadTimeDays || 2);
        const frozenUntil = addDays(todayStr, frozenDays);

        let cumulativeAddedBottles = 0; // The "Rolling Wave" of added inventory
        const proposedUpdates = {};

        // 2. Iterate Logic
        // We TRUST 'dailyResults' for the base projection.
        // We only add our OWN adjustments on top.

        let operationsCount = 0;

        dailyResults.forEach((day, index) => {
            const dateStr = day.dateStr;

            // Base Inventory (from Grid Calculation)
            const baseInventory = day.projectedEndInventory;

            // Adjusted Inventory (Base + What we added in previous loops)
            const adjustedInventory = baseInventory + cumulativeAddedBottles;

            // Lead Time Gate (Frozen Period)
            // Strict enforcement: We cannot plan orders inside the frozen window.
            if (dateStr <= frozenUntil) return;

            // Skip updates if Actuals represent a locked reality (Past)
            if (state.monthlyProductionActuals && state.monthlyProductionActuals[dateStr]) return;

            // Target Calc (Use Day's own target if calculated, else fallback)
            const safetyTarget = day.safetyStockTarget || ((specs.productionRate * 24) * (safetyStockLoads || 2));

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
                // If we have AT LEAST 1 full truck of excess above Buffer...
                // And there is a truck planned for this day...
                // We can remove it.

                let currentPlan = Number(plannedInbound[dateStr] || 0);

                if (currentPlan > 0) {
                    const surplus = adjustedInventory - safetyTarget;
                    // How many can we remove without going under?
                    const maxRemovable = Math.floor(surplus / specs.bottlesPerTruck);
                    // Limit by what is actually there
                    const toRemove = Math.min(maxRemovable, currentPlan);

                    if (toRemove > 0) {
                        const newPlan = currentPlan - toRemove;
                        plannedInbound[dateStr] = newPlan;
                        proposedUpdates[dateStr] = newPlan;

                        // We removed supply, so we SUBTRACT from the cumulative wave (making it negative/less positive)
                        // Wait, 'cumulativeAdded' is added to base.
                        // Removing 1 truck = -Loads.
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
