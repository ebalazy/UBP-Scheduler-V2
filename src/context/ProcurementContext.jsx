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

        // Cloud Sync: This is tricky. 'items' is the absolute list for that day.
        // But our Sync is per-PO upsert.
        // If an item was REMOVED from 'items', we need to delete it from Cloud.
        // Strategy: We can't easily diff here without reading old state.
        // Better Strategy: The calling component (ScheduleManager) calls distinct 'add' or 'delete' actions?
        // Ideally yes. But for now 'updateDailyManifest' is used for everything.
        // Let's stick to LocalStorage for full state, and use 'add/delete' specific hooks?
        // Actually, let's just loop and upsert 'items'. Deletions are hard.
        // Wait, 'ScheduleManager' calls 'updateDailyManifest' after filter.
        // Let's rely on the components to call 'saveProcurementEntry' separately?
        // No, Context should handle it.

        // IMPROVEMENT: We need explicit 'removeOrder' action in Context to handle Cloud Deletes.
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
