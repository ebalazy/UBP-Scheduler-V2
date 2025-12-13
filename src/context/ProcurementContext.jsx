import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

const ProcurementContext = createContext();

export function ProcurementProvider({ children }) {
    const { user } = useAuth();
    // const { fetchProcurementData, saveProcurementEntry } = useSupabaseSync(); // Future integration

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
    };

    const addOrdersBulk = (orders) => {
        // orders = [{ date, po, qty, ... }]
        setPoManifest(prev => {
            const next = { ...prev };
            orders.forEach(order => {
                if (!next[order.date]) next[order.date] = { items: [] };
                // Prevent duplicates? For now, just append
                next[order.date].items.push(order);
            });
            return next;
        });
    };

    const clearManifest = () => setPoManifest({});

    const value = {
        poManifest,
        updateDailyManifest,
        addOrdersBulk,
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
