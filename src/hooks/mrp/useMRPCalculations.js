import { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { getLocalISOString, addDays } from '../../utils/dateUtils';

export function useMRPCalculations(state, poManifest = {}) {
    const { bottleDefinitions, safetyStockLoads, leadTimeDays } = useSettings();
    const {
        selectedSize,
        monthlyDemand,
        monthlyProductionActuals,
        monthlyInbound,
        downtimeHours,
        incomingTrucks,
        yardInventory,
        inventoryAnchor
    } = state;

    // Derived productionRate for calculations
    const productionRate = bottleDefinitions[selectedSize]?.productionRate || 0;

    // Updated to use Actuals if present, otherwise Demand
    const totalScheduledCases = useMemo(() => {
        const today = getLocalISOString();
        const allDates = new Set([...Object.keys(monthlyDemand), ...Object.keys(monthlyProductionActuals)]);

        return Array.from(allDates).reduce((acc, date) => {
            if (date >= today) {
                const actual = monthlyProductionActuals[date];
                const plan = monthlyDemand[date];
                const val = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan);
                return acc + (val || 0);
            }
            return acc;
        }, 0);
    }, [monthlyDemand, monthlyProductionActuals]);

    const calculations = useMemo(() => {
        const specs = bottleDefinitions[selectedSize];
        if (!specs) return null;

        const lostProductionCases = downtimeHours * productionRate;
        const effectiveScheduledCases = Math.max(0, totalScheduledCases - lostProductionCases);

        const scrapFactor = 1 + ((specs.scrapPercentage || 0) / 100);
        const demandBottles = effectiveScheduledCases * specs.bottlesPerCase * scrapFactor;

        const todayStr = getLocalISOString();

        // ---------------------------------------------------------
        // CALCULATION UPDATE: Use PO Manifest if available
        // ---------------------------------------------------------
        const getDailyTrucks = (date) => {
            // 1. If POs exist for this date, they are the Truth.
            if (poManifest[date]?.items?.length > 0) {
                return poManifest[date].items.length;
            }
            // 2. Fallback to Manual Count
            return Number(monthlyInbound[date]) || 0;
        };

        const scheduledInboundTrucks = Object.keys(monthlyInbound).reduce((acc, date) => {
            return acc;
        }, 0);

        // RE-IMPLEMENTING scheduledInboundTrucks correctly:
        const allInboundDates = new Set([...Object.keys(monthlyInbound), ...Object.keys(poManifest)]);
        const totalScheduledInbound = Array.from(allInboundDates).reduce((acc, date) => {
            if (date >= todayStr) {
                return acc + getDailyTrucks(date);
            }
            return acc;
        }, 0);


        const totalIncomingTrucks = incomingTrucks + totalScheduledInbound;
        const incomingBottles = totalIncomingTrucks * specs.bottlesPerTruck;

        const effectiveYardLoads = yardInventory.count || 0;
        const yardBottles = effectiveYardLoads * specs.bottlesPerTruck;

        const csm = specs.casesPerPallet || 0;

        let derivedPallets = inventoryAnchor.count;
        const anchorDate = new Date(inventoryAnchor.date);
        anchorDate.setHours(0, 0, 0, 0);

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const diffTime = todayDate - anchorDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
            for (let i = 0; i < diffDays; i++) {
                const ds = addDays(inventoryAnchor.date, i);

                const actual = monthlyProductionActuals[ds];
                const plan = monthlyDemand[ds];
                const dDemandCases = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan || 0);

                // Use Unified Truck Count
                const dInboundTrucks = getDailyTrucks(ds);

                const palletsPerTruck = (specs.bottlesPerTruck / specs.bottlesPerCase) / (specs.casesPerPallet || 1);
                const dInboundPallets = dInboundTrucks * palletsPerTruck;
                const dDemandPallets = dDemandCases / (specs.casesPerPallet || 1);

                derivedPallets = derivedPallets + dInboundPallets - dDemandPallets;
            }
        }

        const inventoryBottles = derivedPallets * csm * specs.bottlesPerCase;
        const netInventory = (inventoryBottles + incomingBottles + yardBottles) - demandBottles;
        const safetyTarget = safetyStockLoads * specs.bottlesPerTruck;

        const dailyLedger = [];
        let currentBalance = inventoryBottles + yardBottles;
        let firstStockoutDate = null;
        let firstOverflowDate = null;

        for (let i = 0; i < 30; i++) {
            const dateStr = addDays(getLocalISOString(), i);

            const actual = monthlyProductionActuals[dateStr];
            const plan = monthlyDemand[dateStr];
            const dailyCases = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan || 0);

            const dailyDemand = dailyCases * specs.bottlesPerCase * scrapFactor;

            // Unified Supply Logic
            const dailyTrucks = getDailyTrucks(dateStr);
            const dailySupply = dailyTrucks * specs.bottlesPerTruck;

            currentBalance = currentBalance + dailySupply - dailyDemand;

            dailyLedger.push({
                date: dateStr,
                balance: currentBalance,
                demand: dailyDemand,
                supply: dailySupply
            });

            if (currentBalance < safetyTarget && !firstStockoutDate) {
                firstStockoutDate = dateStr;
            }
            if (currentBalance > (safetyTarget + specs.bottlesPerTruck * 2) && !firstOverflowDate) {
                firstOverflowDate = dateStr;
            }
        }

        let trucksToOrder = 0;
        let trucksToCancel = 0;
        if (netInventory < safetyTarget) {
            trucksToOrder = Math.ceil((safetyTarget - netInventory) / specs.bottlesPerTruck);
        } else if (netInventory > safetyTarget + specs.bottlesPerTruck) {
            const surplus = netInventory - safetyTarget;
            if (surplus > specs.bottlesPerTruck) trucksToCancel = Math.floor(surplus / specs.bottlesPerTruck);
        }

        // --- DoS (Days of Supply) Calculation ---
        let daysOfSupply = 30; // Default cap (30+ days)
        if (dailyLedger.length > 0) {
            // Find the index where balance first goes below 0 (absolute stockout)
            const stockoutIndex = dailyLedger.findIndex(d => d.balance < 0);

            if (stockoutIndex !== -1) {
                const failingDay = dailyLedger[stockoutIndex];
                const prevBalance = stockoutIndex > 0 ? dailyLedger[stockoutIndex - 1].balance : (inventoryBottles + yardBottles); // Initial

                let partial = 0;
                if (failingDay.demand > 0 && prevBalance > 0) {
                    partial = prevBalance / failingDay.demand;
                }

                daysOfSupply = stockoutIndex + partial;
            } else {
                daysOfSupply = 30;
            }
        }

        return {
            netInventory, safetyTarget, trucksToOrder, trucksToCancel,
            lostProductionCases, effectiveScheduledCases, specs,
            yardInventory: { ...yardInventory, effectiveCount: effectiveYardLoads, isOverridden: manualYardOverride !== null },
            dailyLedger, firstStockoutDate, firstOverflowDate, totalIncomingTrucks,
            initialInventory: inventoryBottles + yardBottles,
            calculatedPallets: derivedPallets,
            daysOfSupply,
            inventoryAnchor,
            plannedOrders: (() => {
                const orders = {};
                Object.entries(monthlyInbound).forEach(([needDateStr, trucks]) => {
                    if (Number(trucks) <= 0) return;
                    const needDate = new Date(needDateStr);
                    const orderDate = new Date(needDate);
                    orderDate.setDate(orderDate.getDate() - (leadTimeDays || 0));
                    const orderDateStr = orderDate.toISOString().split('T')[0];
                    if (!orders[orderDateStr]) orders[orderDateStr] = { count: 0, items: [] };
                    orders[orderDateStr].count += Number(trucks);
                    orders[orderDateStr].items.push({ needDate: needDateStr, trucks: Number(trucks) });
                });
                return orders;
            })()
        };
    }, [selectedSize, totalScheduledCases, productionRate, downtimeHours, incomingTrucks, bottleDefinitions, safetyStockLoads, yardInventory, monthlyDemand, monthlyInbound, inventoryAnchor, leadTimeDays, poManifest, monthlyProductionActuals]);

    return { totalScheduledCases, productionRate, calculations };
}
