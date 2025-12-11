import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export function useMRP() {
    const { bottleDefinitions, safetyStockLoads } = useSettings();

    // Form State with Persistence
    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('mrp_selectedSize') || '20oz');

    // Monthly Demand State (Date -> Cases)
    // Format: { "YYYY-MM-DD": 12345 }
    const [monthlyDemand, setMonthlyDemand] = useState(() => {
        const saved = localStorage.getItem('mrp_monthlyDemand');
        return saved ? JSON.parse(saved) : {};
    });

    // Monthly Production Actuals (Date -> Cases)
    const [monthlyProductionActuals, setMonthlyProductionActuals] = useState(() => {
        const saved = localStorage.getItem('mrp_monthlyProductionActuals');
        return saved ? JSON.parse(saved) : {};
    });
    useEffect(() => localStorage.setItem('mrp_monthlyProductionActuals', JSON.stringify(monthlyProductionActuals)), [monthlyProductionActuals]);

    // Monthly Inbound State (Date -> Trucks)
    const [monthlyInbound, setMonthlyInbound] = useState(() => {
        const saved = localStorage.getItem('mrp_monthlyInbound');
        return saved ? JSON.parse(saved) : {};
    });

    // ... (rest of states) ...

    // Derived total for calculations
    // Updated to use Actuals if present, otherwise Demand
    const totalScheduledCases = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        // We need to iterate over ALL dates that have either Demand OR Actuals
        const allDates = new Set([...Object.keys(monthlyDemand), ...Object.keys(monthlyProductionActuals)]);

        return Array.from(allDates).reduce((acc, date) => {
            if (date >= today) {
                // Future: Use Plan (unless Actuals entered for future? Unlikely but possible override)
                // Logic: If Actual is explicitly entered (not undefined), use it? 
                // Usually Actuals are for Past. Future is Plan.
                // Let's stick to: If Actual exists, use it.
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

        // --- BATCH CALCULATIONS (Legacy/Overview) ---
        // Lost Production (Cases) = Downtime (Hours) * Rate (Cases/Hour)
        const lostProductionCases = downtimeHours * productionRate;

        // Effective Demand = Planned Demand - Lost Production
        // (We need fewer bottles because we are producing less)
        const effectiveScheduledCases = Math.max(0, totalScheduledCases - lostProductionCases);

        // Convert everything to Bottles for calculation
        const demandBottles = effectiveScheduledCases * specs.bottlesPerCase;

        // Sum total inbound trucks from the calendar (future only)
        const todayStr = new Date().toISOString().split('T')[0];
        const scheduledInboundTrucks = Object.entries(monthlyInbound).reduce((acc, [date, val]) => {
            if (date >= todayStr) return acc + (Number(val) || 0);
            return acc;
        }, 0);

        const totalIncomingTrucks = incomingTrucks + scheduledInboundTrucks; // Include both legacy/manual bucket + calendar
        const incomingBottles = totalIncomingTrucks * specs.bottlesPerTruck;

        // Yard Inventory logic
        const effectiveYardLoads = manualYardOverride !== null ? manualYardOverride : yardInventory.count;
        const yardBottles = effectiveYardLoads * specs.bottlesPerTruck;

        // Inventory: Pallets -> Cases -> Bottles
        const csm = specs.casesPerPallet || 0;

        // --- PERPETUAL INVENTORY CALCULATION ---
        // 1. Start with Anchor Count (Pallets)
        let derivedPallets = inventoryAnchor.count;

        // 2. Iterate from Anchor Date to Today (exclusive of Today?) 
        // Logic: "Current Inventory" usually means "Start of Day".
        // So we process transactions for all PAST days.
        const anchorDate = new Date(inventoryAnchor.date);
        anchorDate.setHours(0, 0, 0, 0);

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Safety: Limit loop to avoid browser hang if date is weird
        const diffTime = todayDate - anchorDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) { // Limit to 1 year lookback
            for (let i = 0; i < diffDays; i++) {
                const d = new Date(anchorDate);
                d.setDate(anchorDate.getDate() + i);
                const ds = d.toISOString().split('T')[0];

                // Use Actuals if present, otherwise Demand
                const actual = monthlyProductionActuals[ds];
                const plan = monthlyDemand[ds];
                const dDemandCases = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan || 0);

                const dInboundTrucks = Number(monthlyInbound[ds]) || 0;

                // Convert to Pallets
                // 1 Truck = (bottlesPerTruck / bottlesPerCase) cases / casesPerPallet
                // Easier: 1 Truck -> bottles -> cases -> pallets
                const palletsPerTruck = (specs.bottlesPerTruck / specs.bottlesPerCase) / (specs.casesPerPallet || 1);

                const dInboundPallets = dInboundTrucks * palletsPerTruck;
                const dDemandPallets = dDemandCases / (specs.casesPerPallet || 1);

                derivedPallets = derivedPallets + dInboundPallets - dDemandPallets;
            }
        }

        const inventoryBottles = derivedPallets * csm * specs.bottlesPerCase;

        // Net Inventory = (Current + Incoming + Yard) - Demand
        const netInventory = (inventoryBottles + incomingBottles + yardBottles) - demandBottles;

        // Safety Target
        const safetyTarget = safetyStockLoads * specs.bottlesPerTruck;

        // --- DAILY LEDGER (Time-Phased Logic) ---
        const dailyLedger = [];
        let currentBalance = inventoryBottles + yardBottles; // Start with Calculated Balance
        let firstStockoutDate = null;
        let firstOverflowDate = null;

        // Simulate next 30 days
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            // Demand for this day (Actual || Plan)
            const actual = monthlyProductionActuals[dateStr];
            const plan = monthlyDemand[dateStr];
            const dailyCases = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan || 0);

            const dailyDemand = dailyCases * specs.bottlesPerCase;

            // Inbound for this day
            const dailyTrucks = Number(monthlyInbound[dateStr]) || 0;
            const dailySupply = dailyTrucks * specs.bottlesPerTruck;

            // Update Balance
            // Note: For simplicity, we apply 'Lost Production' as a reduction to demand... 
            // but we don't know WHICH day to apply it to without more inputs.
            // For now, the Ledger uses GROSS demand.
            // TODO: Add daily downtime inputs for true precision.
            currentBalance = currentBalance + dailySupply - dailyDemand;

            dailyLedger.push({
                date: dateStr,
                balance: currentBalance,
                demand: dailyDemand,
                supply: dailySupply
            });

            // Check Alerts
            if (currentBalance < safetyTarget && !firstStockoutDate) {
                firstStockoutDate = dateStr;
            }
            if (currentBalance > (safetyTarget + specs.bottlesPerTruck * 2) && !firstOverflowDate) {
                // "Overflow" is defined loosely as Net > Safety + 2 Trucks (signifcant surplus)
                firstOverflowDate = dateStr;
            }
        }

        // Trucks needed (Batch View backup)
        let trucksToOrder = 0;
        let trucksToCancel = 0;

        if (netInventory < safetyTarget) {
            const deficit = safetyTarget - netInventory;
            trucksToOrder = Math.ceil(deficit / specs.bottlesPerTruck);
        } else if (netInventory > safetyTarget + specs.bottlesPerTruck) {
            const surplus = netInventory - safetyTarget;
            // Only suggest cancel if surplus is > 1 truck (avoid noise)
            if (surplus > specs.bottlesPerTruck) {
                trucksToCancel = Math.floor(surplus / specs.bottlesPerTruck);
            }
        }

        return {
            netInventory, // Bottles
            safetyTarget, // Bottles
            trucksToOrder,
            trucksToCancel, // NEW: Recommendation to remove loads
            lostProductionCases, // For UI display
            effectiveScheduledCases, // For UI display
            specs,
            yardInventory: {
                ...yardInventory,
                effectiveCount: effectiveYardLoads,
                isOverridden: manualYardOverride !== null
            },
            // New Time-Phased Props
            dailyLedger,
            firstStockoutDate,
            firstOverflowDate,
            totalIncomingTrucks,
            // Helper for Auto-Replenishment
            initialInventory: inventoryBottles + yardBottles,
            // Exposed Calculated Inventory for UI
            calculatedPallets: derivedPallets,
            inventoryAnchor
        };
    }, [selectedSize, totalScheduledCases, productionRate, downtimeHours, currentInventoryPallets, incomingTrucks, bottleDefinitions, safetyStockLoads, yardInventory, manualYardOverride, monthlyDemand, monthlyInbound, inventoryAnchor]);

    const updateDateDemand = (date, value) => {
        const val = Number(value);
        const newDemand = { ...monthlyDemand, [date]: val };
        setMonthlyDemand(newDemand);

        if (isAutoReplenish && calculations) {
            runAutoReplenishment(newDemand, monthlyProductionActuals);
        }
    };

    const updateDateActual = (date, value) => {
        const val = (value === '' || value === null) ? undefined : Number(value);
        const newActuals = { ...monthlyProductionActuals };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;

        setMonthlyProductionActuals(newActuals);

        if (isAutoReplenish && calculations) {
            runAutoReplenishment(monthlyDemand, newActuals);
        }
    };

    // Extracted Magic Mode Logic for re-use
    const runAutoReplenishment = (demandMap, actualMap) => {
        const specs = bottleDefinitions[selectedSize];
        const safetyTarget = safetyStockLoads * specs.bottlesPerTruck;

        // Use calculated initial inventory as base
        let runningBalance = calculations.initialInventory;

        const today = new Date();
        const next60Days = {};

        for (let i = 0; i < 60; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const ds = d.toISOString().split('T')[0];

            // Demand Logic: Actual || Plan
            const act = actualMap[ds];
            const plan = demandMap[ds];
            const dDem = ((act !== undefined && act !== null) ? Number(act) : Number(plan || 0)) * specs.bottlesPerCase;

            let dTrucks = 0;
            let bal = runningBalance - dDem;

            if (bal < safetyTarget) {
                const needed = Math.ceil((safetyTarget - bal) / specs.bottlesPerTruck);
                dTrucks = needed;
                bal += needed * specs.bottlesPerTruck;
            }

            if (dTrucks > 0) next60Days[ds] = dTrucks;
            else next60Days[ds] = 0;

            runningBalance = bal;
        }

        setMonthlyInbound(prev => ({ ...prev, ...next60Days }));
    }

    const updateDateInbound = (date, value) => {
        setMonthlyInbound(prev => ({
            ...prev,
            [date]: Number(value)
        }));
    };

    return {
        formState: {
            selectedSize,
            monthlyDemand,
            monthlyInbound,
            monthlyProductionActuals,
            productionRate,
            downtimeHours,
            totalScheduledCases,
            currentInventoryPallets,
            incomingTrucks,
            yardInventory,
            manualYardOverride,
            isAutoReplenish,
            inventoryAnchor
        },
        setters: {
            setSelectedSize,
            updateDateDemand,
            updateDateActual,
            updateDateInbound,
            setProductionRate: (v) => setProductionRate(Number(v)),
            setDowntimeHours: (v) => setDowntimeHours(Number(v)),
            setCurrentInventoryPallets: (v) => setCurrentInventoryPallets(Number(v)),
            setIncomingTrucks: (v) => setIncomingTrucks(Number(v)),
            setYardInventory,
            setManualYardOverride: (v) => setManualYardOverride(v === '' ? null : Number(v)),
            setIsAutoReplenish,
            setInventoryAnchor
        },
        results: calculations
    };
}
