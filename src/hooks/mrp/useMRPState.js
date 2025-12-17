import { useState, useEffect } from 'react';
// import { useSettings } from '../../context/SettingsContext'; // Removed
import { useProducts } from '../../context/ProductsContext'; // Added
import { useAuth } from '../../context/AuthContext';
import { useSupabaseSync } from '../useSupabaseSync';
import { getLocalISOString } from '../../utils/dateUtils';

// Helper: Dynamic Key Generation (Legacy LocalStorage)
const getStorageKey = (key, sku) => `mrp_${sku}_${key}`;

// Helper: Smart Load (Migrates Legacy Data if New Key missing)
const loadLocalState = (key, defaultVal, selectedSize, parse = false) => {
    const fullKey = getStorageKey(key, selectedSize);
    const legacyKey = `mrp_${key}`;
    let saved = localStorage.getItem(fullKey);
    // Legacy migration only for default size
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
export const saveLocalState = (key, value, selectedSize, parse = false) => {
    const fullKey = getStorageKey(key, selectedSize);
    const val = parse ? JSON.stringify(value) : value;
    localStorage.setItem(fullKey, val);
};

export function useMRPState() {
    const { productMap } = useProducts();
    const bottleSizes = Object.keys(productMap);
    const { user } = useAuth();
    const { fetchMRPState, migrateLocalStorage } = useSupabaseSync();

    // 1. Load Selected Size first (Local persist for UI preference is fine)
    const [selectedSize, setSelectedSize] = useState(() => localStorage.getItem('mrp_selectedSize') || '20oz');

    // --- State Definitions ---
    // For logged-in users, we start with EMPTY/Loading state to avoid "flashing" local stale data.
    // For anon users, we initialize directly from LocalStorage.

    const [monthlyDemand, setMonthlyDemand] = useState(() => loadLocalState('monthlyDemand', {}, selectedSize, true));
    const [monthlyProductionActuals, setMonthlyProductionActuals] = useState(() => loadLocalState('monthlyProductionActuals', {}, selectedSize, true));
    const [monthlyInbound, setMonthlyInbound] = useState(() => loadLocalState('monthlyInbound', {}, selectedSize, true));
    const [truckManifest, setTruckManifest] = useState(() => loadLocalState('truckManifest', {}, selectedSize, true));

    // Derived states (some initialized from LocalStorage)
    // Derived states (some initialized from LocalStorage)
    const [downtimeHours, setDowntimeHours] = useState(() => Number(loadLocalState('downtimeHours', 0, selectedSize)));
    const [currentInventoryPallets, setCurrentInventoryPallets] = useState(() => Number(loadLocalState('currentInventoryPallets', 0, selectedSize)));
    const [inventoryAnchor, setInventoryAnchor] = useState(() =>
        loadLocalState('inventoryAnchor', { date: getLocalISOString(), count: 0 }, selectedSize, true)
    );
    const [incomingTrucks, setIncomingTrucks] = useState(() => Number(loadLocalState('incomingTrucks', 0, selectedSize)));
    const [yardInventory, setYardInventory] = useState(() =>
        loadLocalState('yardInventory', { count: 0, date: null, fileName: null }, selectedSize, true)
    );

    const [isAutoReplenish, setIsAutoReplenish] = useState(() => user ? true : loadLocalState('isAutoReplenish', true, selectedSize, true));

    // --- Auto-Refresh on Focus ---
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        /* 
           DISABLE AUTO-REFRESH ON FOCUS
           This causes race conditions where pending saves (debounced) are overwritten 
           by stale cloud data if the user switches tabs quickly.
           Until we have 'Realtime Subscriptions' or 'isDirty' tracking, 
           we must rely on manual refresh to see other users' changes.
        */
        const onTrigger = () => {
            // if (user && document.visibilityState === 'visible') {
            //     setRefreshTrigger(t => t + 1);
            // }
        };

        // document.addEventListener('visibilitychange', onTrigger);
        // window.addEventListener('focus', onTrigger);
        return () => {
            // document.removeEventListener('visibilitychange', onTrigger);
            // window.removeEventListener('focus', onTrigger);
        };
    }, [user]);

    // --- Cloud Sync Effect ---
    useEffect(() => {
        localStorage.setItem('mrp_selectedSize', selectedSize);

        if (!user) {
            // Local Mode: Reload local state when SKU changes
            setMonthlyDemand(loadLocalState('monthlyDemand', {}, selectedSize, true));
            setMonthlyProductionActuals(loadLocalState('monthlyProductionActuals', {}, selectedSize, true));
            setMonthlyInbound(loadLocalState('monthlyInbound', {}, selectedSize, true));
            setTruckManifest(loadLocalState('truckManifest', {}, selectedSize, true));

            // Note: productionRate is handled via SettingsContext now, so we don't set it here explicitly if locally loaded?
            // Actually, we might need to handle per-SKU production rate persistence if not in Settings?
            // The original logic updated Settings context from loaded cloud data.
            // Locally, we assume SettingsContext holds the truth or we read legacy 'productionRate' key?
            // Refactored logic: The original code loaded 'productionRate' from local storage and called setProductionRate.

            setDowntimeHours(Number(loadLocalState('downtimeHours', 0, selectedSize)));
            setInventoryAnchor(loadLocalState('inventoryAnchor', { date: getLocalISOString(), count: 0 }, selectedSize, true));
            setIsAutoReplenish(loadLocalState('isAutoReplenish', true, selectedSize, true));
        } else {
            // Cloud Mode: Fetch from Supabase
            const loadCloud = async () => {
                try {
                    const data = await fetchMRPState(user.id, selectedSize);

                    if (data) {
                        // SMART SYNC: Only overwrite Local (Optimistic) if Cloud has data.
                        // This prevents "flashing" to empty if the cloud fetch races or returns partials.
                        if (Object.keys(data.monthlyDemand || {}).length > 0) setMonthlyDemand(data.monthlyDemand);
                        if (Object.keys(data.monthlyProductionActuals || {}).length > 0) setMonthlyProductionActuals(data.monthlyProductionActuals);
                        if (Object.keys(data.monthlyInbound || {}).length > 0) setMonthlyInbound(data.monthlyInbound);
                        if (Object.keys(data.truckManifest || {}).length > 0) setTruckManifest(data.truckManifest);

                        // Update Settings Context
                        // FIX: Do not overwrite Master Data with stale Scenario Data
                        // if (data.productionRate) updateBottleDefinition(selectedSize, 'productionRate', data.productionRate);
                        setDowntimeHours(data.downtimeHours);
                        setIsAutoReplenish(data.isAutoReplenish);


                        // TIMESTAMP CHECK: Only accept Cloud Snapshot if it's NEWER or SAME as Local.
                        if (data.inventoryAnchor) {
                            setInventoryAnchor(prev => {
                                // If Local is Newer OR Same Day, Keep Local. (User is "Head" of current day)
                                if (prev?.date && data.inventoryAnchor.date && new Date(prev.date) >= new Date(data.inventoryAnchor.date)) {
                                    return prev;
                                }
                                return data.inventoryAnchor;
                            });
                        }
                        if (data.yardInventory) {
                            setYardInventory(prev => {
                                if (prev?.date && data.yardInventory.date && new Date(prev.date) >= new Date(data.yardInventory.date)) {
                                    return prev;
                                }
                                return data.yardInventory;
                            });
                        }
                    } else {
                        // No Cloud Data found. Attempting Migration...
                        const result = await migrateLocalStorage(user, bottleSizes);
                        if (result.success) {
                            const retry = await fetchMRPState(user.id, selectedSize);
                            if (retry) {
                                setMonthlyInbound(retry.monthlyInbound || {});
                                setTruckManifest(retry.truckManifest || {});
                                // FIX: Do not overwrite Master Data with stale Scenario Data
                                // if (retry.productionRate) updateBottleDefinition(selectedSize, 'productionRate', retry.productionRate);
                                setDowntimeHours(retry.downtimeHours);
                                setIsAutoReplenish(retry.isAutoReplenish);
                                if (retry.inventoryAnchor) setInventoryAnchor(retry.inventoryAnchor);
                                if (retry.yardInventory) setYardInventory(retry.yardInventory);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to load cloud state", e);
                    // setSaveError("Data Load Failed"); // Handled in Actions
                }
            };
            loadCloud();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSize, user?.id]); // STRICT DEPENDENCIES PREVENT JITTER

    return {
        selectedSize, setSelectedSize,
        monthlyDemand, setMonthlyDemand,
        monthlyProductionActuals, setMonthlyProductionActuals,
        monthlyInbound, setMonthlyInbound,
        truckManifest, setTruckManifest,
        downtimeHours, setDowntimeHours,
        currentInventoryPallets, setCurrentInventoryPallets,
        inventoryAnchor, setInventoryAnchor,
        incomingTrucks, setIncomingTrucks,
        yardInventory, setYardInventory,

        isAutoReplenish, setIsAutoReplenish,
        refreshTrigger // Exposed if needed
    };
}
