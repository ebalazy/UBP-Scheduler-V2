import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseSync } from '../useSupabaseSync';
import { addDays, getLocalISOString } from '../../utils/dateUtils';
import { saveLocalState } from './useMRPState';

export function useMRPActions(state, calculationsResult) {
    const { bottleDefinitions, updateBottleDefinition, safetyStockLoads, leadTimeDays } = useSettings();
    const { user } = useAuth();
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

    // --- Actions ---
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const saveTimers = useRef({}); // Store active debounce timers
    const localSaveTimers = useRef({}); // LocalStorage save timers

    // Wrapper for Save
    const saveWithStatus = async (fn) => {
        setIsSaving(true);
        setSaveError(null);
        try { await fn(); }
        catch (e) {
            console.error("Save Error", e);
            setSaveError(e.message || "Save Failed");
        }
        finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    // Debounce Helper (Network)
    const scheduleSave = useCallback((key, fn, delay = 1000) => {
        if (saveTimers.current[key]) {
            clearTimeout(saveTimers.current[key]);
        }
        saveTimers.current[key] = setTimeout(() => {
            saveWithStatus(fn);
            delete saveTimers.current[key];
        }, delay);
    }, []);

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

    const updateDateDemand = (date, value) => {
        const val = Number(value);
        const newDemand = { ...monthlyDemand, [date]: val };
        setMonthlyDemand(newDemand);
        scheduleLocalSave('monthlyDemand', () => {
            saveLocalState('monthlyDemand', newDemand, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `demand-${date}`,
                () => savePlanningEntry(user.id, selectedSize, date, 'demand_plan', val),
                1000
            );
        }
    };

    const updateDateActual = (date, value) => {
        const val = (value === '' || value === null) ? undefined : Number(value);
        const newActuals = { ...monthlyProductionActuals };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;
        setMonthlyProductionActuals(newActuals);
        scheduleLocalSave('monthlyProductionActuals', () => {
            saveLocalState('monthlyProductionActuals', newActuals, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `actual-${date}`,
                () => savePlanningEntry(user.id, selectedSize, date, 'production_actual', val || 0),
                1000
            );
        }
    };

    const updateDateInbound = (date, value) => {
        const val = Number(value);
        const newInbound = { ...monthlyInbound, [date]: val };
        setMonthlyInbound(newInbound);
        scheduleLocalSave('monthlyInbound', () => {
            saveLocalState('monthlyInbound', newInbound, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `inbound-${date}`,
                () => savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', val),
                1000
            );
        }
    };

    // Auto-Replenish Logic (Reactive)
    const runAutoReplenishment = useCallback((demandMap, actualMap, inboundMap) => {
        if (!calculations || !isAutoReplenish) return;

        const specs = bottleDefinitions[selectedSize];
        const scrapFactor = 1 + ((specs.scrapPercentage || 0) / 100);
        const localSafetyTarget = safetyStockLoads * specs.bottlesPerTruck;
        let runningBalance = calculations.initialInventory;
        const startOffset = leadTimeDays || 2;
        const next60Days = {};

        // 1. Simulator: Walk through locked period
        for (let i = 0; i < startOffset; i++) {
            const ds = addDays(getLocalISOString(), i);
            const act = actualMap[ds];
            const plan = demandMap[ds];
            const dDem = ((act !== undefined && act !== null) ? Number(act) : Number(plan || 0)) * specs.bottlesPerCase * scrapFactor;
            const existingTrucks = inboundMap[ds] || 0;
            runningBalance = runningBalance + (existingTrucks * specs.bottlesPerTruck) - dDem;
        }

        // 2. Planner: Walk from LeadTime onwards
        for (let i = startOffset; i < 60; i++) {
            const ds = addDays(getLocalISOString(), i);
            const act = actualMap[ds];
            const plan = demandMap[ds];
            const dDem = ((act !== undefined && act !== null) ? Number(act) : Number(plan || 0)) * specs.bottlesPerCase * scrapFactor;

            let dTrucks = 0;
            let bal = runningBalance - dDem;
            if (bal < localSafetyTarget) {
                const needed = Math.ceil((localSafetyTarget - bal) / specs.bottlesPerTruck);
                dTrucks = needed;
                bal += needed * specs.bottlesPerTruck;
            }
            // Only set if non-zero to keep map clean, or explicitly set 0 if it was previously set?
            // To ensure stability, we should reflect the calculated state.
            if (dTrucks > 0) next60Days[ds] = dTrucks;
            else if (inboundMap[ds]) next60Days[ds] = 0; // Only explicitly zero out if it existed

            runningBalance = bal;
        }

        // 3. Diff Check: Compare 'next60Days' with 'inboundMap'
        let hasChanges = false;
        Object.entries(next60Days).forEach(([date, qty]) => {
            const current = inboundMap[date] || 0;
            if (current !== qty) hasChanges = true;
        });

        // Also check if we are missing any keys that should be zeroed? 
        // We handled "else next60Days[ds] = 0" above only if inboundMap[ds] existed. 
        // So next60Days contains ALL changes needed.

        if (!hasChanges) return;

        // 4. Construct New Map
        const newInbound = { ...inboundMap, ...next60Days };

        // Remove 0s to keep it clean (optional, but good for storage)
        Object.keys(newInbound).forEach(k => {
            if (newInbound[k] === 0) delete newInbound[k];
        });

        // Final Safety Check via JSON stringify just in case (sorted keys)
        const sortObj = o => Object.keys(o).sort().reduce((acc, k) => ({ ...acc, [k]: o[k] }), {});
        if (JSON.stringify(sortObj(newInbound)) === JSON.stringify(sortObj(inboundMap))) return;

        // Apply
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, selectedSize, true);

        if (user) {
            saveWithStatus(async () => {
                const promises = Object.entries(next60Days).map(([date, trucks]) => {
                    // Save explicit 0s or new values
                    return savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', trucks);
                });
                await Promise.all(promises);
            });
        }
    }, [calculations, isAutoReplenish, bottleDefinitions, selectedSize, safetyStockLoads, leadTimeDays, user, savePlanningEntry, setMonthlyInbound]);
    // Removed 'monthlyInbound' from deps to prevent loop, passing it as arg is sufficient for logic.
    // The effect below will control triggering.
    // Added setMonthlyInbound, monthlyInbound to dep array, logic seems fine? 
    // Wait, monthlyInbound is passed as arg inboundMap to avoid closure issues in the useMRP effect.

    // Reactive Trigger for Auto-Replenishment
    useEffect(() => {
        if (isAutoReplenish && calculations) {
            runAutoReplenishment(monthlyDemand, monthlyProductionActuals, monthlyInbound);
        }
    }, [
        calculations?.initialInventory,
        safetyStockLoads,
        leadTimeDays,
        isAutoReplenish,
        monthlyDemand,
        monthlyProductionActuals,
        monthlyInbound, // Added back to trigger on manual changes
        runAutoReplenishment
    ]);


    const setters = {
        setSelectedSize,
        updateDateDemand,
        updateDateDemandBulk: (updates) => {
            const newDemand = { ...monthlyDemand, ...updates };
            setMonthlyDemand(newDemand);
            saveLocalState('monthlyDemand', newDemand, selectedSize, true);

            if (user) {
                saveWithStatus(async () => {
                    const promises = Object.entries(updates).map(([date, val]) =>
                        savePlanningEntry(user.id, selectedSize, date, 'demand_plan', Number(val))
                    );
                    await Promise.all(promises);
                });
            }
        },
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
            selectedSize
        }
    }
}
