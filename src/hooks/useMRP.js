
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useSupabaseSync } from './useSupabaseSync';

export function useMRP() {
    const { bottleDefinitions, safetyStockLoads, leadTimeDays, bottleSizes, updateBottleDefinition } = useSettings();
    const { user } = useAuth();
    const { fetchMRPState, savePlanningEntry, saveProductionSetting, saveInventoryAnchor, migrateLocalStorage } = useSupabaseSync();

    // 1. Load Selected Size first (Local persist for UI preference is fine)
    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('mrp_selectedSize') || '20oz');

    // Helper: Dynamic Key Generation (Legacy LocalStorage)
    const getStorageKey = (key, sku = selectedSize) => `mrp_${sku}_${key}`;

    // Helper: Smart Load (Migrates Legacy Data if New Key missing)
    const loadLocalState = (key, defaultVal, parse = false) => {
        const fullKey = getStorageKey(key);
        const legacyKey = `mrp_${key}`;
        let saved = localStorage.getItem(fullKey);
        if (saved === null && selectedSize === '20oz') {
            saved = localStorage.getItem(legacyKey);
        }
        if (saved === null) return defaultVal;
        if (parse) {
            try { return JSON.parse(saved) || defaultVal; }
            catch { return defaultVal; }
        }
        return saved;
    };

    // Helper: Save State (Local)
    const saveLocalState = (key, value, parse = false) => {
        const fullKey = getStorageKey(key);
        const val = parse ? JSON.stringify(value) : value;
        localStorage.setItem(fullKey, val);
    };

    // --- State Definitions ---
    // For logged-in users, we start with EMPTY/Loading state to avoid "flashing" local stale data.
    // For anon users, we initialize directly from LocalStorage.

    const init = (key, defaultVal, parse = false) => {
        if (user) return defaultVal; // Return default (empty) if user exists, wait for fetch
        return loadLocalState(key, defaultVal, parse);
    };

    const [monthlyDemand, setMonthlyDemand] = useState(() => init('monthlyDemand', {}, true));
    const [monthlyProductionActuals, setMonthlyProductionActuals] = useState(() => init('monthlyProductionActuals', {}, true));
    const [monthlyInbound, setMonthlyInbound] = useState(() => init('monthlyInbound', {}, true));
    const [truckManifest, setTruckManifest] = useState(() => init('truckManifest', {}, true));
    // productionRate is now derived from settings
    const [downtimeHours, setDowntimeHours] = useState(() => user ? 0 : Number(loadLocalState('downtimeHours', 0)));
    const [currentInventoryPallets, setCurrentInventoryPallets] = useState(() => user ? 0 : Number(loadLocalState('currentInventoryPallets', 0)));
    const [inventoryAnchor, setInventoryAnchor] = useState(() =>
        user ? { date: new Date().toISOString().split('T')[0], count: 0 } :
            loadLocalState('inventoryAnchor', { date: new Date().toISOString().split('T')[0], count: 0 }, true)
    );
    const [incomingTrucks, setIncomingTrucks] = useState(() => user ? 0 : Number(loadLocalState('incomingTrucks', 0)));
    const [yardInventory, setYardInventory] = useState(() =>
        user ? { count: 0, timestamp: null, fileName: null } :
            loadLocalState('yardInventory', { count: 0, timestamp: null, fileName: null }, true)
    );
    const [manualYardOverride, setManualYardOverride] = useState(() => {
        if (user) return null;
        const val = loadLocalState('manualYardOverride', null);
        return val ? Number(val) : null;
    });
    const [isAutoReplenish, setIsAutoReplenish] = useState(() => user ? true : loadLocalState('isAutoReplenish', true, true));

    // --- Auto-Refresh on Focus ---
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const onTrigger = () => {
            // Only auto-refresh if user is logged in (cloud mode) and app is visible
            if (user && document.visibilityState === 'visible') {
                console.log("App Focused/Visible: Refreshing Cloud Data...");
                setRefreshTrigger(t => t + 1);
            }
        };

        document.addEventListener('visibilitychange', onTrigger);
        window.addEventListener('focus', onTrigger);
        return () => {
            document.removeEventListener('visibilitychange', onTrigger);
            window.removeEventListener('focus', onTrigger);
        };
    }, [user]);

    // --- Cloud Sync Effect ---
    useEffect(() => {
        localStorage.setItem('mrp_selectedSize', selectedSize);

        if (!user) {
            // Local Mode: Reload local state when SKU changes
            console.log("Local Mode: Loading from LocalStorage");
            setMonthlyDemand(loadLocalState('monthlyDemand', {}, true));
            setMonthlyProductionActuals(loadLocalState('monthlyProductionActuals', {}, true));
            setMonthlyInbound(loadLocalState('monthlyInbound', {}, true));
            setTruckManifest(loadLocalState('truckManifest', {}, true));
            setProductionRate(Number(loadLocalState('productionRate', 0)));
            setDowntimeHours(Number(loadLocalState('downtimeHours', 0)));
            // ... (other setters if needed, but react usually handles re-render if key changes)
            // Actually, hooks don't re-run init logic on re-render, so we MUST use setters here for SKU switch.
            setInventoryAnchor(loadLocalState('inventoryAnchor', { date: new Date().toISOString().split('T')[0], count: 0 }, true));
            setIsAutoReplenish(loadLocalState('isAutoReplenish', true, true));
        } else {
            // Cloud Mode: Fetch from Supabase
            console.log(`Cloud Mode: Fetching for ${selectedSize}...`);
            const loadCloud = async () => {
                try {
                    const data = await fetchMRPState(user.id, selectedSize);

                    if (data) {
                        console.log("Cloud Data Recevied:", data.productionRate);
                        setMonthlyDemand(data.monthlyDemand || {});
                        setMonthlyProductionActuals(data.monthlyProductionActuals || {});
                        setMonthlyInbound(data.monthlyInbound || {});
                        setTruckManifest(data.truckManifest || {});
                        // Update Settings Context
                        if (data.productionRate) updateBottleDefinition(selectedSize, 'productionRate', data.productionRate);
                        setDowntimeHours(data.downtimeHours);
                        setIsAutoReplenish(data.isAutoReplenish);
                        if (data.inventoryAnchor) setInventoryAnchor(data.inventoryAnchor);
                    } else {
                        console.log("No Cloud Data found. Attempting Migration...");
                        const result = await migrateLocalStorage(user, bottleSizes);
                        if (result.success) {
                            const retry = await fetchMRPState(user.id, selectedSize);
                            if (retry) {
                                setMonthlyDemand(retry.monthlyDemand || {});
                                setMonthlyProductionActuals(retry.monthlyProductionActuals || {});
                                setMonthlyInbound(retry.monthlyInbound || {});
                                setTruckManifest(retry.truckManifest || {});
                                if (retry.productionRate) updateBottleDefinition(selectedSize, 'productionRate', retry.productionRate);
                                setDowntimeHours(retry.downtimeHours);
                                setIsAutoReplenish(retry.isAutoReplenish);
                                if (retry.inventoryAnchor) setInventoryAnchor(retry.inventoryAnchor);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to load cloud state", e);
                    setSaveError("Data Load Failed");
                }
            };
            loadCloud();
        }
    }, [selectedSize, user, refreshTrigger]); // Re-run on Size change, Login, or Focus trigger

    // --- Calculations (Identical Logic) ---
    // Updated to use Actuals if present, otherwise Demand
    const totalScheduledCases = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const allDates = new Set([...Object.keys(monthlyDemand), ...Object.keys(monthlyProductionActuals)]);

        return Array.from(allDates).reduce((acc, date) => {
            if (date >= today) {
                const actual = monthlyProductionActuals[date];
                const plan = monthlyDemand[date];
                const val = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan);
                return acc + (val || 0);
            }
            return acc;
        }, 0);
    }, [monthlyDemand, monthlyProductionActuals]);

    // Derived productionRate for calculations
    const productionRate = bottleDefinitions[selectedSize]?.productionRate || 0;

    const calculations = useMemo(() => {
        const specs = bottleDefinitions[selectedSize];
        if (!specs) return null;

        const lostProductionCases = downtimeHours * productionRate;
        const effectiveScheduledCases = Math.max(0, totalScheduledCases - lostProductionCases);
        const demandBottles = effectiveScheduledCases * specs.bottlesPerCase;

        const todayStr = new Date().toISOString().split('T')[0];
        const scheduledInboundTrucks = Object.entries(monthlyInbound).reduce((acc, [date, val]) => {
            if (date >= todayStr) return acc + (Number(val) || 0);
            return acc;
        }, 0);

        const totalIncomingTrucks = incomingTrucks + scheduledInboundTrucks;
        const incomingBottles = totalIncomingTrucks * specs.bottlesPerTruck;

        const effectiveYardLoads = manualYardOverride !== null ? manualYardOverride : yardInventory.count;
        const yardBottles = effectiveYardLoads * specs.bottlesPerTruck;

        const csm = specs.casesPerPallet || 0;

        let derivedPallets = inventoryAnchor.count;
        const anchorDate = new Date(inventoryAnchor.date);
        anchorDate.setHours(0, 0, 0, 0);

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const diffTime = todayDate - anchorDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays < 365) {
            for (let i = 0; i < diffDays; i++) {
                const d = new Date(anchorDate);
                d.setDate(anchorDate.getDate() + i);
                const ds = d.toISOString().split('T')[0];

                const actual = monthlyProductionActuals[ds];
                const plan = monthlyDemand[ds];
                const dDemandCases = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan || 0);
                const dInboundTrucks = Number(monthlyInbound[ds]) || 0;

                const palletsPerTruck = (specs.bottlesPerTruck / specs.bottlesPerCase) / (specs.casesPerPallet || 1);
                const dInboundPallets = dInboundTrucks * palletsPerTruck;
                const dDemandPallets = dDemandCases / (specs.casesPerPallet || 1);

                derivedPallets = derivedPallets + dInboundPallets - dDemandPallets;
            }
        }

        const inventoryBottles = derivedPallets * csm * specs.bottlesPerCase;
        const netInventory = (inventoryBottles + incomingBottles + yardBottles) - demandBottles;
        const safetyTarget = safetyStockLoads * specs.bottlesPerTruck;

        const dailyLedger = [];
        let currentBalance = inventoryBottles + yardBottles;
        let firstStockoutDate = null;
        let firstOverflowDate = null;

        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            const actual = monthlyProductionActuals[dateStr];
            const plan = monthlyDemand[dateStr];
            const dailyCases = (actual !== undefined && actual !== null) ? Number(actual) : Number(plan || 0);

            const dailyDemand = dailyCases * specs.bottlesPerCase;
            const dailyTrucks = Number(monthlyInbound[dateStr]) || 0;
            const dailySupply = dailyTrucks * specs.bottlesPerTruck;

            currentBalance = currentBalance + dailySupply - dailyDemand;

            dailyLedger.push({
                date: dateStr,
                balance: currentBalance,
                demand: dailyDemand,
                supply: dailySupply
            });

            if (currentBalance < safetyTarget && !firstStockoutDate) {
                firstStockoutDate = dateStr;
            }
            if (currentBalance > (safetyTarget + specs.bottlesPerTruck * 2) && !firstOverflowDate) {
                firstOverflowDate = dateStr;
            }
        }

        let trucksToOrder = 0;
        let trucksToCancel = 0;
        if (netInventory < safetyTarget) {
            trucksToOrder = Math.ceil((safetyTarget - netInventory) / specs.bottlesPerTruck);
        } else if (netInventory > safetyTarget + specs.bottlesPerTruck) {
            const surplus = netInventory - safetyTarget;
            if (surplus > specs.bottlesPerTruck) trucksToCancel = Math.floor(surplus / specs.bottlesPerTruck);
        }

        // --- DoS (Days of Supply) Calculation ---
        let daysOfSupply = 30; // Default cap (30+ days)
        if (dailyLedger.length > 0) {
            // Find the index where balance first goes below 0 (absolute stockout)
            const stockoutIndex = dailyLedger.findIndex(d => d.balance < 0);

            if (stockoutIndex !== -1) {
                // Precise calculation: Full days + partial
                // If index is 5, it means we survived day 0,1,2,3,4.
                // Partial day = BalancePrevDay / DemandThisDay

                const failingDay = dailyLedger[stockoutIndex];
                const prevBalance = stockoutIndex > 0 ? dailyLedger[stockoutIndex - 1].balance : (inventoryBottles + yardBottles); // Initial

                let partial = 0;
                if (failingDay.demand > 0 && prevBalance > 0) {
                    partial = prevBalance / failingDay.demand;
                }

                daysOfSupply = stockoutIndex + partial;
            } else {
                // If no stockout in 30 days, we assume > 30
                daysOfSupply = 30;
            }
        }

        return {
            netInventory, safetyTarget, trucksToOrder, trucksToCancel,
            lostProductionCases, effectiveScheduledCases, specs,
            yardInventory: { ...yardInventory, effectiveCount: effectiveYardLoads, isOverridden: manualYardOverride !== null },
            dailyLedger, firstStockoutDate, firstOverflowDate, totalIncomingTrucks,
            initialInventory: inventoryBottles + yardBottles,
            calculatedPallets: derivedPallets,
            daysOfSupply,
            inventoryAnchor,
            plannedOrders: (() => {
                const orders = {};
                Object.entries(monthlyInbound).forEach(([needDateStr, trucks]) => {
                    if (Number(trucks) <= 0) return;
                    const needDate = new Date(needDateStr);
                    const orderDate = new Date(needDate);
                    orderDate.setDate(orderDate.getDate() - (leadTimeDays || 0));
                    const orderDateStr = orderDate.toISOString().split('T')[0];
                    if (!orders[orderDateStr]) orders[orderDateStr] = { count: 0, items: [] };
                    orders[orderDateStr].count += Number(trucks);
                    orders[orderDateStr].items.push({ needDate: needDateStr, trucks: Number(trucks) });
                });
                return orders;
            })()
        };
    }, [selectedSize, totalScheduledCases, productionRate, downtimeHours, currentInventoryPallets, incomingTrucks, bottleDefinitions, safetyStockLoads, yardInventory, manualYardOverride, monthlyDemand, monthlyInbound, inventoryAnchor, leadTimeDays]);

    // --- Actions (Dual Write: Local + Supabase) ---

    // Generalized wrapper to save concurrently
    const setAndPersist = (key, value, setter, saveFn) => {
        // 1. Update React State (Instant UI)
        setter(value);
        // 2. Persist to LocalStorage (Backup)
        saveLocalState(key, value, true); // Assuming JSON
        // 3. Persist to Supabase (if Logged In)
        if (user) {
            saveFn && saveFn(value);
        }
    };


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
            // Small artificial delay to let user see "Saving..."
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    const updateDateDemand = (date, value) => {
        const val = Number(value);
        const newDemand = { ...monthlyDemand, [date]: val };
        setMonthlyDemand(newDemand);
        saveLocalState('monthlyDemand', newDemand, true);
        if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'demand_plan', val));
    };

    const updateDateActual = (date, value) => {
        const val = (value === '' || value === null) ? undefined : Number(value);
        const newActuals = { ...monthlyProductionActuals };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;
        setMonthlyProductionActuals(newActuals);
        saveLocalState('monthlyProductionActuals', newActuals, true);
        if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'production_actual', val || 0));
    };

    const updateDateInbound = (date, value) => {
        const val = Number(value);
        const newInbound = { ...monthlyInbound, [date]: val };
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, true);
        if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', val));
    };

    // Auto-Replenish Shared Logic -- (Optimized to batch save??) 
    // For now we assume runAutoReplenishment triggers multiple saves. 
    // We should probably optimize this, but "Saving..." indicator will just stay on, which is fine.
    // Auto-Replenish Logic (Reactive)
    const runAutoReplenishment = useCallback((demandMap, actualMap, inboundMap) => {
        if (!calculations || !isAutoReplenish) return;

        const specs = bottleDefinitions[selectedSize];
        const localSafetyTarget = safetyStockLoads * specs.bottlesPerTruck;
        let runningBalance = calculations.initialInventory;
        const today = new Date();
        const startOffset = leadTimeDays || 2; // Respect lead time (48h)
        const next60Days = {};

        // 1. Simulator: Walk through locked period (0 to leadTime-1)
        for (let i = 0; i < startOffset; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const ds = d.toISOString().split('T')[0];
            const act = actualMap[ds];
            const plan = demandMap[ds];
            const dDem = ((act !== undefined && act !== null) ? Number(act) : Number(plan || 0)) * specs.bottlesPerCase;
            // Use EXISTING Inbound (Locked)
            const existingTrucks = inboundMap[ds] || 0;
            runningBalance = runningBalance + (existingTrucks * specs.bottlesPerTruck) - dDem;
        }

        // 2. Planner: Walk from LeadTime onwards
        for (let i = startOffset; i < 60; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const ds = d.toISOString().split('T')[0];

            const act = actualMap[ds];
            const plan = demandMap[ds];
            const dDem = ((act !== undefined && act !== null) ? Number(act) : Number(plan || 0)) * specs.bottlesPerCase;

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

        console.log("Auto-Replenish: Updating Inbound Schedule...");
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, true);

        if (user) {
            saveWithStatus(async () => {
                const promises = Object.entries(next60Days).map(([date, trucks]) => {
                    // Only save if different from previous? (Optimization)
                    // unique key logic might be needed here but Supabase upsert handles it.
                    if (trucks > 0 || (inboundMap[date] > 0 && trucks === 0)) {
                        return savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', trucks);
                    }
                    return Promise.resolve();
                });
                await Promise.all(promises);
            });
        }
    }, [calculations, isAutoReplenish, bottleDefinitions, selectedSize, safetyStockLoads, leadTimeDays, user, savePlanningEntry]);

    // Reactive Trigger for Auto-Replenishment
    useEffect(() => {
        if (isAutoReplenish && calculations) {
            // We pass current state maps explicitly to avoid closure staleness if dependencies lag
            runAutoReplenishment(monthlyDemand, monthlyProductionActuals, monthlyInbound);
        }
    }, [
        // Triggers:
        calculations.initialInventory, // Floor/Yard/Yesterday Actuals change this
        safetyStockLoads,
        leadTimeDays,
        isAutoReplenish, // Toggling on
        // Note: monthlyDemand/Actuals change also triggers this via effect re-run? 
        // We need to be careful. calculations depends on monthlyDemand.
        // So yes, modifying demand triggers this.
        monthlyDemand,
        monthlyProductionActuals,
        // We do NOT add monthlyInbound here to avoid loop (runAutoRep -> setInbound -> Effect).
        // The equality check in runAutoRep stops the valid loop, but we shouldn't trigger FROM inbound change unless we want "Correction of manual overrides"? 
        // If user manually changes inbound, do we want to overwrite it instantly? 
        // Current logic: Planner sets next60days. If user edits next60days manually, 
        // runAutoRep will see the new manual value in 'inboundMap', calculate 'needed', and likely overwritten it if it differs from math.
        // This effectively makes Manual Overrides impossible in the "Auto Zone" (LeadTime+). 
        // This is "Strict Auto-Replenish". For now, this is desired.
    ]);

    return {
        formState: {
            isSaving,
            saveError, // Exposed
            selectedSize,
            monthlyDemand,
            monthlyInbound,
            truckManifest,
            monthlyProductionActuals,
            productionRate,
            downtimeHours,
            totalScheduledCases,
            currentInventoryPallets,
            incomingTrucks,
            yardInventory,
            manualYardOverride,
            isAutoReplenish,
            inventoryAnchor
        },
        setters: {
            setSelectedSize,
            updateDateDemand,
            updateDateActual,
            updateDateActual,
            updateDateInbound,
            updateTruckManifest: (date, trucks) => {
                // trucks: Array of { id, po, carrier, time, status }
                const newManifest = { ...truckManifest, [date]: trucks };
                // Filter out empty arrays to keep state clean?
                if (!trucks || trucks.length === 0) delete newManifest[date];

                setTruckManifest(newManifest);
                saveLocalState('truckManifest', newManifest, true);
                // Trigger Cloud Save (needs new entry_type support in useSupabaseSync logic later, or simple JSON blob)
                // For now, let's piggyback or skipping cloud specifically for detailed manifest rows until schema update?
                // Actually, let's try to save it as a special PlanningEntry if possible, or just fail silently in cloud for now.
                // We will implement `saveTruckManifest` in useSupabase in next step.
                if (user) saveWithStatus(() => savePlanningEntry(user.id, selectedSize, date, 'truck_manifest_json', JSON.stringify(trucks)));
            },
            setProductionRate: (v) => {
                const val = Number(v);
                // setProductionRate(val); // Removed local state
                updateBottleDefinition(selectedSize, 'productionRate', val);
                // No local save needed as SettingsContext saves to LS
                if (user) saveWithStatus(() => saveProductionSetting(user.id, selectedSize, 'production_rate', val));
            },
            setDowntimeHours: (v) => {
                const val = Number(v);
                setDowntimeHours(val);
                saveLocalState('downtimeHours', val);
                if (user) saveWithStatus(() => saveProductionSetting(user.id, selectedSize, 'downtime_hours', val));
            },
            setCurrentInventoryPallets: (v) => { const val = Number(v); setCurrentInventoryPallets(val); saveLocalState('currentInventoryPallets', val); },
            setIncomingTrucks: (v) => { const val = Number(v); setIncomingTrucks(val); saveLocalState('incomingTrucks', val); },
            setYardInventory: (v) => { setYardInventory(v); saveLocalState('yardInventory', v, true); },
            setManualYardOverride: (v) => { const val = v === '' ? null : Number(v); setManualYardOverride(val); saveLocalState('manualYardOverride', val); },
            setIsAutoReplenish: (v) => {
                setIsAutoReplenish(v);
                saveLocalState('isAutoReplenish', v, true);
                if (user) saveWithStatus(() => saveProductionSetting(user.id, selectedSize, 'is_auto_replenish', v));
            },
            setInventoryAnchor: (v) => {
                setInventoryAnchor(v);
                saveLocalState('inventoryAnchor', v, true);
                if (user) saveWithStatus(() => saveInventoryAnchor(user.id, selectedSize, v));
            }
        },
        results: calculations
    };
}
