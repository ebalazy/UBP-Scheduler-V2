import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export function useMRP() {
    const { bottleDefinitions, safetyStockLoads } = useSettings();

    // Form State with Persistence
    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('mrp_selectedSize') || '20oz');

    // Weekly Demand State (Mon-Sun)
    const [weeklyDemand, setWeeklyDemand] = useState(() => {
        const saved = localStorage.getItem('mrp_weeklyDemand');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (typeof parsed === 'object' && parsed !== null) return parsed;
            } catch (e) {
                // Ignore parse error
            }
        }
        // Legacy migration
        const oldScalar = localStorage.getItem('mrp_scheduledCases');
        if (oldScalar) {
            return { mon: Number(oldScalar), tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
        }
        return { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
    });

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
    useEffect(() => localStorage.setItem('mrp_weeklyDemand', JSON.stringify(weeklyDemand)), [weeklyDemand]);
    useEffect(() => localStorage.setItem('mrp_currentInventoryPallets', currentInventoryPallets), [currentInventoryPallets]);
    useEffect(() => localStorage.setItem('mrp_incomingTrucks', incomingTrucks), [incomingTrucks]);
    useEffect(() => localStorage.setItem('mrp_yardInventory', JSON.stringify(yardInventory)), [yardInventory]);
    useEffect(() => {
        if (manualYardOverride !== null) localStorage.setItem('mrp_manualYardOverride', manualYardOverride);
        else localStorage.removeItem('mrp_manualYardOverride');
    }, [manualYardOverride]);

    // Derived total for calculations
    const totalScheduledCases = Object.values(weeklyDemand).reduce((a, b) => a + (Number(b) || 0), 0);

    const calculations = useMemo(() => {
        const specs = bottleDefinitions[selectedSize];
        if (!specs) return null;

        // Convert everything to Bottles for calculation
        const demandBottles = totalScheduledCases * specs.bottlesPerCase;
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
        if (netInventory < safetyTarget) {
            const deficit = safetyTarget - netInventory;
            trucksToOrder = Math.ceil(deficit / specs.bottlesPerTruck);
        }

        return {
            netInventory, // Bottles
            safetyTarget, // Bottles
            trucksToOrder,
            specs,
            yardInventory: {
                ...yardInventory,
                effectiveCount: effectiveYardLoads,
                isOverridden: manualYardOverride !== null
            }
        };
    }, [selectedSize, totalScheduledCases, currentInventoryPallets, incomingTrucks, bottleDefinitions, safetyStockLoads, yardInventory, manualYardOverride]);

    const updateDailyDemand = (day, value) => {
        setWeeklyDemand(prev => ({
            ...prev,
            [day]: Number(value)
        }));
    };

    return {
        formState: {
            selectedSize,
            weeklyDemand,
            totalScheduledCases,
            currentInventoryPallets,
            incomingTrucks,
            yardInventory,
            manualYardOverride
        },
        setters: {
            setSelectedSize,
            updateDailyDemand,
            setCurrentInventoryPallets: (v) => setCurrentInventoryPallets(Number(v)),
            setIncomingTrucks: (v) => setIncomingTrucks(Number(v)),
            setYardInventory,
            setManualYardOverride: (v) => setManualYardOverride(v === '' ? null : Number(v))
        },
        results: calculations
    };
}
