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

    // Monthly Inbound State (Date -> Trucks)
    const [monthlyInbound, setMonthlyInbound] = useState(() => {
        const saved = localStorage.getItem('mrp_monthlyInbound');
        return saved ? JSON.parse(saved) : {};
    });

    // Smart Scheduler Inputs
    const [productionRate, setProductionRate] = useState(() => Number(localStorage.getItem('mrp_productionRate')) || 0); // Cases per Hour
    const [downtimeHours, setDowntimeHours] = useState(() => Number(localStorage.getItem('mrp_downtimeHours')) || 0); // Hours

    const [currentInventoryPallets, setCurrentInventoryPallets] = useState(() => Number(localStorage.getItem('mrp_currentInventoryPallets')) || 0); // Pallets
    const [incomingTrucks, setIncomingTrucks] = useState(() => Number(localStorage.getItem('mrp_incomingTrucks')) || 0); // Trucks

    // Yard Inventory (from CSV)
    const [yardInventory, setYardInventory] = useState(() => {
        const saved = localStorage.getItem('mrp_yardInventory');
        return saved ? JSON.parse(saved) : { count: 0, timestamp: null, fileName: null };
    });

    // Manual Override for Yard Inventory (if CSV is wrong/old)
    const [manualYardOverride, setManualYardOverride] = useState(() => {
        const saved = localStorage.getItem('mrp_manualYardOverride');
        return saved ? Number(saved) : null; // null means use CSV value
    });

    // Persistence Effects
    useEffect(() => localStorage.setItem('mrp_selectedSize', selectedSize), [selectedSize]);
    useEffect(() => localStorage.setItem('mrp_monthlyDemand', JSON.stringify(monthlyDemand)), [monthlyDemand]);
    useEffect(() => localStorage.setItem('mrp_monthlyInbound', JSON.stringify(monthlyInbound)), [monthlyInbound]);
    useEffect(() => localStorage.setItem('mrp_productionRate', productionRate), [productionRate]);
    useEffect(() => localStorage.setItem('mrp_downtimeHours', downtimeHours), [downtimeHours]);
    useEffect(() => localStorage.setItem('mrp_currentInventoryPallets', currentInventoryPallets), [currentInventoryPallets]);
    useEffect(() => localStorage.setItem('mrp_incomingTrucks', incomingTrucks), [incomingTrucks]);
    useEffect(() => localStorage.setItem('mrp_yardInventory', JSON.stringify(yardInventory)), [yardInventory]);
    useEffect(() => {
        if (manualYardOverride !== null) localStorage.setItem('mrp_manualYardOverride', manualYardOverride);
        else localStorage.removeItem('mrp_manualYardOverride');
    }, [manualYardOverride]);

    // Auto-Replenish State
    const [isAutoReplenish, setIsAutoReplenish] = useState(() => {
        const saved = localStorage.getItem('mrp_isAutoReplenish');
        return saved !== null ? JSON.parse(saved) : true;
    });
    useEffect(() => localStorage.setItem('mrp_isAutoReplenish', JSON.stringify(isAutoReplenish)), [isAutoReplenish]);

    // Derived total for calculations
    const totalScheduledCases = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return Object.entries(monthlyDemand).reduce((acc, [date, val]) => {
            if (date >= today) {
                return acc + (Number(val) || 0);
            }
            return acc;
        }, 0);
    }, [monthlyDemand]);

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
        const inventoryBottles = currentInventoryPallets * csm * specs.bottlesPerCase;

        // Net Inventory = (Current + Incoming + Yard) - Demand
        const netInventory = (inventoryBottles + incomingBottles + yardBottles) - demandBottles;

        // Safety Target
        const safetyTarget = safetyStockLoads * specs.bottlesPerTruck;

        // --- DAILY LEDGER (Time-Phased Logic) ---
        const dailyLedger = [];
        let currentBalance = inventoryBottles + yardBottles; // Start with what we have on floor/yard
        let firstStockoutDate = null;
        let firstOverflowDate = null;

        // Simulate next 30 days
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            // Demand for this day
            const dailyCases = Number(monthlyDemand[dateStr]) || 0;
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
            initialInventory: inventoryBottles + yardBottles
        };
    }, [selectedSize, totalScheduledCases, productionRate, downtimeHours, currentInventoryPallets, incomingTrucks, bottleDefinitions, safetyStockLoads, yardInventory, manualYardOverride, monthlyDemand, monthlyInbound]);

    const updateDateDemand = (date, value) => {
        const val = Number(value);
        const newDemand = { ...monthlyDemand, [date]: val };
        setMonthlyDemand(newDemand);

        if (isAutoReplenish && calculations) {
            // "Magic Mode": Automatically schedule trucks to meet Safety Stock
            const specs = bottleDefinitions[selectedSize];
            const safetyTarget = safetyStockLoads * specs.bottlesPerTruck;
            let runningBalance = calculations.initialInventory;

            // Re-calculate the ENTIRE schedule to be safe
            const today = new Date();
            const next60Days = {};

            for (let i = 0; i < 60; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                const ds = d.toISOString().split('T')[0];

                // Use new demand value if it's the date being edited
                const dDem = (ds === date ? val : (monthlyDemand[ds] || 0)) * specs.bottlesPerCase;

                let dTrucks = 0;
                let bal = runningBalance - dDem;

                if (bal < safetyTarget) {
                    const needed = Math.ceil((safetyTarget - bal) / specs.bottlesPerTruck);
                    dTrucks = needed;
                    bal += needed * specs.bottlesPerTruck;
                }

                // Only write to map if > 0 (or if we need to overwrite an existing value to 0)
                // To support clearing old values, we should probably output 0s? 
                // But merging { ...prev, ...next60Days } will overwrite. 
                // However, we only have prev monthlyInbound inside the setter below.
                if (dTrucks > 0) next60Days[ds] = dTrucks;
                else next60Days[ds] = 0;

                runningBalance = bal;
            }

            setMonthlyInbound(prev => ({ ...prev, ...next60Days }));
        }
    };

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
            productionRate,
            downtimeHours,
            totalScheduledCases,
            currentInventoryPallets,
            incomingTrucks,
            yardInventory,
            manualYardOverride,
            isAutoReplenish
        },
        setters: {
            setSelectedSize,
            updateDateDemand,
            updateDateInbound,
            setProductionRate: (v) => setProductionRate(Number(v)),
            setDowntimeHours: (v) => setDowntimeHours(Number(v)),
            setCurrentInventoryPallets: (v) => setCurrentInventoryPallets(Number(v)),
            setIncomingTrucks: (v) => setIncomingTrucks(Number(v)),
            setYardInventory,
            setManualYardOverride: (v) => setManualYardOverride(v === '' ? null : Number(v)),
            setIsAutoReplenish
        },
        results: calculations
    };
}
