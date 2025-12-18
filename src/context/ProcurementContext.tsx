import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';
import { useSettings } from './SettingsContext';
import { useProducts } from './ProductsContext';
import { calculateDeliveryTime } from '../utils/schedulerUtils';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

// --- Types ---
export interface ProcurementOrder {
    id: string;
    po: string;
    date: string; // YYYY-MM-DD
    qty: number;
    supplier?: string;
    status: string;
    sku?: string;
    time?: string; // HH:mm
    source?: 'manual' | 'sap';
    // Add other fields as needed
    [key: string]: any;
}

export interface DayManifest {
    items: ProcurementOrder[];
}

export interface ManifestMap {
    [date: string]: DayManifest;
}

interface ProcurementContextType {
    poManifest: ManifestMap;
    updateDailyManifest: (date: string, items: ProcurementOrder[]) => void;
    addOrdersBulk: (orders: ProcurementOrder[]) => void;
    removeOrder: (date: string, orderId: string, poNumber?: string) => void;
    updateOrder: (date: string, updatedOrder: ProcurementOrder) => void;
    deleteOrdersBulk: (ordersToDelete: { date: string, id: string, po?: string }[]) => void;
    moveOrder: (oldDate: string, newDate: string, order: ProcurementOrder) => void;
    bulkUpdateOrders: (updates: ProcurementOrder[]) => void;
    clearManifest: () => void;
}

const ProcurementContext = createContext<ProcurementContextType | undefined>(undefined);

interface ProcurementProviderProps {
    children: ReactNode;
}

