import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export function useScheduler() {
    const { bottleDefinitions, safetyStockLoads } = useSettings();

    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('sched_selectedSize') || '20oz');

    // Robust Integer Initialization
    const [targetDailyProduction, setTargetDailyProduction] = useState(() => {
        const val = Number(localStorage.getItem('sched_targetDailyProduction'));
        return !isNaN(val) && val >= 0 ? val : 0;
    });

    const [shiftStartTime, setShiftStartTime] = useState(() => localStorage.getItem('sched_shiftStartTime') || '00:00');

    useEffect(() => localStorage.setItem('sched_selectedSize', selectedSize), [selectedSize]);
    useEffect(() => localStorage.setItem('sched_targetDailyProduction', targetDailyProduction), [targetDailyProduction]);
    useEffect(() => localStorage.setItem('sched_shiftStartTime', shiftStartTime), [shiftStartTime]);

    const [poAssignments, setPoAssignments] = useState(() => {
        try {
            const saved = localStorage.getItem('sched_poAssignments');
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });
    useEffect(() => localStorage.setItem('sched_poAssignments', JSON.stringify(poAssignments)), [poAssignments]);

    const [cancelledLoads, setCancelledLoads] = useState(() => {
        try {
            const saved = localStorage.getItem('sched_cancelledLoads');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });
    useEffect(() => localStorage.setItem('sched_cancelledLoads', JSON.stringify(cancelledLoads)), [cancelledLoads]);


    const calculations = useMemo(() => {
        const specsDef = bottleDefinitions[selectedSize];
        if (!specsDef) return null;

        // Inject name for UI/Export usage
        // Ensure palletsPerTruck is available (fallback for legacy data)
        const computedPallets = specsDef.palletsPerTruck || Math.ceil(specsDef.casesPerTruck / specsDef.casesPerPallet);
        const specs = { ...specsDef, name: selectedSize, palletsPerTruck: computedPallets };

        // Required Daily Loads = Target / Cases Per Truck
        // Handle NaN target
        const safeTarget = !isNaN(targetDailyProduction) ? targetDailyProduction : 0;
        const requiredDailyLoads = Math.ceil(safeTarget / specs.casesPerTruck);

        const weeklyLoads = requiredDailyLoads * 7;

        // Schedule Distribution (3 Shifts)
        const shifts = [
            { name: 'Shift 1 (00:00-08:00)', loads: 0 },
            { name: 'Shift 2 (08:00-16:00)', loads: 0 },
            { name: 'Shift 3 (16:00-00:00)', loads: 0 },
        ];

        // Remove pre-calculation of even distribution
        // We will calculate exact distribution based on active trucks below

        // Hourly Logistics Logic
        // Burn Rate (Cases / Hour) assuming 24h ops
        const casesPerHour = safeTarget / 24;
        const burnRate = casesPerHour; // aliases

        // Truck Interval
        const truckCapacityCases = specs.casesPerTruck;
        const hoursPerTruck = casesPerHour > 0 ? truckCapacityCases / casesPerHour : 0;

        // Generate Detailed Schedule
        let truckSchedule = [];
        if (hoursPerTruck > 0 && requiredDailyLoads > 0) {
            const [startH, startM] = shiftStartTime.split(':').map(Number);
            let currentHour = startH + (startM / 60);

            for (let i = 0; i < requiredDailyLoads; i++) {
                const arrivalDecimal = currentHour + (hoursPerTruck * i);
                const normalizedDecimal = arrivalDecimal % 24;
                const h = Math.round(normalizedDecimal);
                const safeH = h === 24 ? 0 : h;
                const m = 0;
                const timeStr = `${safeH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                truckSchedule.push({
                    id: i + 1,
                    time: timeStr,
                    rawDecimal: normalizedDecimal,
                    po: poAssignments[String(i + 1)] || ''
                });
            }
        }

        // Filter Cancelled Loads
        const activeTrucks = truckSchedule.filter(t => !cancelledLoads.includes(String(t.id)));

        // Calculate Shift Distribution based on Active Trucks
        activeTrucks.forEach(truck => {
            const dec = truck.rawDecimal;
            if (dec >= 0 && dec < 8) shifts[0].loads++;
            else if (dec >= 8 && dec < 16) shifts[1].loads++;
            else shifts[2].loads++;
        });

        // Use filtered schedule for display
        truckSchedule = activeTrucks;

        // Risk Alert Logic
        const isHighRisk = safetyStockLoads < requiredDailyLoads;

        return {
            requiredDailyLoads,
            weeklyLoads,
            schedule: shifts,
            truckSchedule, // New detailed list
            burnRate,      // Cases/Hour
            hoursPerTruck, // Interval
            isHighRisk,
            safetyStockLoads, // For display in alert
            specs
        };

    }, [selectedSize, targetDailyProduction, shiftStartTime, bottleDefinitions, safetyStockLoads, poAssignments, cancelledLoads]);

    const updatePO = (id, value) => {
        setPoAssignments(prev => ({
            ...prev,
            [String(id)]: value
        }));
    };

    const toggleCancelled = (id) => {
        setCancelledLoads(prev => {
            const sid = String(id);
            if (prev.includes(sid)) {
                return prev.filter(item => item !== sid);
            }
            return [...prev, sid];
        });
    };

    return {
        formState: {
            selectedSize,
            targetDailyProduction,
            shiftStartTime,
            poAssignments
        },
        setters: {
            setSelectedSize,
            setTargetDailyProduction: (v) => {
                const val = Number(v);
                setTargetDailyProduction(!isNaN(val) && val >= 0 ? val : 0);
            },
            setShiftStartTime,
            updatePO,
            toggleCancelled
        },
        results: calculations
    };
}
