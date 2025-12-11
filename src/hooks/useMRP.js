
import { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useSupabaseSync } from './useSupabaseSync';

export function useMRP() {
    const { bottleDefinitions, safetyStockLoads, leadTimeDays, bottleSizes } = useSettings();
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

    // --- State Definitions (Initialized with Local Data for Anon, Replaced if User) --
    // We maintain the "Local First" init to avoid null errors, 
    // but we'll overlay Cloud data if User exists.

    // Monthly Demand (Date -> Cases)
    const [monthlyDemand, setMonthlyDemand] = useState(() => loadLocalState('monthlyDemand', {}, true));
    const [monthlyProductionActuals, setMonthlyProductionActuals] = useState(() => loadLocalState('monthlyProductionActuals', {}, true));
    const [monthlyInbound, setMonthlyInbound] = useState(() => loadLocalState('monthlyInbound', {}, true));
    const [productionRate, setProductionRate] = useState(() => Number(loadLocalState('productionRate', 0)));
    const [downtimeHours, setDowntimeHours] = useState(() => Number(loadLocalState('downtimeHours', 0)));
    // Note: currentInventoryPallets is becoming obsolete in favor of Inventory Anchor?
    // We'll keep it for legacy if needed/calculated.
    const [currentInventoryPallets, setCurrentInventoryPallets] = useState(() => Number(loadLocalState('currentInventoryPallets', 0)));
    const [inventoryAnchor, setInventoryAnchor] = useState(() =>
        loadLocalState('inventoryAnchor', { date: new Date().toISOString().split('T')[0], count: 0 }, true)
    );
    const [incomingTrucks, setIncomingTrucks] = useState(() => Number(loadLocalState('incomingTrucks', 0)));
    const [yardInventory, setYardInventory] = useState(() =>
        loadLocalState('yardInventory', { count: 0, timestamp: null, fileName: null }, true)
    );
    const [manualYardOverride, setManualYardOverride] = useState(() => {
        const val = loadLocalState('manualYardOverride', null);
        return val ? Number(val) : null;
    });
    const [isAutoReplenish, setIsAutoReplenish] = useState(() => loadLocalState('isAutoReplenish', true, true));

    // --- Cloud Sync Effect ---
    useEffect(() => {
        localStorage.setItem('mrp_selectedSize', selectedSize);

        if (!user) {
            // Local Mode: Just reload local state when SKU changes
            setMonthlyDemand(loadLocalState('monthlyDemand', {}, true));
            setMonthlyProductionActuals(loadLocalState('monthlyProductionActuals', {}, true));
            setMonthlyInbound(loadLocalState('monthlyInbound', {}, true));
            setProductionRate(Number(loadLocalState('productionRate', 0)));
            setDowntimeHours(Number(loadLocalState('downtimeHours', 0)));
            setCurrentInventoryPallets(Number(loadLocalState('currentInventoryPallets', 0)));
            setInventoryAnchor(loadLocalState('inventoryAnchor', { date: new Date().toISOString().split('T')[0], count: 0 }, true));
            setIncomingTrucks(Number(loadLocalState('incomingTrucks', 0)));
            setYardInventory(loadLocalState('yardInventory', { count: 0, timestamp: null, fileName: null }, true));

            const mo = loadLocalState('manualYardOverride', null);
            setManualYardOverride(mo ? Number(mo) : null);
            setIsAutoReplenish(loadLocalState('isAutoReplenish', true, true));
        } else {
            // Cloud Mode: Fetch from Supabase
            const loadCloud = async () => {
                try {
                    const data = await fetchMRPState(user.id, selectedSize);

                    if (data) {
                        // We found data! Hydrate state.
                        setMonthlyDemand(data.monthlyDemand || {});
                        setMonthlyProductionActuals(data.monthlyProductionActuals || {});
                        setMonthlyInbound(data.monthlyInbound || {});
                        setProductionRate(data.productionRate);
                        setDowntimeHours(data.downtimeHours);
                        setIsAutoReplenish(data.isAutoReplenish);
                        if (data.inventoryAnchor) setInventoryAnchor(data.inventoryAnchor);

                        // Note: Yard Inventory, IncomingTrucks might be ephemeral or need new tables?
                        // For now we don't have separate tables for yard snapshots except inventory_snapshots(latest).
                        // Let's assume Yard Inventory persists in LocalStorage for now OR migrate it to 'inventory_snapshots' (location=yard).
                        // The schema has 'location'='yard'.
                        // But current `yardInventory` is an object { count, timestamp, filename }.
                        // Supabase `inventory_snapshots` for yard could work.
                        // I'll skip deep yard persistence for this exact step to minimize risk, 
                        // falling back to local for Yard defaults.
                    } else {
                        // No Data found for this SKU. 
                        // Check if we should Auto-Migrate from LocalStorage?
                        // If user is new to this SKU on Cloud, but has Local data...
                        // We'll try migration ONCE.
                        console.log("No cloud data found. Attempting migration...");
                        const result = await migrateLocalStorage(user, bottleSizes);
                        if (result.success) {
                            // Retry fetch
                            const retry = await fetchMRPState(user.id, selectedSize);
                            if (retry) {
                                setMonthlyDemand(retry.monthlyDemand || {});
                                setMonthlyProductionActuals(retry.monthlyProductionActuals || {});
                                setMonthlyInbound(retry.monthlyInbound || {});
                                setProductionRate(retry.productionRate);
                                setDowntimeHours(retry.downtimeHours);
                                setIsAutoReplenish(retry.isAutoReplenish);
                                if (retry.inventoryAnchor) setInventoryAnchor(retry.inventoryAnchor);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to load cloud state", e);
                }
            };
            loadCloud();
        }
    }, [selectedSize, user]); // Re-run when User logs in or Size changes

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

    const updateDateDemand = (date, value) => {
        const val = Number(value);
        const newDemand = { ...monthlyDemand, [date]: val };

        setMonthlyDemand(newDemand);
        saveLocalState('monthlyDemand', newDemand, true);

        if (user) savePlanningEntry(user.id, selectedSize, date, 'demand_plan', val);

        if (isAutoReplenish && calculations) runAutoReplenishment(newDemand, monthlyProductionActuals);
    };

    const updateDateActual = (date, value) => {
        const val = (value === '' || value === null) ? undefined : Number(value);
        const newActuals = { ...monthlyProductionActuals };
        if (val === undefined) delete newActuals[date];
        else newActuals[date] = val;

        setMonthlyProductionActuals(newActuals);
        saveLocalState('monthlyProductionActuals', newActuals, true);

        if (user) savePlanningEntry(user.id, selectedSize, date, 'production_actual', val || 0);

        if (isAutoReplenish && calculations) runAutoReplenishment(monthlyDemand, newActuals);
    };

    const updateDateInbound = (date, value) => {
        const val = Number(value);
        const newInbound = { ...monthlyInbound, [date]: val };

        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, true);

        if (user) savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', val);
    };

    // Auto-Replenish Shared Logic
    const runAutoReplenishment = (demandMap, actualMap) => {
        const specs = bottleDefinitions[selectedSize];
        const localSafetyTarget = safetyStockLoads * specs.bottlesPerTruck;
        let runningBalance = calculations.initialInventory; // Approximation
        const today = new Date();
        const next60Days = {};

        // Recalculate basic logic for next 60 days
        for (let i = 0; i < 60; i++) {
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

        const newInbound = { ...monthlyInbound, ...next60Days };
        setMonthlyInbound(newInbound);
        saveLocalState('monthlyInbound', newInbound, true);

        if (user) {
            // Batch save?? We need a batch upsert for optimal perf, but single calls work for now.
            // Or only save the CHANGED days?
            Object.entries(next60Days).forEach(([date, trucks]) => {
                if (trucks > 0 || monthlyInbound[date] > 0) { // Only save if relevant
                    savePlanningEntry(user.id, selectedSize, date, 'inbound_trucks', trucks);
                }
            });
        }
    };

    return {
        formState: {
            selectedSize,
            monthlyDemand,
            monthlyInbound,
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
            updateDateInbound,
            setProductionRate: (v) => {
                const val = Number(v);
                setProductionRate(val);
                saveLocalState('productionRate', val);
                if (user) saveProductionSetting(user.id, selectedSize, 'production_rate', val);
            },
            setDowntimeHours: (v) => {
                const val = Number(v);
                setDowntimeHours(val);
                saveLocalState('downtimeHours', val);
                if (user) saveProductionSetting(user.id, selectedSize, 'downtime_hours', val);
            },
            setCurrentInventoryPallets: (v) => { const val = Number(v); setCurrentInventoryPallets(val); saveLocalState('currentInventoryPallets', val); },
            setIncomingTrucks: (v) => { const val = Number(v); setIncomingTrucks(val); saveLocalState('incomingTrucks', val); },
            setYardInventory: (v) => { setYardInventory(v); saveLocalState('yardInventory', v, true); },
            setManualYardOverride: (v) => { const val = v === '' ? null : Number(v); setManualYardOverride(val); saveLocalState('manualYardOverride', val); },
            setIsAutoReplenish: (v) => {
                setIsAutoReplenish(v);
                saveLocalState('isAutoReplenish', v, true);
                if (user) saveProductionSetting(user.id, selectedSize, 'is_auto_replenish', v);
            },
            setInventoryAnchor: (v) => {
                setInventoryAnchor(v);
                saveLocalState('inventoryAnchor', v, true);
                if (user) saveInventoryAnchor(user.id, selectedSize, v);
            }
        },
        results: calculations
    };
}