export function ProcurementProvider({ children }: ProcurementProviderProps) {
    const { user } = useAuth();
    const { fetchProcurementData, saveProcurementEntry, deleteProcurementEntry } = useSupabaseSync();
    // Removed bottleDefinitions from Settings
    const { schedulerSettings, activeSku } = useSettings();
    const { getProductSpecs } = useProducts();

    // State: Manifest of POs keyed by Date (YYYY-MM-DD)
    const [poManifest, setPoManifest] = useState<ManifestMap>(() => {
        try {
            const saved = localStorage.getItem('poManifest');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    // Persist to LocalStorage
    useEffect(() => {
        localStorage.setItem('poManifest', JSON.stringify(poManifest));
    }, [poManifest]);

    // --- REALTIME SYNC ---
    useRealtimeSubscription({
        table: 'procurement_orders',
        event: '*', // Listen to everything
        enabled: !!user,
        onDataChange: (payload: any) => {
            const { eventType, new: newRec, old: oldRec } = payload;
            // console.log("Realtime PO Update:", eventType, newRec, oldRec);

            if (eventType === 'DELETE') {
                // Improved DELETE handling: Check both ID and PO Number
                const deleteId = oldRec.id;
                const deletePo = oldRec.po_number; // Might be null if not REPLICA IDENTITY FULL

                if (!deleteId && !deletePo) return;

                setPoManifest(prev => {
                    const next = { ...prev };
                    let foundDate: string | null = null;
                    let foundItem: ProcurementOrder | null = null;

                    // Scan to find the item
                    for (const [date, data] of Object.entries(next)) {
                        const item = data.items.find((i: ProcurementOrder) =>
                            (deleteId && i.id === deleteId) || (deletePo && i.po === deletePo)
                        );
                        if (item) {
                            foundDate = date;
                            foundItem = item;
                            break;
                        }
                    }

                    if (foundDate && foundItem) {
                        next[foundDate].items = next[foundDate].items.filter((i: ProcurementOrder) => i !== foundItem);
                        if (next[foundDate].items.length === 0) delete next[foundDate];
                    }
                    return next;
                });
                return;
            }

            // INSERT / UPDATE
            const newDate = newRec.date;
            // Map Snake Case DB to Camel Case App
            // Assuming DB: po_number, sku, quantity, delivery_time, supplier, status...
            // Logic: fetchProcurementData usually maps this. We should replicate that mapping.
            // But for now, let's assume 'newRec' needs mapping.

            const mappedOrder: ProcurementOrder = {
                id: newRec.id || crypto.randomUUID(), // Ensure ID
                po: newRec.po_number,
                date: newRec.date,
                qty: Number(newRec.quantity), // DB numeric
                status: newRec.status,
                supplier: newRec.supplier,
                sku: newRec.sku,
                time: newRec.delivery_time,
                carrier: newRec.carrier, // Added mapping for carrier
                palletStats: newRec.meta_data ? newRec.meta_data.palletStats : undefined
            };

            setPoManifest(prev => {
                const next = { ...prev };

                // Check if this PO already exists (maybe under a different date if moved?)
                // If it's an UPDATE, we might need to remove it from the old date.
                // But realtime payload 'old' property is often minimal.
                // Strategy: 
                // 1. Remove any existing instance of this PO (by PO number).
                // 2. Add the new one to the correct date.

                // 1. Remove existing
                for (const [d, data] of Object.entries(next)) {
                    // Filter out SAME PO Number
                    const kept = data.items.filter((i: ProcurementOrder) => i.po !== mappedOrder.po);
                    if (kept.length !== data.items.length) {
                        next[d] = { items: kept };
                        if (kept.length === 0) delete next[d];
                    }
                }

                // 2. Add New
                if (!next[newDate]) next[newDate] = { items: [] };

                // Check uniqueness in target day (redundant after remove, but safe)
                // Just push it? Or Replace?
                next[newDate].items.push(mappedOrder);

                return next;
            });
        }
    });

    // Actions
    const updateDailyManifest = (date: string, items: ProcurementOrder[]) => {
        setPoManifest(prev => ({
            ...prev,
            [date]: { items } // Replace items for that day
        }));

        if (user) {
            // Cloud Sync: Persist each item
            try {
                items.forEach(item => {
                    saveProcurementEntry(item).catch((err: any) => console.error("Cloud Save Failed for Item:", item, err));
                });
            } catch (err) {
                console.error("Error initiating cloud sync:", err);
            }
        }
    };

    const addOrdersBulk = (orders: ProcurementOrder[]) => {
        // orders = [{ date, po, qty, ... }]
        setPoManifest(prev => {
            const next = { ...prev };

            // Group new orders by Date to handle indexing correctly
            const ordersByDate = orders.reduce<{ [key: string]: ProcurementOrder[] }>((acc, order) => {
                if (!acc[order.date]) acc[order.date] = [];
                acc[order.date].push(order);
                return acc;
            }, {});

            Object.entries(ordersByDate).forEach(([date, dayOrders]) => {
                const existingItems = next[date]?.items || [];
                let startIndex = existingItems.length;

                dayOrders.forEach((order, i) => {
                    // Ensure ID exists
                    if (!order.id) order.id = crypto.randomUUID();

                    // --- Auto-Schedule Logic (Products Context) ---
                    // Only apply if time is NOT already set (don't overwrite manual imports)
                    if (!order.time) {
                        const sku = order.sku || activeSku;
                        const def = getProductSpecs(sku);

                        // Default Scheduling Params
                        const start = schedulerSettings?.shiftStartTime || '00:00';

                        if (def && def.productionRate > 0) {
                            const bottlesPerTruck = def.bottlesPerTruck || 20000;
                            const rate = def.productionRate; // CPH or BPH?
                            const bpc = def.bottlesPerCase || 1;

                            // Calculate
                            // Index = existing + i
                            order.time = calculateDeliveryTime(startIndex + i, start, bottlesPerTruck, rate, bpc);
                        }
                    }

                    // Append
                    if (!next[date]) next[date] = { items: [] };
                    next[date].items.push(order);
                });
            });

            if (user) {
                orders.forEach(order => {
                    saveProcurementEntry(order).catch((err: any) => console.error("Cloud Sync Error", err));
                });
            }

            return next;
        });
    };

    const removeOrder = (date: string, orderId: string, poNumber?: string) => {
        setPoManifest(prev => {
            const next = { ...prev };
            if (next[date]) {
                next[date].items = next[date].items.filter((i: ProcurementOrder) => i.id !== orderId);
            }
            return next;
        });
        if (user && poNumber) {
            deleteProcurementEntry(poNumber);
        }
    };

    const updateOrder = (date: string, updatedOrder: ProcurementOrder) => {
        setPoManifest(prev => {
            const next = { ...prev };
            if (next[date]?.items) {
                next[date].items = next[date].items.map((i: ProcurementOrder) => i.id === updatedOrder.id ? updatedOrder : i);
            }
            return next;
        });
        if (user) {
            saveProcurementEntry(updatedOrder);
        }
    };

    const deleteOrdersBulk = (ordersToDelete: { date: string, id: string, po?: string }[]) => {
        // ordersToDelete = Array of { date, id, po }
        setPoManifest(prev => {
            const next = { ...prev };
            ordersToDelete.forEach(o => {
                if (next[o.date]?.items) {
                    next[o.date].items = next[o.date].items.filter((i: ProcurementOrder) => i.id !== o.id);
                    // Cleanup empty dates? optional
                }
            });
            return next;
        });

        if (user) {
            ordersToDelete.forEach(o => {
                if (o.po) deleteProcurementEntry(o.po);
            });
        }
    };

    const moveOrder = (oldDate: string, newDate: string, order: ProcurementOrder) => {
        // 1. Remove from Old Date
        setPoManifest(prev => {
            const next = { ...prev };
            // Remove from old
            if (next[oldDate]?.items) {
                next[oldDate].items = next[oldDate].items.filter((i: ProcurementOrder) => i.id !== order.id);
            }
            // Add to new
            const existing = next[newDate]?.items || [];
            // Update order date property itself
            const movedOrder = { ...order, date: newDate };

            next[newDate] = {
                items: [...existing, movedOrder]
            };
            return next;
        });

        // 2. Sync to Cloud
        if (user) {
            const movedOrder = { ...order, date: newDate };
            saveProcurementEntry(movedOrder);
        }
    };

    const bulkUpdateOrders = (updates: ProcurementOrder[]) => {
        // updates: Array of modified order objects { ...order, date: 'NEW' }
        setPoManifest(prev => {
            const next = { ...prev };

            updates.forEach(updatedOrder => {
                let oldDate: string | null = null;
                // Try to find the order in the current manifest to check if date changed
                for (const [d, data] of Object.entries(next)) {
                    if (data.items.some((i: ProcurementOrder) => i.id === updatedOrder.id)) {
                        oldDate = d;
                        break;
                    }
                    if (data.items.some((i: ProcurementOrder) => i.po === updatedOrder.po)) { // Fallback ID/PO check
                        oldDate = d;
                        break;
                    }
                }

                const newDate = updatedOrder.date;

                if (oldDate && oldDate !== newDate) {
                    // MOVE LOGIC
                    // 1. Remove from Old
                    if (next[oldDate]?.items) {
                        next[oldDate].items = next[oldDate].items.filter((i: ProcurementOrder) => i.id !== updatedOrder.id);
                        if (next[oldDate].items.length === 0) delete next[oldDate]; // Clean
                    }
                    // 2. Add to New
                    if (!next[newDate]) next[newDate] = { items: [] };
                    next[newDate].items.push(updatedOrder);

                } else {
                    // UPDATE IN PLACE (Same Date)
                    const targetDate = oldDate || newDate;
                    if (next[targetDate]) {
                        next[targetDate].items = next[targetDate].items.map((i: ProcurementOrder) => i.id === updatedOrder.id ? updatedOrder : i);
                    } else {
                        // Edge case: New Order being added via bulkUpdate? Unlikely but handling it.
                        if (!next[targetDate]) next[targetDate] = { items: [] };
                        next[targetDate].items.push(updatedOrder);
                    }
                }
            });
            return next;
        });

        if (user) {
            updates.forEach(order => saveProcurementEntry(order));
        }
    };

    const clearManifest = () => setPoManifest({});

    // Initialize from Cloud
    useEffect(() => {
        if (user) {
            fetchProcurementData().then((data: ManifestMap) => {
                if (data && Object.keys(data).length > 0) {
                    setPoManifest(data);
                }
            });
        }
    }, [user, fetchProcurementData]);

    const value: ProcurementContextType = {
        poManifest,
        updateDailyManifest,
        addOrdersBulk,
        removeOrder,
        updateOrder,
        deleteOrdersBulk,
        moveOrder,
        bulkUpdateOrders,
        clearManifest
    };

    return <ProcurementContext.Provider value={value}>{children}</ProcurementContext.Provider>;
}

export function useProcurement() {
    const context = useContext(ProcurementContext);
    if (!context) {
        throw new Error('useProcurement must be used within a ProcurementProvider');
    }
    return context;
}
