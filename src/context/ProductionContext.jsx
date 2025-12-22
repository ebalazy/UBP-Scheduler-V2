import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase/client';
import {
    fetchRunsByDateRange,
    upsertRun,
    deleteRun as serviceDeleteRun,
    TABLE_NAME
} from '../services/supabase/production';
import { getLocalISOString } from '../utils/dateUtils';

const ProductionContext = createContext(null);

export function ProductionProvider({ children }) {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initial Load & Realtime Sync
    useEffect(() => {
        const loadRuns = async () => {
            setLoading(true);
            try {
                // Load 60 days of data (past week + future)
                const today = getLocalISOString();
                const data = await fetchRunsByDateRange(today, 60);

                // Map RAW DB rows to App Model
                const mapped = data.map(mapDbToApp);
                setRuns(mapped);
            } catch (err) {
                console.error("Failed to load production runs:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadRuns();

        // Realtime Subscription
        const channel = supabase
            .channel('public:production_runs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: TABLE_NAME },
                (payload) => {
                    console.log('Realtime Change detected:', payload);
                    // Reload to ensure consistency (simplest path for now)
                    loadRuns();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addRun = async (run) => {
        // Optimistic Update
        const tempId = run.id || `temp-${Date.now()}`;
        const runWithId = { ...run, id: tempId };

        setRuns(prev => [...prev, runWithId]);

        try {
            const savedRun = await upsertRun(runWithId);
            // Replace temp with real
            setRuns(prev => prev.map(r => r.id === tempId ? savedRun : r));
        } catch (err) {
            console.error(err);
            // Revert
            setRuns(prev => prev.filter(r => r.id !== tempId));
            alert("Failed to save run!");
        }
    };

    const updateRun = async (updatedRun) => {
        // Optimistic
        setRuns(prev => prev.map(r => r.id === updatedRun.id ? updatedRun : r));

        try {
            await upsertRun(updatedRun);
        } catch (err) {
            console.error(err);
            // Revert (hard to do without history, just alert for now)
            alert("Failed to update run!");
        }
    };

    const deleteRun = async (runId) => {
        const backup = runs.find(r => r.id === runId);
        setRuns(prev => prev.filter(r => r.id !== runId));

        try {
            await serviceDeleteRun(runId);
        } catch (err) {
            console.error(err);
            if (backup) setRuns(prev => [...prev, backup]);
            alert("Failed to delete run!");
        }
    };

    // Aggregation for MRP
    const getDailyProductionSum = (dateStr, sku) => {
        return runs
            .filter(r => {
                const runDate = r.startTime.split('T')[0];
                return runDate === dateStr && (sku === 'ALL' || r.sku === sku);
            })
            .reduce((sum, r) => sum + (r.targetCases || 0), 0);
    };

    const value = {
        runs,
        loading,
        error,
        addRun,
        updateRun,
        deleteRun,
        getDailyProductionSum
    };

    return (
        <ProductionContext.Provider value={value}>
            {children}
        </ProductionContext.Provider>
    );
}

// Mapper (Helper) - Color is applied by consuming components via ProductsContext
function mapDbToApp(dbRecord) {
    return {
        id: dbRecord.id,
        sku: dbRecord.sku,
        lineId: dbRecord.line_id,
        startTime: dbRecord.start_time,
        durationHours: dbRecord.duration_hours,
        targetCases: dbRecord.target_cases,
        status: dbRecord.status
        // Note: color is looked up from ProductsContext by SKU name at render time
    };
}



export function useProduction() {
    const context = useContext(ProductionContext);
    if (!context) {
        throw new Error('useProduction must be used within a ProductionProvider');
    }
    return context;
}
