import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Hook to manage data synchronization between LocalStorage and Supabase.
 * Handles migration from localStorage and real-time persistence.
 */
export const useSupabaseSync = () => {

    // --- Helpers ---

    /**
     * Ensures a product (SKU) exists for the given user.
     * Returns the product ID.
     */
    // --- Helpers ---

    /**
     * Ensures a product (SKU) exists for the given user.
     * Returns the product ID.
     */
    const ensureProduct = useCallback(async (userId, skuName, defaults = {}) => {
        // Check if exists
        const { data: existing, error: fetchError } = await supabase
            .from('products')
            .select('id')
            .eq('user_id', userId)
            .eq('name', skuName)
            .limit(1)
            .maybeSingle();

        if (existing) return existing.id;

        // Create if not
        const { data: created, error: createError } = await supabase
            .from('products')
            .insert({
                user_id: userId,
                name: skuName,
                bottles_per_case: defaults.bottlesPerCase || 12,
                bottles_per_truck: defaults.bottlesPerTruck || 20000,
                cases_per_pallet: defaults.casesPerPallet || 100
            })
            .select('id')
            .single();

        if (createError) {
            console.error("Error creating product:", createError);
            throw createError;
        }
        return created.id;
    }, []);

    /**
     * MIGRATION: Reads all localStorage keys and uploads them.
     */
    const migrateLocalStorage = useCallback(async (user, bottleSizes) => {
        if (!user) return;

        try {
            for (const sku of bottleSizes) {
                const productId = await ensureProduct(user.id, sku);

                const rate = localStorage.getItem(`mrp_${sku}_productionRate`); // fixed space
                const downtime = localStorage.getItem(`mrp_${sku}_downtimeHours`); // fixed space
                const isAuto = localStorage.getItem(`mrp_${sku}_isAutoReplenish`); // fixed space

                if (rate || downtime || isAuto) {
                    await supabase.from('production_settings').upsert({
                        product_id: productId,
                        production_rate: rate ? Number(rate) : null,
                        downtime_hours: downtime ? Number(downtime) : null,
                        is_auto_replenish: isAuto === 'true'
                    });
                }

                const types = [
                    { key: 'monthlyDemand', type: 'demand_plan' },
                    { key: 'monthlyInbound', type: 'inbound_trucks' },
                    { key: 'monthlyProductionActuals', type: 'production_actual' }
                ];

                const entriesToInsert = [];

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
                    const { error } = await supabase.from('planning_entries').upsert(entriesToInsert, { onConflict: 'product_id, date, entry_type' });
                    if (error) console.error("Error migrating entries:", error);
                }

                const anchor = localStorage.getItem(`mrp_${sku}_inventoryAnchor`); // fixed space
                if (anchor) {
                    try {
                        const parsed = JSON.parse(anchor);
                        await supabase.from('inventory_snapshots').insert({
                            product_id: productId,
                            date: parsed.date,
                            location: 'floor',
                            quantity_pallets: Number(parsed.count),
                            is_latest: true
                        });
                    } catch (e) { }
                }
            }
            return { success: true };
        } catch (err) {
            console.error("Migration Failed:", err);
            return { success: false, error: err };
        }
    }, [ensureProduct]);

    /**
     * Loads all MRP state for a specific SKU.
     */
    const fetchMRPState = useCallback(async (userId, skuName) => {
        const { data: product, error: pErr } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId)
            .eq('name', skuName)
            .limit(1)
            .maybeSingle();

        if (pErr || !product) return null;

        const [entries, settings, snapshotsFloor, snapshotsYard] = await Promise.all([
            supabase
                .from('planning_entries')
                .select('date, entry_type, value, meta_json')
                .eq('product_id', product.id),
            supabase
                .from('production_settings')
                .select('*')
                .eq('product_id', product.id)
                .maybeSingle(),
            supabase
                .from('inventory_snapshots')
                .select('*')
                .eq('product_id', product.id)
                .eq('location', 'floor')
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('inventory_snapshots')
                .select('*')
                .eq('product_id', product.id)
                .eq('location', 'yard')
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle()
        ]);

        const monthlyDemand = {};
        const monthlyInbound = {};
        const monthlyProductionActuals = {};
        const truckManifest = {};

        entries.data?.forEach(row => {
            const val = Number(row.value);
            if (row.entry_type === 'demand_plan') monthlyDemand[row.date] = val;
            if (row.entry_type === 'inbound_trucks') monthlyInbound[row.date] = val;
            if (row.entry_type === 'production_actual') monthlyProductionActuals[row.date] = val;
            if (row.entry_type === 'truck_manifest_json') {
                truckManifest[row.date] = row.meta_json || [];
            }
        });

        const inventoryAnchor = snapshotsFloor.data ? {
            date: snapshotsFloor.data.date,
            count: Number(snapshotsFloor.data.quantity_pallets)
        } : null;

        const yardInventory = snapshotsYard.data ? {
            count: Number(snapshotsYard.data.quantity_pallets), // Stored as pallets or load count? 
            // In DB 'quantity_pallets' is the column name, but for Yard we store LOAD COUNT usually.
            // Let's assume we store the raw count value in quantity_pallets column for now, 
            // OR we should be clear. Logic usually expects "Loads".
            // Implementation Decision: Store 'Load Count' in 'quantity_pallets' column for location='yard'.
            date: snapshotsYard.data.date
        } : { count: 0, date: null };

        return {
            product,
            monthlyDemand,
            monthlyInbound,
            monthlyProductionActuals,
            productionRate: settings.data?.production_rate || 5000,
            downtimeHours: settings.data?.downtime_hours || 0,
            isAutoReplenish: settings.data?.is_auto_replenish !== false, // Default true if null
            // Fixed default logic:
            // isAutoReplenish: settings.data?.is_auto_replenish ?? true // better?
            inventoryAnchor,
            yardInventory,
            truckManifest
        };
    }, []);

    const savePlanningEntry = useCallback(async (userId, skuName, date, type, value) => {
        const productId = await ensureProduct(userId, skuName);

        // Check for deletion (null or undefined value)
        if (value === null || value === undefined) {
            const { error } = await supabase
                .from('planning_entries')
                .delete()
                .eq('product_id', productId)
                .eq('date', date)
                .eq('entry_type', type);

            if (error) throw error;
            return;
        }

        const { data: existing } = await supabase
            .from('planning_entries')
            .select('id')
            .eq('product_id', productId)
            .eq('date', date)
            .eq('entry_type', type)
            .maybeSingle();

        let numericValue = value;
        let metaJson = null;

        if (type === 'truck_manifest_json') {
            if (Array.isArray(value)) {
                numericValue = value.length;
                metaJson = value;
            } else {
                numericValue = value;
            }
        }

        if (existing) {
            const { error } = await supabase
                .from('planning_entries')
                .update({
                    value: numericValue,
                    meta_json: metaJson !== null ? metaJson : undefined,
                    user_id: userId
                })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('planning_entries')
                .insert({
                    product_id: productId,
                    user_id: userId,
                    date,
                    entry_type: type,
                    value: numericValue,
                    meta_json: metaJson
                });
            if (error) throw error;
        }
    }, [ensureProduct]);

    const saveProductionSetting = useCallback(async (userId, skuName, field, value) => {
        const productId = await ensureProduct(userId, skuName);
        const { data } = await supabase
            .from('production_settings')
            .select('id')
            .eq('product_id', productId)
            .limit(1);

        const existingId = data && data.length > 0 ? data[0].id : null;
        const update = { product_id: productId, [field]: value };
        if (existingId) update.id = existingId;

        const { error } = await supabase.from('production_settings').upsert(update);
        if (error) console.error("Error saving production setting:", error);
    }, [ensureProduct]);

    const saveInventoryAnchor = useCallback(async (userId, skuName, anchor, location = 'floor') => {
        const productId = await ensureProduct(userId, skuName);
        await supabase.from('inventory_snapshots')
            .update({ is_latest: false })
            .eq('product_id', productId)
            .eq('location', location);

        console.log(`Saving Snapshot (${location}):`, anchor);
        const { error } = await supabase.from('inventory_snapshots').upsert({
            product_id: productId,
            user_id: userId,
            date: anchor.date,
            location: location,
            quantity_pallets: anchor.count
        }, { onConflict: 'product_id, date, location' });

        if (error) console.error(`Snapshot Save Error (${location}):`, error);
        else console.log(`Snapshot Saved (${location})`);
    }, [ensureProduct]);

    const fetchUserProfile = useCallback(async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('lead_time_days, safety_stock_loads, dashboard_layout')
            .eq('id', userId)
            .maybeSingle();
        if (error) console.error("Error fetching profile:", error);
        return data;
    }, []);

    const saveUserProfile = useCallback(async (userId, updates) => {
        const payload = { id: userId, ...updates, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('profiles').upsert(payload);
        if (error) console.error("Error saving profile:", error);
    }, []);

    const uploadLocalData = useCallback(async (user, bottleSizes, userRole = 'viewer') => {
        if (!user) return;
        // PERMISSION CHECK: Only Admins and Planners can upload/migrate data
        if (!['admin', 'planner'].includes(userRole)) return;

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

    // --- ADAPTERS ---
    const toAppModel = useCallback((row) => ({
        id: row.id,
        po: row.po_number,
        qty: Number(row.quantity),
        sku: row.sku || '',
        supplier: row.supplier,
        status: row.status,
        date: row.date,
        time: row.delivery_time || '',
        carrier: row.carrier || ''
    }), []);

    const toDbModel = useCallback((order, userId) => ({
        po_number: order.po,
        quantity: order.qty,
        sku: order.sku,
        supplier: order.supplier,
        carrier: order.carrier,
        status: order.status || 'planned',
        date: order.date,
        delivery_time: order.time,
        user_id: userId
    }), []);

    const saveProcurementEntry = useCallback(async (order) => {
        if (!order.po) return;
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return; // Should we pass user in?

        const payload = {
            po_number: order.po,
            quantity: order.qty,
            sku: order.sku,
            supplier: order.supplier,
            carrier: order.carrier,
            status: order.status || 'planned',
            date: order.date,
            delivery_time: order.time,
            user_id: user.id
        };

        const { data: existing } = await supabase
            .from('procurement_orders')
            .select('id')
            .eq('po_number', order.po)
            .maybeSingle();

        if (existing) {
            await supabase.from('procurement_orders').update(payload).eq('id', existing.id);
        } else {
            await supabase.from('procurement_orders').insert(payload);
        }
    }, []);

    const deleteProcurementEntry = useCallback(async (poNumber) => {
        await supabase.from('procurement_orders').delete().eq('po_number', poNumber);
    }, []);

    const fetchProcurementData = useCallback(async () => {
        const { data, error } = await supabase
            .from('procurement_orders')
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.error("Error fetching procurement:", error);
            return {};
        }

        const manifest = {};
        data.forEach(row => {
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
                carrier: row.carrier || ''
            });
        });
        return manifest;
    }, []);

    return {
        migrateLocalStorage,
        uploadLocalData,
        fetchMRPState,
        fetchUserProfile,
        savePlanningEntry,
        saveProductionSetting,
        saveInventoryAnchor,
        saveUserProfile,
        saveProcurementEntry,
        deleteProcurementEntry,
        fetchProcurementData
    };
};
