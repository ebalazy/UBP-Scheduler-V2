import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseSync } from '../useSupabaseSync';
import { addDays, getLocalISOString } from '../../utils/dateUtils';
import { saveLocalState } from './useMRPState';


export function useMRPActions(state, calculationsResult) {
    const { bottleDefinitions, updateBottleDefinition, safetyStockLoads, leadTimeDays } = useSettings();
    const { user, userRole } = useAuth();
    const { savePlanningEntry, saveProductionSetting, saveInventoryAnchor } = useSupabaseSync();

    const {
        selectedSize, setSelectedSize,
        monthlyDemand, setMonthlyDemand,
        monthlyProductionActuals, setMonthlyProductionActuals,
        monthlyInbound, setMonthlyInbound,
        truckManifest, setTruckManifest,
        setDowntimeHours,
        setCurrentInventoryPallets,
        setIncomingTrucks,
        setYardInventory,
        setManualYardOverride,
        isAutoReplenish, setIsAutoReplenish,
        setInventoryAnchor
    } = state;

    const { calculations } = calculationsResult;

    // --- Refs for Stable Actions (Prevent Re-renders) ---
    // Use useLayoutEffect to ensure refs are updated synchronously before any effects/callbacks run
    const lastManualRun = useRef(0);
    const demandRef = useRef(monthlyDemand);
    const actualRef = useRef(monthlyProductionActuals);
    const inboundRef = useRef(monthlyInbound);

    useLayoutEffect(() => { demandRef.current = monthlyDemand; }, [monthlyDemand]);
    useLayoutEffect(() => { actualRef.current = monthlyProductionActuals; }, [monthlyProductionActuals]);
    useLayoutEffect(() => { inboundRef.current = monthlyInbound; }, [monthlyInbound]);

    // --- Actions ---
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const saveTimers = useRef({}); // Store active debounce timers
    const localSaveTimers = useRef({}); // LocalStorage save timers

    // Wrapper for Save
    const saveWithStatus = useCallback(async (fn) => {
        // PERMISSION CHECK: Only Admins and Planners can save to cloud
        const canEdit = ['admin', 'planner'].includes(userRole);
        if (!canEdit) return;

        setSaveError(null);
        try { await fn(); }
        catch (e) {
            console.error("Save Error", e);
            setSaveError(e.message || "Save Failed");
        }
    }, [userRole]);

    // Debounce Helper (Network)
    const scheduleSave = useCallback((key, fn, delay = 1000) => {
        if (saveTimers.current[key]) {
            clearTimeout(saveTimers.current[key]);
        }
        saveTimers.current[key] = setTimeout(() => {
            saveWithStatus(fn);
            delete saveTimers.current[key];
        }, delay);
    }, [saveWithStatus]);

    // Debounce Helper (Local Storage)
    const scheduleLocalSave = useCallback((key, fn, delay = 300) => {
        if (localSaveTimers.current[key]) {
            clearTimeout(localSaveTimers.current[key]);
        }
        localSaveTimers.current[key] = setTimeout(() => {
            fn();
            delete localSaveTimers.current[key];
        }, delay);
    }, []);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            Object.values(saveTimers.current).forEach(clearTimeout);
            Object.values(localSaveTimers.current).forEach(clearTimeout);
        };
    }, []);

    const runAutoReplenishment = useCallback((demandMap, actualMap, inboundMap) => {
        if (!calculations || !isAutoReplenish) return;

        const specs = bottleDefinitions[selectedSize];
        const scrapFactor = 1 + ((specs.scrapPercentage || 0) / 100);
        const localSafetyTarget = safetyStockLoads * specs.bottlesPerTruck;
        let runningBalance = calculations.initialInventory;
        const startOffset = leadTimeDays || 2;
        const next60Days = {};

        const todayStr = getLocalISOString();

        // 1. Simulator: Walk through locked period
        for (let i = 0; i < startOffset; i++) {
            const ds = addDays(todayStr, i);
            const act = actualMap[ds];
            const plan = demandMap[ds];

            // Logic: Actuals override Plan, UNLESS it's a future date and Actual is 0 (likely placeholder)
            const isFuture = ds > todayStr;
            const useActual = (act !== undefined && act !== null) && (!isFuture || Number(act) !== 0);
            const caseCount = useActual ? Number(act) : Number(plan || 0);

            const dDem = caseCount * specs.bottlesPerCase * scrapFactor;
            const existingTrucks = inboundMap[ds] || 0;
            runningBalance = runningBalance + (existingTrucks * specs.bottlesPerTruck) - dDem;
        }

        // 2. Planner: Walk from LeadTime onwards
        for (let i = startOffset; i < 60; i++) {
            const ds = addDays(todayStr, i);
            const act = actualMap[ds];
            const plan = demandMap[ds];

            // Logic: Actuals override Plan, UNLESS it's a future date and Actual is 0 (likely placeholder)
            const isFuture = ds > todayStr;
            const useActual = (act !== undefined && act !== null) && (!isFuture || Number(act) !== 0);
            const caseCount = useActual ? Number(act) : Number(plan || 0);

            const dDem = caseCount * specs.bottlesPerCase * scrapFactor;

            let dTrucks = 0;
            let bal = runningBalance - dDem;

            if (bal < localSafetyTarget) {
                const needed = Math.ceil((localSafetyTarget - bal) / specs.bottlesPerTruck);
                dTrucks = needed;
                bal += needed * specs.bottlesPerTruck;
            }

            if (dTrucks > 0) next60Days[ds] = dTrucks;
            else if (inboundMap[ds]) next60Days[ds] = 0;

            runningBalance = bal;
        }

        // 3. Diff Check
        let hasChanges = false;
        Object.entries(next60Days).forEach(([date, qty]) => {
            const current = inboundMap[date] || 0;
            if (current !== qty) hasChanges = true;
        });

        if (!hasChanges) return;

        // 4. Construct New Map
        const newInbound = { ...inboundMap, ...next60Days };

        // Remove 0s 
        Object.keys(newInbound).forEach(k => {
            if (newInbound[k] === 0) delete newInbound[k];
        });

        // Final Safety Check
        const sortObj = o => Object.keys(o).sort().reduce((acc, k) => ({ ...acc, [k]: o[k] }), {});
        if (JSON.stringify(sortObj(newInbound)) === JSON.stringify(sortObj(inboundMap))) return;

        // Apply
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, selectedSize, true);

        if (user && ['admin', 'planner'].includes(userRole)) {
            saveWithStatus(async () => {
                const promises = Object.entries(next60Days).map(([date, trucks]) => {
                    return savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', trucks);
                });
                await Promise.all(promises);
            });
        }
    }, [calculations, isAutoReplenish, bottleDefinitions, selectedSize, safetyStockLoads, leadTimeDays, user, userRole, savePlanningEntry, setMonthlyInbound, saveLocalState, saveWithStatus]);

    const updateDateDemand = useCallback((date, value) => {
        // Allow raw value flow for decimals/empty string. 
        // Only convert to Number for DB/Calculations if needed (Calculations handle strings)
        const val = value;
        const newDemand = { ...demandRef.current, [date]: val };

        setMonthlyDemand(newDemand);
        // We defer auto-replenishment to the useEffect to keep the input responsive.

        scheduleLocalSave('monthlyDemand', () => {
            saveLocalState('monthlyDemand', newDemand, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `demand-${date}`,
                () => savePlanningEntry(user.id, selectedSize, date, 'demand_plan', Number(val)),
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyDemand, savePlanningEntry]);

    const updateDateActual = useCallback((date, value) => {
        // Allow raw value flow
        const val = (value === '' || value === null) ? undefined : value;
        const newActuals = { ...actualRef.current };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;

        setMonthlyProductionActuals(newActuals);
        // We defer auto-replenishment to the useEffect to keep the input responsive.

        scheduleLocalSave('monthlyProductionActuals', () => {
            saveLocalState('monthlyProductionActuals', newActuals, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `actual-${date}`,
                () => savePlanningEntry(user.id, selectedSize, date, 'production_actual', val === undefined ? null : Number(val)),
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyProductionActuals, savePlanningEntry]);

    const updateDateInbound = useCallback((date, value) => {
        const val = value; // Allow raw string
        const newInbound = { ...inboundRef.current, [date]: val };
        setMonthlyInbound(newInbound);
        scheduleLocalSave('monthlyInbound', () => {
            saveLocalState('monthlyInbound', newInbound, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `inbound-${date}`,
                () => savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', Number(val)),
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyInbound, savePlanningEntry]);

    // Auto-Replenish Logic (Reactive)

    // Removed 'monthlyInbound' from deps to prevent loop, passing it as arg is sufficient for logic.
    // The effect below will control triggering.
    // Added setMonthlyInbound, monthlyInbound to dep array, logic seems fine? 
    // Wait, monthlyInbound is passed as arg inboundMap to avoid closure issues in the useMRP effect.

    // Reactive Trigger for Auto-Replenishment
    // Reactive Trigger for Auto-Replenishment
    useEffect(() => {
        if (!isAutoReplenish || !calculations) return;

        // TIMESTAMP GUARD:
        // If we just ran a manual update (Sync) < 250ms ago, ignore this Effect trigger.
        // This swallows "Echo" renders and prevents double-calculation loops.
        if (Date.now() - lastManualRun.current < 250) {
            // console.warn("GUARD BLOCKED EFFECT (Echo Protection)");
            return;
        }

        // console.warn("EFFECT TRIGGERED (Running Auto-Replenish)");
        const timer = setTimeout(() => {
            runAutoReplenishment(monthlyDemand, monthlyProductionActuals, monthlyInbound);
        }, 50);

        return () => clearTimeout(timer);
    }, [
        calculations?.initialInventory,
        safetyStockLoads,
        leadTimeDays,
        isAutoReplenish,
        monthlyDemand,
        monthlyProductionActuals,
        monthlyInbound,
        runAutoReplenishment
    ]);


    const updateDateDemandBulk = useCallback((updates) => {
        const newDemand = { ...demandRef.current, ...updates };
        setMonthlyDemand(newDemand);
        scheduleLocalSave('monthlyDemand', () => {
            saveLocalState('monthlyDemand', newDemand, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `demand-bulk-${Object.keys(updates)[0]}`,
                async () => {
                    const promises = Object.entries(updates).map(([date, val]) =>
                        savePlanningEntry(user.id, selectedSize, date, 'demand_plan', Number(val))
                    );
                    await Promise.all(promises);
                },
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyDemand, savePlanningEntry]);

    // Local State for Production Rate (Optimistic UI)
    const [localProductionRate, setLocalProductionRate] = useState(bottleDefinitions[selectedSize]?.productionRate || 0);

    useEffect(() => {
        setLocalProductionRate(bottleDefinitions[selectedSize]?.productionRate || 0);
    }, [selectedSize, bottleDefinitions]);

    const setters = {
        setSelectedSize,
        updateDateDemand,
        updateDateDemandBulk,
        updateDateActual,
        updateDateInbound,
        updateTruckManifest: (date, trucks) => {
            const newManifest = { ...truckManifest, [date]: trucks };
            if (!trucks || trucks.length === 0) delete newManifest[date];

            setTruckManifest(newManifest);
            saveLocalState('truckManifest', newManifest, selectedSize, true);
            if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'truck_manifest_json', JSON.stringify(trucks)));
        },
        setProductionRate: (v) => {
            const val = Number(v);
            setLocalProductionRate(val); // Optimistic Update
            updateBottleDefinition(selectedSize, 'productionRate', val);
            if (user) saveWithStatus(() => saveProductionSetting(user.id, selectedSize, 'production_rate', val));
        },
        setDowntimeHours: (v) => {
            const val = Number(v);
            setDowntimeHours(val);
            saveLocalState('downtimeHours', val, selectedSize);
            if (user) saveWithStatus(() => saveProductionSetting(user.id, selectedSize, 'downtime_hours', val));
        },
        setCurrentInventoryPallets: (v) => {
            const val = Number(v);
            setCurrentInventoryPallets(val);
            saveLocalState('currentInventoryPallets', val, selectedSize);
        },
        setIncomingTrucks: (v) => {
            const val = Number(v);
            setIncomingTrucks(val);
            saveLocalState('incomingTrucks', val, selectedSize);
        },
        setYardInventory: (v) => {
            setYardInventory(v);
            saveLocalState('yardInventory', v, selectedSize, true);
        },
        updateYardInventory: (v) => {
            const val = Number(v);
            const now = getLocalISOString();
            setYardInventory({ date: now, count: val });
            saveLocalState('yardInventory', { date: now, count: val }, selectedSize, true);
            if (user) saveWithStatus(() => saveInventoryAnchor(user.id, selectedSize, { date: now, count: val }, 'yard'));
        },
        setIsAutoReplenish: (v) => {
            setIsAutoReplenish(v);
            saveLocalState('isAutoReplenish', v, selectedSize, true);
            if (user) saveWithStatus(() => saveProductionSetting(user.id, selectedSize, 'is_auto_replenish', v));
        },
        setInventoryAnchor: (v) => {
            setInventoryAnchor(v);
            saveLocalState('inventoryAnchor', v, selectedSize, true);
            if (user) saveWithStatus(() => saveInventoryAnchor(user.id, selectedSize, v));
        }
    };

    return {
        setters,
        formState: {
            isSaving,
            saveError,
            selectedSize,
            productionRate: localProductionRate
        }
    }
}
