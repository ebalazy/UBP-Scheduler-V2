import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

const ProcurementContext = createContext();

export function ProcurementProvider({ children }) {
    const { user } = useAuth();
    const { fetchProcurementData, saveProcurementEntry, deleteProcurementEntry } = useSupabaseSync();

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
            items.forEach(item => {
                saveProcurementEntry(item);
            });
        }
    };

    const addOrdersBulk = (orders) => {
        // orders = [{ date, po, qty, ... }]
        setPoManifest(prev => {
            const next = { ...prev };
            orders.forEach(order => {
                // Ensure ID exists
                if (!order.id) {
                    order.id = crypto.randomUUID();
                }
                const date = order.date;
                const existingItems = next[date]?.items || [];
                next[date] = {
                    items: [...existingItems, order]
                };
                // Sync to Cloud
                if (user) {
                    saveProcurementEntry(order);
                }
            });
            return next;
        });
    };

    const removeOrder = (date, orderId, poNumber) => {
        setPoManifest(prev => {
            const next = { ...prev };
            if (next[date]) {
                next[date].items = next[date].items.filter(i => i.id !== orderId && i.po !== poNumber);
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
