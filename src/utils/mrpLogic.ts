/**
 * mrpLogic.js
 * Pure business logic for MRP calculations.
 * Decoupled from React State/Contexts for easy testing.
 */

import { addDays } from './dateUtils'; // Assuming dateUtils is pure

export const calculateMRP = ({
    todayStr, // "YYYY-MM-DD"
    productionRate, // Bottles per hour
    downtimeHours,
    // selectedSize, // SKU Name (used for logging only - temporarily unused)
    bottleSpecs, // { bottlesPerCase, bottlesPerTruck, casesPerPallet, scrapPercentage }
    inventoryAnchor, // { date: "YYYY-MM-DD", count: Number (Pallets) }
    yardInventory, // { count: Number (Loads), date: "YYYY-MM-DD" }
    incomingTrucks, // Number (Manual override for today?)
    monthlyDemand, // { [date]: Number (Cases) }
    monthlyProductionActuals, // { [date]: Number (Cases) }
    monthlyInbound, // { [date]: Number (Trucks) } - Manual Plan
    poManifest, // { [date]: { items: [{...}] } } - Confirmed POs
    safetyStockLoads, // Number (Loads) implementation setting
    leadTimeDays = 2, // Lead time for material delivery (days)
}) => {

    // 0. Defaults & Safety
    if (!bottleSpecs) return null;

    const specs = bottleSpecs;
    const scrapFactor = 1 + ((specs.scrapPercentage || 0) / 100);
    const bottlesPerCase = specs.bottlesPerCase || 12; // Avoid div/0
    const bottlesPerTruck = specs.bottlesPerTruck || 1; // Avoid div/0
    const casesPerPallet = specs.casesPerPallet || 1;

    // 1. Calculate Total Scheduled production (Demand + Actuals)
    const allDates = new Set([...Object.keys(monthlyDemand || {}), ...Object.keys(monthlyProductionActuals || {})]);

    const totalScheduledCases = Array.from(allDates).reduce((acc, date) => {
        if (date >= todayStr) {
            const actual = monthlyProductionActuals[date];
            const plan = monthlyDemand[date];

            // Logic: Actuals override Plan, UNLESS it's a future date and Actual is 0 (assuming 0 means not entered yet vs valid 0 production)
            // Note: If Actual is explicitly 0 for today, it counts as 0. 
            const isFuture = date > todayStr;
            const useActual = (actual !== undefined && actual !== null) && (!isFuture || Number(actual) !== 0);

            const val = useActual ? Number(actual) : Number(plan);
            return acc + (val || 0);
        }
        return acc;
    }, 0);

    // 2. Adjust for Downtime
    const lostProductionCases = downtimeHours * productionRate;
    const effectiveScheduledCases = Math.max(0, totalScheduledCases - lostProductionCases);

    // 3. Helper: Get Daily Trucks (Source of Truth Logic)
    const getDailyTrucks = (date) => {
        // 1. If POs exist for this date, they are the Truth.
        if (poManifest && poManifest[date]?.items?.length > 0) {
            return poManifest[date].items.length;
        }
        // 2. Fallback to Manual Count (Plan)
        return Number(monthlyInbound[date]) || 0;
    };

    // 4. Calculate Incoming Supply (Total Future) - used for broad KPI
    const allInboundDates = new Set([...Object.keys(monthlyInbound), ...Object.keys(poManifest || {})]);
    const totalScheduledInbound = Array.from(allInboundDates).reduce((acc, date) => {
        if (date >= todayStr) {
            return acc + getDailyTrucks(date);
        }
        return acc;
    }, 0);

    const totalIncomingTrucks = (incomingTrucks || 0) + totalScheduledInbound;
    const incomingBottles = totalIncomingTrucks * bottlesPerTruck;

    // 5. Yard Inventory
    // Yard Inventory is usually in "Loads" (Trucks)
    const effectiveYardLoads = yardInventory?.count || 0;
    const yardBottles = effectiveYardLoads * bottlesPerTruck;

    // 6. Floor Inventory (Derived from Anchor)
    let derivedPallets = inventoryAnchor.count;

    if (inventoryAnchor.date) {
        // Simple diff in days, assuming mostly linear time (not dealing with timezones heavily here as strings are ISO YYYY-MM-DD)
        const d1 = new Date(inventoryAnchor.date);
        const d2 = new Date(todayStr);
        const diffTime = d2 - d1;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
            for (let i = 0; i < diffDays; i++) {
                const ds = addDays(inventoryAnchor.date, i);

                // Re-using the Demand/Actual Logic for past dates
                const actual = monthlyProductionActuals[ds];
                const plan = monthlyDemand[ds];
                const isFuture = ds > todayStr; // Should be false here usually
                const useActual = (actual !== undefined && actual !== null) && (!isFuture || Number(actual) !== 0);
                const dDemandCases = useActual ? Number(actual) : Number(plan || 0);

                const dInboundTrucks = getDailyTrucks(ds);

                // Math: 
                // Pallets gained = Trucks * PalletsPerTruck
                // Pallets lost = CasesProduced / CasesPerPallet

                const palletsPerTruck = (bottlesPerTruck / bottlesPerCase) / casesPerPallet;
                const dInboundPallets = dInboundTrucks * palletsPerTruck;
                const dDemandPallets = dDemandCases / casesPerPallet;

                derivedPallets = derivedPallets + dInboundPallets - dDemandPallets;
            }
        }
    }

    const inventoryBottles = derivedPallets * casesPerPallet * bottlesPerCase;

    // Net Inventory (Current snapshot estimate)
    const demandBottles = effectiveScheduledCases * bottlesPerCase * scrapFactor;
    // Note: This netInventory formula matches the original hook but seems to mix "Instant Snapshot" with "Future Demand"? 
    // Original: (inventoryBottles + incomingBottles + yardBottles) - demandBottles;
    // Where 'demandBottles' is effectiveScheduledCases (Future Sum).
    // So 'Net Inventory' here means "Projected Ending Inventory after ALL scheduled production is done"? 
    // Yes, that seems to be the intent of the Top-Level KPI.
    const netInventory = (inventoryBottles + incomingBottles + yardBottles) - demandBottles;

    const safetyTarget = safetyStockLoads * bottlesPerTruck;


    // 7. Daily Ledger (Forward Projection 30 Days)
    const dailyLedger = [];
    let currentBalance = inventoryBottles + yardBottles;
    let firstStockoutDate = null;
    let firstOverflowDate = null;

    for (let i = 0; i < 30; i++) {
        const dateStr = addDays(todayStr, i);

        // Demand
        const actual = monthlyProductionActuals[dateStr];
        const plan = monthlyDemand[dateStr];
        const isFuture = dateStr > todayStr;
        const useActual = (actual !== undefined && actual !== null) && (!isFuture || Number(actual) !== 0);
        const dailyCases = useActual ? Number(actual) : Number(plan || 0);

        const dailyDemand = dailyCases * bottlesPerCase * scrapFactor;

        // Supply
        const dailyTrucks = getDailyTrucks(dateStr);
        const dailySupply = dailyTrucks * bottlesPerTruck;

        currentBalance = currentBalance + dailySupply - dailyDemand;

        dailyLedger.push({
            date: dateStr,
            dateStr: dateStr,
            balance: currentBalance,
            demand: dailyDemand,
            supply: dailySupply,
            projectedEndInventory: currentBalance,
            projectedPallets: currentBalance / ((bottlesPerCase * casesPerPallet) || 1),
            daysOfSupply: 0
        });

        if (currentBalance < safetyTarget && !firstStockoutDate) {
            firstStockoutDate = dateStr;
        }
        if (currentBalance > (safetyTarget + bottlesPerTruck * 2) && !firstOverflowDate) {
            firstOverflowDate = dateStr;
        }
    }

    // 8. KPI Recommendations (FIXED: Account for Lead Time)
    // Only count inventory that's available NOW or arriving within lead time window
    let inboundWithinLeadTime = incomingTrucks || 0; // Today's manual override

    // Count trucks arriving within lead time
    for (let i = 0; i <= leadTimeDays; i++) {
        const checkDate = addDays(todayStr, i);
        inboundWithinLeadTime += getDailyTrucks(checkDate);
    }

    const inboundBottlesWithinLeadTime = inboundWithinLeadTime * bottlesPerTruck;
    const availableInventory = inventoryBottles + yardBottles + inboundBottlesWithinLeadTime;

    // TRUE MRP: Calculate demand within lead time window
    let demandWithinLeadTime = 0;
    for (let i = 0; i <= leadTimeDays; i++) {
        const checkDate = addDays(todayStr, i);
        const dailyDemand = (monthlyDemand[checkDate] || 0) * bottlesPerCase * scrapFactor;
        demandWithinLeadTime += dailyDemand;
    }

    // Total material need = demand to fulfill + safety buffer to maintain
    const totalMaterialNeed = demandWithinLeadTime + safetyTarget;

    let trucksToOrder = 0;
    let trucksToCancel = 0;

    if (availableInventory < totalMaterialNeed) {
        // Order to cover: (demand within lead time + safety stock) - available inventory
        trucksToOrder = Math.ceil((totalMaterialNeed - availableInventory) / bottlesPerTruck);
    } else if (availableInventory > safetyTarget + demandWithinLeadTime + bottlesPerTruck) {
        // Only suggest cancellations if we have excess AVAILABLE inventory (not just distant future supply)
        // Must exceed: safety stock + demand within lead time + 1 extra truck buffer
        const immediateExcess = availableInventory - (safetyTarget + demandWithinLeadTime);
        if (immediateExcess > bottlesPerTruck) {
            trucksToCancel = Math.min(
                Math.floor(immediateExcess / bottlesPerTruck),
                totalIncomingTrucks
            );
        }
    }

    // 9. DoS Calc
    let daysOfSupply = 30;
    if (dailyLedger.length > 0) {
        const stockoutIndex = dailyLedger.findIndex(d => d.balance < 0);
        if (stockoutIndex !== -1) {
            const failingDay = dailyLedger[stockoutIndex];
            // Balance at end of PREV day (start of failing day)
            const prevBalance = stockoutIndex > 0 ? dailyLedger[stockoutIndex - 1].balance : (inventoryBottles + yardBottles);

            let partial = 0;
            if (failingDay.demand > 0 && prevBalance > 0) {
                partial = prevBalance / failingDay.demand;
            }
            daysOfSupply = stockoutIndex + partial;
        }
    }

    // 10. Planner Orders Object (for ghost trucks)
    // Only includes MANUAL plans that are NOT covered by POs
    const plannedOrders = {};
    Object.entries(monthlyInbound).forEach(([needDateStr, trucks]) => {
        if (Number(trucks) <= 0) return;
        if (poManifest && poManifest[needDateStr]?.items?.length > 0) return; // Covered by PO

        // We don't have leadTime in this function args yet, adding it or assuming 0/2?
        // passing it in seems better. For now excluding "Order Date" calc if not critical 
        // OR standardizing the output structure to just be the Need Date mapping.

        // The UI uses this to show "Ghost Trucks". 
        // We can just return the Need Date map for simplicity, or complex object if needed.
        if (!plannedOrders[needDateStr]) plannedOrders[needDateStr] = { count: 0, items: [] };
        plannedOrders[needDateStr].count += Number(trucks);
        plannedOrders[needDateStr].items.push({ needDate: needDateStr, trucks: Number(trucks) });
    });


    return {
        netInventory, // Projected End State
        safetyTarget,
        trucksToOrder,
        trucksToCancel,
        lostProductionCases,
        effectiveScheduledCases,
        specs,
        yardInventory: { ...yardInventory, effectiveCount: effectiveYardLoads, isOverridden: false },
        dailyLedger,
        firstStockoutDate,
        firstOverflowDate,
        totalIncomingTrucks,
        initialInventory: inventoryBottles + yardBottles, // Start State
        calculatedPallets: derivedPallets,
        daysOfSupply,
        inventoryAnchor, // Pass through
        plannedOrders
    };
};

export type CalculateMRPResult = ReturnType<typeof calculateMRP>;
