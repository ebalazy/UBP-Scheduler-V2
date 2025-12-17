import { useCallback } from 'react';
import { supabase } from '../services/supabase/client';
import * as ProductService from '../services/supabase/products';
import * as PlanningService from '../services/supabase/planning';
import * as ProcurementService from '../services/supabase/procurement';
import * as ProfileService from '../services/supabase/profiles';
import { PlanningEntry } from '../services/supabase/planning';

// Type Definitions
type User = { id: string };
type BottleSize = string;

interface PlanningEntryInsert {
    product_id: string;
    user_id: string;
    date: string;
    entry_type: string;
    value: number;
}

interface MRPStateData {
    product: any;
    monthlyDemand: Record<string, number>;
    monthlyInbound: Record<string, number>;
    monthlyProductionActuals: Record<string, number>;
    productionRate: number;
    downtimeHours: number;
    isAutoReplenish: boolean;
    inventoryAnchor: { date: string | null; count: number } | null;
    yardInventory: { date: string | null; count: number };
    truckManifest: Record<string, any[]>;
}

/**
 * Hook to manage data synchronization between LocalStorage and Supabase.
 * Handles migration from localStorage and real-time persistence.
 */
export const useSupabaseSync = () => {

    /**
     * MIGRATION: Reads all localStorage keys and uploads them.
     */
    const migrateLocalStorage = useCallback(async (user: User | null, bottleSizes: BottleSize[]) => {
        if (!user) return { success: false, error: 'No user' };

        try {
            for (const sku of bottleSizes) {
                const productId = await ProductService.ensureProduct(user.id, sku);

                const rate = localStorage.getItem(`mrp_${sku}_productionRate`);
                const downtime = localStorage.getItem(`mrp_${sku}_downtimeHours`);
                const isAuto = localStorage.getItem(`mrp_${sku}_isAutoReplenish`);

                if (rate || downtime || isAuto) {
                    await PlanningService.saveProductionSetting(productId, 'production_rate', rate ? Number(rate) : null);
                    await PlanningService.saveProductionSetting(productId, 'downtime_hours', downtime ? Number(downtime) : null);
                    await PlanningService.saveProductionSetting(productId, 'is_auto_replenish', isAuto === 'true');
                }

                const types = [
                    { key: 'monthlyDemand', type: 'demand_plan' },
                    { key: 'monthlyInbound', type: 'inbound_trucks' },
                    { key: 'monthlyProductionActuals', type: 'production_actual' }
                ];

                const entriesToInsert: PlanningEntryInsert[] = [];

                for (const { key, type } of types) {
                    const saved = localStorage.getItem(`mrp_${sku}_${key}`);
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            Object.entries(parsed).forEach(([date, value]) => {
                                entriesToInsert.push({
                                    product_id: productId,
                                    user_id: user.id,
                                    date: date,
                                    entry_type: type,
                                    value: Number(value)
                                });
                            });
                        } catch (e) { }
                    }
                }

                if (entriesToInsert.length > 0) {
                    await PlanningService.batchUpsertPlanningEntries(entriesToInsert as unknown as PlanningEntry[]);
                }

                const anchor = localStorage.getItem(`mrp_${sku}_inventoryAnchor`); // fixed space
                if (anchor) {
                    try {
                        const parsed = JSON.parse(anchor);
                        await PlanningService.saveInventorySnapshot(productId, user.id, parsed.date, Number(parsed.count), 'floor');
                    } catch (e) { }
                }
            }
            return { success: true };
        } catch (err) {
            console.error("Migration Failed:", err);
            return { success: false, error: err };
        }
    }, []);

    /**
     * Loads all MRP state for a specific SKU.
     */
    const fetchMRPState = useCallback(async (userId: string, skuName: string): Promise<MRPStateData | null> => {
        console.log(`[SupabaseSync] Fetching MRP State for User: ${userId}, SKU: ${skuName}`);
        const product = await ProductService.getProductByName(userId, skuName);
        if (!product) {
            console.warn(`[SupabaseSync] Product not found: ${skuName}`);
            return null;
        }

        console.log(`[SupabaseSync] Product Found: ${product.id}. Fetching Details...`);
        const { entries, settings, snapshotFloor, snapshotYard } = await PlanningService.fetchPlanningDetails(product.id);

        console.log(`[SupabaseSync] Entries fetched: ${entries?.length || 0}`);

        const monthlyDemand: Record<string, number> = {};
        const monthlyInbound: Record<string, number> = {};
        const monthlyProductionActuals: Record<string, number> = {};
        const truckManifest: Record<string, any[]> = {};

        entries?.forEach((row: any) => {
            const val = Number(row.value);
            if (row.entry_type === 'demand_plan') monthlyDemand[row.date] = val;
            if (row.entry_type === 'inbound_trucks') monthlyInbound[row.date] = val;
            if (row.entry_type === 'production_actual') monthlyProductionActuals[row.date] = val;
            if (row.entry_type === 'truck_manifest_json') {
                truckManifest[row.date] = row.meta_json || [];
            }
        });

        const inventoryAnchor = snapshotFloor ? {
            date: snapshotFloor.date,
            count: Number(snapshotFloor.quantity_pallets)
        } : null;

        const yardInventory = snapshotYard ? {
            count: Number(snapshotYard.quantity_pallets),
            date: snapshotYard.date
        } : { count: 0, date: null };

        return {
            product,
            monthlyDemand,
            monthlyInbound,
            monthlyProductionActuals,
            productionRate: settings?.production_rate || 5000,
            downtimeHours: settings?.downtime_hours || 0,
            isAutoReplenish: settings?.is_auto_replenish !== false, // Default true if null
            inventoryAnchor,
            yardInventory,
            truckManifest
        };
    }, []);

    const savePlanningEntry = useCallback(async (userId: string, skuName: string, date: string, type: string, value: number | any[]) => {
        const productId = await ProductService.ensureProduct(userId, skuName);

        let numericValue: number | null = typeof value === 'number' ? value : null;
        let metaJson = null;

        if (type === 'truck_manifest_json') {
            if (Array.isArray(value)) {
                numericValue = value.length;
                metaJson = value;
            } else {
                numericValue = Number(value);
            }
        } else {
            numericValue = Number(value);
        }

        await PlanningService.upsertPlanningEntry(productId, userId, date, type, numericValue, metaJson);
    }, []);

    const saveProductionSetting = useCallback(async (userId: string, skuName: string, field: string, value: any) => {
        const productId = await ProductService.ensureProduct(userId, skuName);
        await PlanningService.saveProductionSetting(productId, field, value);
    }, []);

    const saveInventorySnapshot = useCallback(async (userId: string, skuName: string, date: string, count: number, location = 'floor') => {
        const productId = await ProductService.ensureProduct(userId, skuName);
        // console.log(`Saving Snapshot (${location}):`, count, date);
        await PlanningService.saveInventorySnapshot(productId, userId, date, count, location as 'floor' | 'yard');
    }, []);

    const fetchUserProfile = useCallback(async (userId: string) => {
        return await ProfileService.getUserProfile(userId);
    }, []);

    const saveUserProfile = useCallback(async (userId: string, updates: any) => {
        await ProfileService.upsertUserProfile(userId, updates);
    }, []);

    const uploadLocalData = useCallback(async (user: User | null, bottleSizes: BottleSize[], userRole = 'viewer') => {
        if (!user) return;

        // UX CHECK: Only Admins and Planners should attempt this. 
        // SECURITY NOTE: This check is for UI convenience only. 
        // Real security MUST be enforced by Row Level Security (RLS) on the 'products' table in Supabase.
        if (!['admin', 'planner'].includes(userRole)) {
            console.warn("Upload skipped: insufficient role (client-side check). RLS would likely reject this.");
            return;
        }

        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        if (error) {
            console.error("Migration Check Failed:", error);
            return;
        }

        if (count === 0) {
            await migrateLocalStorage(user, bottleSizes);
        }
    }, [migrateLocalStorage]);


    const saveProcurementEntry = useCallback(async (order: any) => {
        if (!order.po) return;
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        await ProcurementService.upsertProcurementOrder(order, user.id);
    }, []);

    const deleteProcurementEntry = useCallback(async (poNumber: string) => {
        await ProcurementService.deleteProcurementOrder(poNumber);
    }, []);

    const fetchProcurementData = useCallback(async () => {
        const data = await ProcurementService.fetchProcurementOrders();

        const manifest: Record<string, { items: any[] }> = {};
        data.forEach((row: any) => {
            if (!manifest[row.date]) manifest[row.date] = { items: [] };
            manifest[row.date].items.push({
                id: row.id,
                po: row.po_number,
                qty: Number(row.quantity),
                sku: row.sku || '',
                supplier: row.supplier,
                status: row.status,
                date: row.date,
                time: row.delivery_time || '',
                carrier: row.carrier || '',
                palletStats: row.meta_data ? row.meta_data.palletStats : undefined // Added mapping for palletStats
            });
        });
        return manifest;
    }, []);

    return {
        supabase,
        fetchMRPState,
        savePlanningEntry,
        saveProductionSetting,
        saveInventorySnapshot,
        migrateLocalStorage,
        uploadLocalData,
        fetchUserProfile,
        saveUserProfile,
        saveProcurementEntry,
        deleteProcurementEntry,
        fetchProcurementData
    };
};
