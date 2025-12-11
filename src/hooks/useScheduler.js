
import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

export function useScheduler() {
    const {
        bottleDefinitions,
        safetyStockLoads,
        schedulerSettings,
        updateSchedulerSetting
    } = useSettings();

    // UI View State (Local Preferred)
    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('sched_selectedSize') || '20oz');

    // Persist UI selection locally
    useEffect(() => localStorage.setItem('sched_selectedSize', selectedSize), [selectedSize]);

    // Extract synced settings
    const {
        targetDailyProduction = 0,
        shiftStartTime = '00:00',
        poAssignments = {},
        cancelledLoads = []
    } = schedulerSettings;

    // --- Calculations (Preserved Logic) ---
    const calculations = useMemo(() => {
        const specsDef = bottleDefinitions[selectedSize];
        if (!specsDef) return null;

        // Inject name for UI/Export usage
        const computedPallets = specsDef.palletsPerTruck || Math.ceil(specsDef.casesPerTruck / specsDef.casesPerPallet);
        const specs = { ...specsDef, name: selectedSize, palletsPerTruck: computedPallets };

        // Required Daily Loads
        const safeTarget = !isNaN(targetDailyProduction) ? targetDailyProduction : 0;
        const requiredDailyLoads = Math.ceil(safeTarget / specs.casesPerTruck);

        const weeklyLoads = requiredDailyLoads * 7;

        // Schedule Distribution (3 Shifts)
        const shifts = [
            { name: 'Shift 1 (00:00-08:00)', loads: 0 },
            { name: 'Shift 2 (08:00-16:00)', loads: 0 },
            { name: 'Shift 3 (16:00-00:00)', loads: 0 },
        ];

        // Hourly Logistics Logic
        const casesPerHour = safeTarget / 24;
        const burnRate = casesPerHour;

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

        // Calculate Shift Distribution
        activeTrucks.forEach(truck => {
            const dec = truck.rawDecimal;
            if (dec >= 0 && dec < 8) shifts[0].loads++;
            else if (dec >= 8 && dec < 16) shifts[1].loads++;
            else shifts[2].loads++;
        });

        // Use filtered schedule for display (but keep IDs stable)
        truckSchedule = activeTrucks;

        // Risk Alert Logic
        const isHighRisk = safetyStockLoads < requiredDailyLoads;

        return {
            requiredDailyLoads,
            weeklyLoads,
            schedule: shifts,
            truckSchedule,
            burnRate,
            hoursPerTruck,
            isHighRisk,
            safetyStockLoads,
            specs
        };

    }, [selectedSize, targetDailyProduction, shiftStartTime, bottleDefinitions, safetyStockLoads, poAssignments, cancelledLoads]);

    // --- Setters (Proxy to SettingsContext) ---

    const updatePO = (id, value) => {
        const newMap = { ...poAssignments, [String(id)]: value };
        updateSchedulerSetting('poAssignments', newMap);
    };

    const toggleCancelled = (id) => {
        const sid = String(id);
        const isCancelled = cancelledLoads.includes(sid);
        const newKey = isCancelled
            ? cancelledLoads.filter(item => item !== sid)
            : [...cancelledLoads, sid];
        updateSchedulerSetting('cancelledLoads', newKey);
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
                updateSchedulerSetting('targetDailyProduction', !isNaN(val) && val >= 0 ? val : 0);
            },
            setShiftStartTime: (v) => updateSchedulerSetting('shiftStartTime', v),
            updatePO,
            toggleCancelled
        },
        results: calculations
    };
}
