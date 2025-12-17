import { useState, useEffect } from 'react';
// import { useSettings } from '../../context/SettingsContext'; // Removed
import { useProducts } from '../../context/ProductsContext'; // Added
import { useAuth } from '../../context/AuthContext';
import { useSupabaseSync } from '../useSupabaseSync';
import { useRealtimeSubscription } from '../useRealtimeSubscription'; // Added
import { getLocalISOString } from '../../utils/dateUtils';

// Types
type DateValueMap = Record<string, number>;
type ManifestMap = Record<string, any[]>;
type InventorySnapshot = { date: string | null; count: number; fileName?: string | null };

// Helper: Dynamic Key Generation (Legacy LocalStorage)
const getStorageKey = (key: string, sku: string) => `mrp_${sku}_${key}`;

// Helper: Smart Load (Migrates Legacy Data if New Key missing)
const loadLocalState = <T>(key: string, defaultVal: T, selectedSize: string, parse = false): T => {
    const fullKey = getStorageKey(key, selectedSize);
    const legacyKey = `mrp_${key}`;
    let saved = localStorage.getItem(fullKey);
    // Legacy migration only for default size
    if (saved === null && selectedSize === '20oz') {
        saved = localStorage.getItem(legacyKey);
    }
    if (saved === null) return defaultVal;
    if (parse) {
        try { return (JSON.parse(saved) as T) || defaultVal; }
        catch { return defaultVal; }
    }
    return saved as T;
};

