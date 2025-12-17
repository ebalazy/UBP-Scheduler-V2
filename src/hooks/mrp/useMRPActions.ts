import { useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../context/ProductsContext';
import { useSupabaseSync } from '../useSupabaseSync';
import { addDays, getLocalISOString } from '../../utils/dateUtils';
import { saveLocalState } from './useMRPState';
import { CalculateMRPResult } from '../../utils/mrpLogic';

// Define interface for expected State input (mirroring useMRPState output)
interface MRPStateActionsInput {
    // We should probably define this shared interface in types/mrp.ts but for now inline or 'any' if complex
    // List what we depend on:
    selectedSize: string;
    setSelectedSize: (size: string) => void;
    monthlyDemand: Record<string, number>;
    setMonthlyDemand: (v: Record<string, number>) => void;
    monthlyProductionActuals: Record<string, number>;
    setMonthlyProductionActuals: (v: Record<string, number>) => void;
    monthlyInbound: Record<string, number>;
    setMonthlyInbound: (v: Record<string, number>) => void;
    truckManifest: Record<string, any>;
    setTruckManifest: (v: Record<string, any>) => void;
    setDowntimeHours: (v: number) => void;
    setCurrentInventoryPallets: (v: number) => void;
    setIncomingTrucks: (v: number) => void;
    setYardInventory: (v: any) => void;
    setManualYardOverride: (v: boolean) => void;
    isAutoReplenish: boolean;
    setIsAutoReplenish: (v: boolean) => void;
    setInventoryAnchor: (v: any) => void;
    inventoryAnchor: any;
    [key: string]: any;
}

interface CalculationsResult {
    calculations: CalculateMRPResult | null;
}

export function useMRPActions(state: MRPStateActionsInput, calculationsResult: CalculationsResult) {
    const { safetyStockLoads, leadTimeDays } = useSettings();
    const { productMap: bottleDefinitions, refreshProducts } = useProducts();
    const { user, userRole } = useAuth();
    const { savePlanningEntry, saveProductionSetting, saveInventorySnapshot } = useSupabaseSync(); // Rename saveInventoryAnchor -> saveInventorySnapshot

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
        // setManualYardOverride,
        isAutoReplenish, setIsAutoReplenish,
        setInventoryAnchor, inventoryAnchor
    } = state;

    const { calculations } = calculationsResult;

    // --- Refs for Stable Actions (Prevent Re-renders) ---
    const lastManualRun = useRef(0);
    const demandRef = useRef(monthlyDemand);
    const actualRef = useRef(monthlyProductionActuals);
    const inboundRef = useRef(monthlyInbound);

    useLayoutEffect(() => { demandRef.current = monthlyDemand; }, [monthlyDemand]);
    useLayoutEffect(() => { actualRef.current = monthlyProductionActuals; }, [monthlyProductionActuals]);
    useLayoutEffect(() => { inboundRef.current = monthlyInbound; }, [monthlyInbound]);

    // --- Actions ---
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const saveTimers = useRef<Record<string, any>>({});
    const localSaveTimers = useRef<Record<string, any>>({});

    const saveWithStatus = useCallback(async (fn: () => Promise<void>) => {
        const canEdit = ['admin', 'planner'].includes(userRole || '');
        if (!canEdit) return;

        setSaveError(null);
        try { await fn(); }
        catch (e: any) {
            console.error("Save Error", e);
            setSaveError(e.message || "Save Failed");
        }
    }, [userRole]);

    const scheduleSave = useCallback((key: string, fn: () => Promise<void>, delay = 1000) => {
        if (saveTimers.current[key]) {
            clearTimeout(saveTimers.current[key]);
        }
        saveTimers.current[key] = setTimeout(() => {
            saveWithStatus(fn);
            delete saveTimers.current[key];
        }, delay);
    }, [saveWithStatus]);

    const scheduleLocalSave = useCallback((key: string, fn: () => void, delay = 300) => {
        if (localSaveTimers.current[key]) {
            clearTimeout(localSaveTimers.current[key]);
        }
        localSaveTimers.current[key] = setTimeout(() => {
            fn();
            delete localSaveTimers.current[key];
        }, delay);
    }, []);

    useEffect(() => {
        return () => {
            Object.values(saveTimers.current).forEach(clearTimeout);
            Object.values(localSaveTimers.current).forEach(clearTimeout);
        };
    }, []);

    const runAutoReplenishment = useCallback(() => {
        if (!calculations || !isAutoReplenish) return;

        const demandMap = demandRef.current;
        const actualMap = actualRef.current;
        const inboundMap = inboundRef.current;

        const specs = bottleDefinitions[selectedSize];
        if (!specs) return;

        const scrapFactor = 1 + ((specs.scrapPercentage || 0) / 100);
        const localSafetyTarget = (safetyStockLoads || 0) * specs.bottlesPerTruck;
        let runningBalance = calculations.initialInventory || 0;
        const startOffset = leadTimeDays || 2;
        const next60Days: Record<string, number> = {};

        const todayStr = getLocalISOString();

        // 1. Simulator: Walk through locked period
        for (let i = 0; i < startOffset; i++) {
            const ds = addDays(todayStr, i);
            const act = actualMap[ds];
            const plan = demandMap[ds];

            const isFuture = ds > todayStr;
            const useActual = (act !== undefined && act !== null) && (!isFuture || Number(act) !== 0);
            const caseCount = useActual ? Number(act) : Number(plan || 0);

            const dDem = caseCount * (specs.bottlesPerCase || 1) * scrapFactor;
            const existingTrucks = inboundMap[ds] || 0;
            runningBalance = runningBalance + (existingTrucks * specs.bottlesPerTruck) - dDem;
        }

        // 2. Planner: Walk from LeadTime onwards
        for (let i = startOffset; i < 60; i++) {
            const ds = addDays(todayStr, i);
            const act = actualMap[ds];
            const plan = demandMap[ds];

            const isFuture = ds > todayStr;
            const useActual = (act !== undefined && act !== null) && (!isFuture || Number(act) !== 0);
            const caseCount = useActual ? Number(act) : Number(plan || 0);

            const dDem = caseCount * (specs.bottlesPerCase || 1) * scrapFactor;

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

        Object.keys(newInbound).forEach(k => {
            if (newInbound[k] === 0) delete newInbound[k];
        });

        // Final Safety Check
        const sortObj = (o: any) => Object.keys(o).sort().reduce((acc: any, k) => ({ ...acc, [k]: o[k] }), {});
        if (JSON.stringify(sortObj(newInbound)) === JSON.stringify(sortObj(inboundMap))) return;

        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, selectedSize, true);

        if (user && ['admin', 'planner'].includes(userRole || '')) {
            saveWithStatus(async () => {
                const promises = Object.entries(next60Days).map(([date, trucks]) => {
                    return savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', trucks);
                });
                await Promise.all(promises);
            });
        }
    }, [calculations, isAutoReplenish, bottleDefinitions, selectedSize, safetyStockLoads, leadTimeDays, user, userRole, savePlanningEntry, setMonthlyInbound, saveWithStatus]);


    const updateDateDemand = useCallback((date: string, value: any) => {
        const val = value;
        const newDemand = { ...demandRef.current, [date]: val };

        setMonthlyDemand(newDemand);
        scheduleLocalSave('monthlyDemand', () => {
            saveLocalState('monthlyDemand', newDemand, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `demand-${date}`,
                async () => savePlanningEntry(user.id, selectedSize, date, 'demand_plan', Number(val)),
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyDemand, savePlanningEntry]);

    const updateDateActual = useCallback((date: string, value: any) => {
        const val = (value === '' || value === null) ? undefined : value;
        const newActuals = { ...actualRef.current };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;

        setMonthlyProductionActuals(newActuals);

        scheduleLocalSave('monthlyProductionActuals', () => {
            saveLocalState('monthlyProductionActuals', newActuals, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `actual-${date}`,
                async () => savePlanningEntry(user.id, selectedSize, date, 'production_actual', val === undefined ? null : Number(val)),
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyProductionActuals, savePlanningEntry]);

    const updateDateInbound = useCallback((date: string, value: any) => {
        const val = value;
        const newInbound = { ...inboundRef.current };

        if (val === '' || val === '0' || Number(val) === 0) {
            delete newInbound[date];
        } else {
            newInbound[date] = val;
        }

        setMonthlyInbound(newInbound);
        scheduleLocalSave('monthlyInbound', () => {
            saveLocalState('monthlyInbound', newInbound, selectedSize, true);
        }, 500);

        if (user) {
            scheduleSave(
                `inbound-${date}`,
                async () => savePlanningEntry(
                    user.id,
                    selectedSize,
                    date,
                    'inbound_trucks',
                    (val === '' || val === '0' || Number(val) === 0) ? null : Number(val)
                ),
                1000
            );
        }
    }, [selectedSize, user, scheduleSave, scheduleLocalSave, setMonthlyInbound, savePlanningEntry]);

    useEffect(() => {
        if (!isAutoReplenish || !calculations) return;
        if (Date.now() - lastManualRun.current < 250) return;

        const timer = setTimeout(() => {
            runAutoReplenishment();
        }, 50);
        return () => clearTimeout(timer);
    }, [
        inventoryAnchor, // Stable Input
        safetyStockLoads,
        leadTimeDays,
        isAutoReplenish,
        monthlyDemand,
        monthlyProductionActuals, // Triggers
        calculations,
        runAutoReplenishment
    ]);


    const updateDateDemandBulk = useCallback((updates: Record<string, number>) => {
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

    const setters = useMemo(() => ({
        setSelectedSize,
        updateDateDemand,
        updateDateDemandBulk,
        updateDateActual,
        updateDateInbound,
        updateTruckManifest: (date: string, trucks: any[]) => {
            const newManifest = { ...truckManifest, [date]: trucks };
            if (!trucks || trucks.length === 0) delete newManifest[date];

            setTruckManifest(newManifest);
            saveLocalState('truckManifest', newManifest, selectedSize, true);
            if (user) saveWithStatus(async () => savePlanningEntry(user.id, selectedSize, date, 'truck_manifest_json', JSON.stringify(trucks)));
        },
        setProductionRate: async (v: string | number) => {
            const val = Number(v);
            setLocalProductionRate(val);

            if (user) {
                await saveWithStatus(async () => saveProductionSetting(user.id, selectedSize, 'production_rate', val));
                refreshProducts();
            }
        },
        setDowntimeHours: (v: string | number) => {
            const val = Number(v);
            setDowntimeHours(val);
            saveLocalState('downtimeHours', val, selectedSize);
            if (user) saveWithStatus(async () => saveProductionSetting(user.id, selectedSize, 'downtime_hours', val));
        },
        setCurrentInventoryPallets: (v: string | number) => {
            const val = Number(v);
            setCurrentInventoryPallets(val);
            saveLocalState('currentInventoryPallets', val, selectedSize);
        },
        setIncomingTrucks: (v: string | number) => {
            const val = Number(v);
            setIncomingTrucks(val);
            saveLocalState('incomingTrucks', val, selectedSize);
        },
        setYardInventory: (v: any) => {
            setYardInventory(v);
            saveLocalState('yardInventory', v, selectedSize, true);
        },
        updateYardInventory: (v: string | number) => {
            const val = Number(v);
            const now = getLocalISOString();
            setYardInventory({ date: now, count: val });
            saveLocalState('yardInventory', { date: now, count: val }, selectedSize, true);
            if (user) saveWithStatus(async () => saveInventorySnapshot(user.id, selectedSize, now, val, 'yard'));
        },
        setIsAutoReplenish: (v: boolean) => {
            setIsAutoReplenish(v);
            saveLocalState('isAutoReplenish', v, selectedSize, true);
            if (user) saveWithStatus(async () => saveProductionSetting(user.id, selectedSize, 'is_auto_replenish', v));
        },
        setInventoryAnchor: (v: any) => {
            setInventoryAnchor(v);
            saveLocalState('inventoryAnchor', v, selectedSize, true);
            if (user) saveWithStatus(() => saveInventorySnapshot(user.id, selectedSize, v.date, v.count, 'floor')); // Using saveInventorySnapshot (mapped from saveInventoryAnchor logic)
        }
    }), [
        setSelectedSize, updateDateDemand, updateDateDemandBulk, updateDateActual, updateDateInbound,
        truckManifest, setTruckManifest, selectedSize, user, saveWithStatus, savePlanningEntry,
        setLocalProductionRate, saveProductionSetting, refreshProducts,
        setDowntimeHours, setCurrentInventoryPallets, setIncomingTrucks, setYardInventory, setIsAutoReplenish,
        setInventoryAnchor, saveInventorySnapshot
    ]);

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
