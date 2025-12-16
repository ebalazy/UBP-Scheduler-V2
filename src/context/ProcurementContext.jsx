import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

const ProcurementContext = createContext();

import { useSettings } from './SettingsContext';
import { useProducts } from './ProductsContext';
import { calculateDeliveryTime } from '../utils/schedulerUtils';

export function ProcurementProvider({ children }) {
    const { user } = useAuth();
    const { fetchProcurementData, saveProcurementEntry, deleteProcurementEntry } = useSupabaseSync();
    // Removed bottleDefinitions from Settings
    const { schedulerSettings, activeSku } = useSettings();
    const { getProductSpecs } = useProducts();

    // State: Manifest of POs keyed by Date (YYYY-MM-DD)
    // Structure: { "2023-12-15": { items: [ { id, po, qty, supplier, status } ] } }
    const [poManifest, setPoManifest] = useState(() => {
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

    // Actions
    const updateDailyManifest = (date, items) => {
        setPoManifest(prev => ({
            ...prev,
            [date]: { items } // Replace items for that day
        }));

        if (user) {
            // Cloud Sync: Persist each item
            try {
                items.forEach(item => {
                    saveProcurementEntry(item).catch(err => console.error("Cloud Save Failed for Item:", item, err));
                });
            } catch (err) {
                console.error("Error initiating cloud sync:", err);
            }
        }
    };

    const addOrdersBulk = (orders) => {
        // orders = [{ date, po, qty, ... }]
        setPoManifest(prev => {
            const next = { ...prev };

            // Group new orders by Date to handle indexing correctly
            const ordersByDate = orders.reduce((acc, order) => {
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
                        const sku = order.sku || activeSku; // Fallback to activeSku if order missing it? Or just use what we have.
                        // Wait, if order.sku is missing, we might not find definition.
                        // Assuming 'activeSku' from context might be relevant context for the *current view*, but bulk import might be mixed.
                        // Let's try order.sku first.
                        // Use Global Products Context (DB Source)
                        const def = getProductSpecs(sku);

                        // Default Scheduling Params
                        const start = schedulerSettings?.shiftStartTime || '00:00';
                        // Use def if available, else defaults? 
                        // If no def, we can't really calculate duration properly. 
                        // We could default to '00:00' or '' if we can't calculate.

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

            // Trigger Side-Effect Cloud Sync (Must be done outside strictly pure reducer? 
            // Hooks logic usually allows side effects in generic functions, but setState callback should be pure-ish.
            // However, we need 'next' state to be accurate. 
            // Ideally we do this in a useEffect or after setState, but we don't have 'next' there easily.
            // We'll iterate the ORIGINAL 'orders' input which we mutated (order.time was added to object ref).
            // Yes, dayOrders.forEach mutated the order objects in the 'orders' array.
            if (user) {
                orders.forEach(order => {
                    saveProcurementEntry(order).catch(err => console.error("Cloud Sync Error", err));
                });
            }

            return next;
        });
    };

    const removeOrder = (date, orderId, poNumber) => {
        setPoManifest(prev => {
            const next = { ...prev };
            if (next[date]) {
                // Fix: Only filter by ID. PO check was causing undefined !== undefined issues.
                next[date].items = next[date].items.filter(i => i.id !== orderId);
            }
            return next;
        });
        if (user && poNumber) {
            deleteProcurementEntry(poNumber);
        }
    };

    const updateOrder = (date, updatedOrder) => {
        setPoManifest(prev => {
            const next = { ...prev };
            if (next[date]?.items) {
                next[date].items = next[date].items.map(i => i.id === updatedOrder.id ? updatedOrder : i);
            }
            return next;
        });
        if (user) {
            saveProcurementEntry(updatedOrder);
        }
    };

    const deleteOrdersBulk = (ordersToDelete) => {
        // ordersToDelete = Array of { date, id, po }
        setPoManifest(prev => {
            const next = { ...prev };
            ordersToDelete.forEach(o => {
                if (next[o.date]?.items) {
                    next[o.date].items = next[o.date].items.filter(i => i.id !== o.id);
                    // Cleanup empty dates? optional
                }
            });
            return next;
        });

        if (user) {
            // Batch delete if multiple? Or loop. 
            // SupabaseSync doesn't have batch delete yet, but we can loop.
            ordersToDelete.forEach(o => {
                if (o.po) deleteProcurementEntry(o.po);
            });
        }
    };

    const moveOrder = (oldDate, newDate, order) => {
        // 1. Remove from Old Date
        setPoManifest(prev => {
            const next = { ...prev };
            // Remove from old
            if (next[oldDate]?.items) {
                next[oldDate].items = next[oldDate].items.filter(i => i.id !== order.id);
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
            // Delete old entry (if PO # matches)
            // Ideally we just upsert with new date if the DB supports it, 
            // but SupabaseSync uses PO as key. If PO is same, upsert overwrites.
            // Wait, does 'saveProcurementEntry' handle date change? 
            // Yes, standard upsert on (user_id, po_number).
            // So we just save the new one.
            const movedOrder = { ...order, date: newDate };
            saveProcurementEntry(movedOrder);
        }
    };

    const bulkUpdateOrders = (updates) => {
        // updates: Array of modified order objects { ...order, date: 'NEW' }
        setPoManifest(prev => {
            const next = { ...prev };

            updates.forEach(updatedOrder => {
                // We don't know the OLD date easily unless passed, 
                // OR we have to scan the manifest to find where this ID lives currently.
                // Scanning is inefficient but safest if we only have the new object.

                let oldDate = null;
                // Try to find the order in the current manifest to check if date changed
                // (Optimization: We could trust the caller to pass { oldDate, newOrder }, but let's be robust)
                for (const [d, data] of Object.entries(next)) {
                    if (data.items.some(i => i.id === updatedOrder.id)) {
                        oldDate = d;
                        break;
                    }
                    if (data.items.some(i => i.po === updatedOrder.po)) { // Fallback ID/PO check
                        oldDate = d;
                        break;
                    }
                }

                const newDate = updatedOrder.date;

                if (oldDate && oldDate !== newDate) {
                    // MOVE LOGIC
                    // 1. Remove from Old
                    if (next[oldDate]?.items) {
                        next[oldDate].items = next[oldDate].items.filter(i => i.id !== updatedOrder.id);
                        if (next[oldDate].items.length === 0) delete next[oldDate]; // Clean
                    }
                    // 2. Add to New
                    if (!next[newDate]) next[newDate] = { items: [] };
                    next[newDate].items.push(updatedOrder);

                } else {
                    // UPDATE IN PLACE (Same Date)
                    // If oldDate found, use it (it equals newDate). 
                    // If not found, maybe new insert? (Assume insert if date given)
                    const targetDate = oldDate || newDate;
                    if (next[targetDate]) {
                        next[targetDate].items = next[targetDate].items.map(i => i.id === updatedOrder.id ? updatedOrder : i);
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
            // Persist all
            updates.forEach(order => saveProcurementEntry(order));
        }
    };

    const clearManifest = () => setPoManifest({});

    // Initialize from Cloud
    useEffect(() => {
        if (user) {
            fetchProcurementData().then(data => {
                if (data && Object.keys(data).length > 0) {
                    setPoManifest(data);
                }
            });
        }
    }, [user]);

    const value = {
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
