import { useState, useCallback, useEffect } from 'react';
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

    const updateDateDemand = (date, value) => {
        const val = Number(value);
        const newDemand = { ...monthlyDemand, [date]: val };
        setMonthlyDemand(newDemand);
        saveLocalState('monthlyDemand', newDemand, selectedSize, true);
        if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'demand_plan', val));
    };

    const updateDateActual = (date, value) => {
        const val = (value === '' || value === null) ? undefined : Number(value);
        const newActuals = { ...monthlyProductionActuals };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;
        setMonthlyProductionActuals(newActuals);
        saveLocalState('monthlyProductionActuals', newActuals, selectedSize, true);
        if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'production_actual', val || 0));
    };

    const updateDateInbound = (date, value) => {
        const val = Number(value);
        const newInbound = { ...monthlyInbound, [date]: val };
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, selectedSize, true);
        if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', val));
    };

    // Auto-Replenish Logic (Reactive)
    const runAutoReplenishment = useCallback((demandMap, actualMap, inboundMap) => {
        if (!calculations || !isAutoReplenish) return;

        const specs = bottleDefinitions[selectedSize];
        const scrapFactor = 1 + ((specs.scrapPercentage || 0) / 100);
        const localSafetyTarget = safetyStockLoads * specs.bottlesPerTruck;
        let runningBalance = calculations.initialInventory;
        const startOffset = leadTimeDays || 2; // Respect lead time (48h)
        const next60Days = {};

        // 1. Simulator: Walk through locked period (0 to leadTime-1)
        for (let i = 0; i < startOffset; i++) {
            const ds = addDays(getLocalISOString(), i);
            const act = actualMap[ds];
            const plan = demandMap[ds];
            const dDem = ((act !== undefined && act !== null) ? Number(act) : Number(plan || 0)) * specs.bottlesPerCase * scrapFactor;
            // Use EXISTING Inbound (Locked)
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
            if (dTrucks > 0) next60Days[ds] = dTrucks;
            else next60Days[ds] = 0;
            runningBalance = bal;
        }

        const newInbound = { ...inboundMap, ...next60Days };

        // Equality Check to prevent loops/unnecessary saves
        if (JSON.stringify(newInbound) === JSON.stringify(inboundMap)) return;

        // Auto-Replenish
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, selectedSize, true);

        if (user) {
            saveWithStatus(async () => {
                const promises = Object.entries(next60Days).map(([date, trucks]) => {
                    if (trucks > 0 || (inboundMap[date] > 0 && trucks === 0)) {
                        return savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', trucks);
                    }
                    return Promise.resolve();
                });
                await Promise.all(promises);
            });
        }
    }, [calculations, isAutoReplenish, bottleDefinitions, selectedSize, safetyStockLoads, leadTimeDays, user, savePlanningEntry, setMonthlyInbound, monthlyInbound]);
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
        // We do NOT add monthlyInbound here to avoid loop
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
        setManualYardOverride: (v) => {
            const val = v === '' ? null : Number(v);
            setManualYardOverride(val);
            saveLocalState('manualYardOverride', val, selectedSize);
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
