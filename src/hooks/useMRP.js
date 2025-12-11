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
    useEffect(() => localStorage.setItem('mrp_productionRate', productionRate), [productionRate]);
    useEffect(() => localStorage.setItem('mrp_downtimeHours', downtimeHours), [downtimeHours]);
    useEffect(() => localStorage.setItem('mrp_currentInventoryPallets', currentInventoryPallets), [currentInventoryPallets]);
    useEffect(() => localStorage.setItem('mrp_incomingTrucks', incomingTrucks), [incomingTrucks]);
    useEffect(() => localStorage.setItem('mrp_yardInventory', JSON.stringify(yardInventory)), [yardInventory]);
    useEffect(() => {
        if (manualYardOverride !== null) localStorage.setItem('mrp_manualYardOverride', manualYardOverride);
        else localStorage.removeItem('mrp_manualYardOverride');
    }, [manualYardOverride]);

    // Derived total for calculations
    // Sum of all FUTURE demand (starting today)
    // We ignore past dates because that demand is assumed "consumed" from the current inventory count.
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

        // SMART LOGIC:
        // Lost Production (Cases) = Downtime (Hours) * Rate (Cases/Hour)
        const lostProductionCases = downtimeHours * productionRate;

        // Effective Demand = Planned Demand - Lost Production
        // (We need fewer bottles because we are producing less)
        const effectiveScheduledCases = Math.max(0, totalScheduledCases - lostProductionCases);

        // Convert everything to Bottles for calculation
        const demandBottles = effectiveScheduledCases * specs.bottlesPerCase;
        const incomingBottles = incomingTrucks * specs.bottlesPerTruck;

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

        // Trucks needed
        let trucksToOrder = 0;
        let trucksToCancel = 0;

        if (netInventory < safetyTarget) {
            const deficit = safetyTarget - netInventory;
            trucksToOrder = Math.ceil(deficit / specs.bottlesPerTruck);
        } else if (netInventory > safetyTarget) {
            // Surplus! Do we need to cancel?
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
            }
        };
    }, [selectedSize, totalScheduledCases, productionRate, downtimeHours, currentInventoryPallets, incomingTrucks, bottleDefinitions, safetyStockLoads, yardInventory, manualYardOverride]);

    const updateDateDemand = (date, value) => {
        setMonthlyDemand(prev => ({
            ...prev,
            [date]: Number(value)
        }));
    };

    return {
        formState: {
            selectedSize,
            monthlyDemand, // Changed from weeklyDemand
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
            updateDateDemand, // Changed from updateDailyDemand
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