// Helper: Save State (Local)
export const saveLocalState = (key: string, value: any, selectedSize: string, parse = false) => {
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
    const [selectedSize, setSelectedSize] = useState<string>(() => localStorage.getItem('mrp_selectedSize') || '20oz');

    // --- State Definitions ---
    // For logged-in users, we start with EMPTY/Loading state to avoid "flashing" local stale data.
    // For anon users, we initialize directly from LocalStorage.

    const [monthlyDemand, setMonthlyDemand] = useState<DateValueMap>(() => loadLocalState<DateValueMap>('monthlyDemand', {}, selectedSize, true));
    const [monthlyProductionActuals, setMonthlyProductionActuals] = useState<DateValueMap>(() => loadLocalState<DateValueMap>('monthlyProductionActuals', {}, selectedSize, true));
    const [monthlyInbound, setMonthlyInbound] = useState<DateValueMap>(() => loadLocalState<DateValueMap>('monthlyInbound', {}, selectedSize, true));
    const [truckManifest, setTruckManifest] = useState<ManifestMap>(() => loadLocalState<ManifestMap>('truckManifest', {}, selectedSize, true));

    // Derived states (some initialized from LocalStorage)
    const [downtimeHours, setDowntimeHours] = useState<number>(() => Number(loadLocalState('downtimeHours', 0, selectedSize)));
    const [currentInventoryPallets, setCurrentInventoryPallets] = useState<number>(() => Number(loadLocalState('currentInventoryPallets', 0, selectedSize)));
    const [inventoryAnchor, setInventoryAnchor] = useState<InventorySnapshot>(() =>
        loadLocalState<InventorySnapshot>('inventoryAnchor', { date: getLocalISOString(), count: 0 }, selectedSize, true)
    );
    const [incomingTrucks, setIncomingTrucks] = useState<number>(() => Number(loadLocalState('incomingTrucks', 0, selectedSize)));
    const [yardInventory, setYardInventory] = useState<InventorySnapshot>(() =>
        loadLocalState<InventorySnapshot>('yardInventory', { count: 0, date: null, fileName: null }, selectedSize, true)
    );

    const [isAutoReplenish, setIsAutoReplenish] = useState<boolean>(() => user ? true : loadLocalState<boolean>('isAutoReplenish', true, selectedSize, true));

    // --- Active Product for Realtime ---
    const [activeProduct, setActiveProduct] = useState<any>(null);



    // --- Auto-Refresh on Focus ---
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

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
                        setActiveProduct(data.product); // Store for Realtime

                        // SMART SYNC: Only overwrite Local (Optimistic) if Cloud has data.
                        // This prevents "flashing" to empty if the cloud fetch races or returns partials.
                        if (Object.keys(data.monthlyDemand || {}).length > 0) {
                            setMonthlyDemand(prev => ({ ...data.monthlyDemand, ...prev }));
                        }
                        if (Object.keys(data.monthlyProductionActuals || {}).length > 0) {
                            setMonthlyProductionActuals(prev => ({ ...data.monthlyProductionActuals, ...prev }));
                        }
                        if (Object.keys(data.monthlyInbound || {}).length > 0) {
                            setMonthlyInbound(prev => ({ ...data.monthlyInbound, ...prev }));
                        }
                        if (Object.keys(data.truckManifest || {}).length > 0) {
                            setTruckManifest(prev => ({ ...data.truckManifest, ...prev }));
                        }

                        // Update Settings Context
                        // FIX: Do not overwrite Master Data with stale Scenario Data
                        // if (data.productionRate) updateBottleDefinition(selectedSize, 'productionRate', data.productionRate);
                        setDowntimeHours(data.downtimeHours);
                        setIsAutoReplenish(data.isAutoReplenish);


                        // TIMESTAMP CHECK: Only accept Cloud Snapshot if it's NEWER or SAME as Local.
                        if (data.inventoryAnchor) {
                            setInventoryAnchor(prev => {
                                // If Local is Newer OR Same Day, Keep Local. (User is "Head" of current day)
                                if (prev?.date && data.inventoryAnchor?.date && new Date(prev.date) >= new Date(data.inventoryAnchor.date)) {
                                    return prev;
                                }
                                return data.inventoryAnchor || prev; // Fallback to prev (or null default) if cloud is unexpectedly null
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
                                if (Object.keys(retry.monthlyInbound || {}).length > 0) {
                                    setMonthlyInbound(prev => ({ ...retry.monthlyInbound, ...prev }));
                                }
                                if (Object.keys(retry.truckManifest || {}).length > 0) {
                                    setTruckManifest(prev => ({ ...retry.truckManifest, ...prev }));
                                }

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

    // --- REALTIME SYNC (The "No Shortcuts" Solution) ---
    // --- REALTIME SYNC (The "No Shortcuts" Solution) ---
    useRealtimeSubscription({
        table: 'planning_entries',
        filter: activeProduct ? `product_id=eq.${activeProduct.id}` : undefined,
        enabled: !!activeProduct?.id,
        // enabled: true,
        onDataChange: (payload: any) => {
            const { eventType, new: newRec } = payload;

            // Handle DELETES: (Optional, skipping to avoid complex ID mapping for now)
            if (eventType === 'DELETE') return;

            const date = newRec.date;
            const val = Number(newRec.value);

            if (newRec.entry_type === 'demand_plan') {
                setMonthlyDemand(prev => ({ ...prev, [date]: val }));
            } else if (newRec.entry_type === 'production_actual') {
                setMonthlyProductionActuals(prev => ({ ...prev, [date]: val }));
            } else if (newRec.entry_type === 'inbound_trucks') {
                setMonthlyInbound(prev => ({ ...prev, [date]: val }));
            }
        }
    });

    useRealtimeSubscription({
        table: 'inventory_snapshots',
        filter: activeProduct ? `product_id=eq.${activeProduct.id}` : undefined,
        enabled: !!activeProduct?.id,
        onDataChange: (payload: any) => {
            const { eventType, new: newRec } = payload;
            if (eventType === 'DELETE') return;

            const val = Number(newRec.quantity_pallets);
            const date = newRec.date;

            // TODO: In the future, snapshots are dated. 
            // For now, the app seems to treat 'yardInventory' as a single "current" value or map.
            // Based on logs, yardInventory is just a number in some places, but let's see how it's used.
            // Actually, looking at the return types: `setYardInventory` updates a State which is likely a Map or single value.
            // Let's assume it's a map like others:
            if (newRec.location === 'yard') {
                setYardInventory(prev => ({ ...prev, count: val, date: date || prev.date }));
            } else if (newRec.location === 'floor') {
                // Floor stock is usually 'currentInventoryPallets' used as an anchor.
                setCurrentInventoryPallets(val);
                // Also update the anchor object if needed
                setInventoryAnchor(prev => ({ ...prev, count: val, date: date || prev.date }));
            }
        }
    });

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
