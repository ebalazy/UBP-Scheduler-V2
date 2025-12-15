/**
 * useMRPSolver.js
 * 
 * "The Engine"
 * A pure calculation module that drafts a proposed schedule to solve inventory gaps.
 * It does NOT mutate state directly. It returns a proposal object.
 */
import { getLocalISOString, addDays } from '../../utils/dateUtils';

export function useMRPSolver() {

    const solve = (currentResults, safetyStockDays, bottleDefinitions, selectedSize, schedulerSettings, state) => {
        if (!currentResults || !selectedSize || !bottleDefinitions[selectedSize]) return null;

        const specs = bottleDefinitions[selectedSize];
        const shiftStart = schedulerSettings?.shiftStartTime || '00:00';

        // 1. Clone inputs to ensure no side effects
        const plannedInbound = { ...(state.monthlyInbound || {}) }; // Mutable copy of current plan
        const dailyResults = currentResults.dailyResults || [];

        let runningInventory = currentResults.yardInventory.count; // Start with current Yard

        // 2. Iterate strictly chronologically (Forward Pass)
        // We need to re-simulate because changing Day 1 affects derived start for Day 2.

        const proposedUpdates = {}; // { "2023-12-15": 3, "2023-12-16": 1 }

        dailyResults.forEach((day, index) => {
            const dateStr = day.dateStr;
            const productionDemand = day.productionDemand || 0;

            // Get current planned (or 0)
            const existingPlannedCount = plannedInbound[dateStr] || 0;
            let newPlannedCount = existingPlannedCount;

            // Inbound Bottles
            const inboundBottles = newPlannedCount * specs.bottlesPerTruck;

            // End of Day (Projected)
            // Start + Inbound - Demand
            // Note: Simplification - ignoring intraday timing for this crude solver.
            // Solver ensures *Midnight* inventory is safe.
            let endOfDayInventory = runningInventory + inboundBottles - productionDemand;

            // Safety Threshold
            // Safety Stock is calculated based on FUTURE demand usually, but here we use the daily target from results?
            // Or simple: 2 days of avg demand.
            // Let's use the 'safetyTarget' calculated in dailyResults if available, else calc it.
            // dailyResults usually has 'safetyStockTarget' calculated per day.
            const safetyTarget = day.safetyStockTarget || (specs.productionRate * 24 * (safetyStockDays || 0));

            // GAP ANALYSIS
            if (endOfDayInventory < safetyTarget) {
                const deficit = safetyTarget - endOfDayInventory;
                const trucksNeeded = Math.ceil(deficit / specs.bottlesPerTruck);

                if (trucksNeeded > 0) {
                    newPlannedCount += trucksNeeded;
                    // Update running inventory for next loop
                    endOfDayInventory += (trucksNeeded * specs.bottlesPerTruck);

                    // Add to proposal
                    proposedUpdates[dateStr] = newPlannedCount;
                }
            }

            // Carry forward to next day
            runningInventory = endOfDayInventory;
        });

        // 3. Return the delta (or full object)
        // We return the full new monthlyInbound object to simply replace the specific days.
        const newMonthlyInbound = { ...plannedInbound, ...proposedUpdates };

        return {
            newInbound: newMonthlyInbound,
            updatesCount: Object.keys(proposedUpdates).length
        };
    };

    return { solve };
}
