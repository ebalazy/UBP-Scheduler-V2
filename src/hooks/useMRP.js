import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export function useMRP() {
    const { bottleDefinitions, safetyStockLoads } = useSettings();

    // Form State with Persistence
    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('mrp_selectedSize') || '20oz');

    // Monthly Inbound State (Date -> Trucks)
    const [monthlyInbound, setMonthlyInbound] = useState(() => {
        const saved = localStorage.getItem('mrp_monthlyInbound');
        return saved ? JSON.parse(saved) : {};
    });

    // Persistence for new state
    useEffect(() => localStorage.setItem('mrp_monthlyInbound', JSON.stringify(monthlyInbound)), [monthlyInbound]);

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
        const lostProductionCases = downtimeHours * productionRate;
        const effectiveScheduledCases = Math.max(0, totalScheduledCases - lostProductionCases);

        const demandBottles = effectiveScheduledCases * specs.bottlesPerCase;

        // Sum total inbound trucks from the calendar (future only)
        const todayStr = new Date().toISOString().split('T')[0];
        const scheduledInboundTrucks = Object.entries(monthlyInbound).reduce((acc, [date, val]) => {
            if (date >= todayStr) return acc + (Number(val) || 0);
            return acc;
        }, 0);

        const totalIncomingTrucks = incomingTrucks + scheduledInboundTrucks; // Include both legacy/manual bucket + calendar
        const incomingBottles = totalIncomingTrucks * specs.bottlesPerTruck;

        const effectiveYardLoads = manualYardOverride !== null ? manualYardOverride : yardInventory.count;
        const yardBottles = effectiveYardLoads * specs.bottlesPerTruck;
        const csm = specs.casesPerPallet || 0;
        const inventoryBottles = currentInventoryPallets * csm * specs.bottlesPerCase;

        const netInventory = (inventoryBottles + incomingBottles + yardBottles) - demandBottles;
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
            trucksToOrder = Math.ceil((safetyTarget - netInventory) / specs.bottlesPerTruck);
        } else if (netInventory > safetyTarget + specs.bottlesPerTruck) {
            trucksToCancel = Math.floor((netInventory - safetyTarget) / specs.bottlesPerTruck);
        }

        return {
            netInventory,
            safetyTarget,
            trucksToOrder,
            trucksToCancel,
            lostProductionCases,
            effectiveScheduledCases,
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
            totalIncomingTrucks
        };
    }, [selectedSize, totalScheduledCases, productionRate, downtimeHours, currentInventoryPallets, incomingTrucks, monthlyInbound, bottleDefinitions, safetyStockLoads, yardInventory, manualYardOverride, monthlyDemand]); // Added monthlyInbound, monthlyDemand

    const updateDateDemand = (date, value) => {
        setMonthlyDemand(prev => ({ ...prev, [date]: Number(value) }));
    };

    const updateDateInbound = (date, value) => {
        setMonthlyInbound(prev => ({ ...prev, [date]: Number(value) }));
    };

    return {
        formState: {
            selectedSize,
            monthlyDemand,
            monthlyInbound, // New
            productionRate,
            downtimeHours,
            totalScheduledCases,
            currentInventoryPallets,
            incomingTrucks,
            yardInventory,
            manualYardOverride
        },
        setters: {
            setSelectedSize,
            updateDateDemand,
            updateDateInbound, // New
            setProductionRate: (v) => setProductionRate(Number(v)),
            setDowntimeHours: (v) => setDowntimeHours(Number(v)),
            setCurrentInventoryPallets: (v) => setCurrentInventoryPallets(Number(v)),
            setIncomingTrucks: (v) => setIncomingTrucks(Number(v)),
            setYardInventory,
            setManualYardOverride: (v) => setManualYardOverride(v === '' ? null : Number(v))
        },
        results: calculations
    };
}
