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
    const ensureProduct = async (userId, skuName, defaults = {}) => {
        // Check if exists
        const { data: existing, error: fetchError } = await supabase
            .from('products')
            .select('id')
            .eq('user_id', userId)
            .eq('name', skuName)
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
    };

    /**
     * MIGRATION: Reads all localStorage keys and uploads them.
     * Idempotent-ish (upserts), but expensive. Run only if Supabase is empty-ish.
     */
    const migrateLocalStorage = async (user, bottleSizes) => {
        if (!user) return;
        console.log("Starting Migration for user:", user.email);

        try {
            // 1. Migrate Products & Settings
            // We iterate over known bottle sizes (from global settings) to look for data
            for (const sku of bottleSizes) {
                // Get or Create Product ID
                // We rely on defaults being roughly standard if not found in LS, 
                // but actually we should look for `mrp_${ sku } _specs` in LS if we had it?
                // The current app uses `specs` from hardcoded list mostly, unless edited?
                // Actually `useSettings` provides `bottleSizes` (strings). 
                // The specs (bottlesPerCase) are in `useMRP`'s `SPECS` constant usually or passed in.
                // For migration, we'll just create the name. Refinements can happen later.
                const productId = await ensureProduct(user.id, sku);

                // 2. Migrate Production Settings
                const rate = localStorage.getItem(`mrp_${sku} _productionRate`);
                const downtime = localStorage.getItem(`mrp_${sku} _downtimeHours`);
                const isAuto = localStorage.getItem(`mrp_${sku} _isAutoReplenish`);

                if (rate || downtime || isAuto) {
                    await supabase.from('production_settings').upsert({
                        product_id: productId,
                        production_rate: rate ? Number(rate) : null,
                        downtime_hours: downtime ? Number(downtime) : null,
                        is_auto_replenish: isAuto === 'true'
                    });
                }

                // 3. Migrate Planning Entries (Demand, Inbound, Actuals)
                const types = [
                    { key: 'monthlyDemand', type: 'demand_plan' },
                    { key: 'monthlyInbound', type: 'inbound_trucks' },
                    { key: 'monthlyProductionActuals', type: 'production_actual' }
                ];

                const entriesToInsert = [];

                for (const { key, type } of types) {
                    const saved = localStorage.getItem(`mrp_${sku}_${key} `);
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            // parsed is { "2023-01-01": 100, ... }
                            Object.entries(parsed).forEach(([date, value]) => {
                                // Only migrate non-zero? Or all? Let's do non-zero + explicit zeros
                                if (value !== null && value !== undefined) {
                                    entriesToInsert.push({
                                        product_id: productId,
                                        user_id: user.id,
                                        date: date,
                                        entry_type: type,
                                        value: Number(value)
                                    });
                                }
                            });
                        } catch (e) {
                            console.warn(`Failed to parse ${key} for ${sku}`, e);
                        }
                    }
                }

                if (entriesToInsert.length > 0) {
                    // Batch insert (upsert)
                    const { error } = await supabase.from('planning_entries').upsert(entriesToInsert, { onConflict: 'product_id, date, entry_type' });
                    if (error) console.error("Error migrating entries:", error);
                }

                // 4. Migrate Inventory Anchors
                const anchor = localStorage.getItem(`mrp_${sku} _inventoryAnchor`);
                if (anchor) {
                    try {
                        const parsed = JSON.parse(anchor);
                        //{ date, count }
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

            console.log("Migration Complete");
            return { success: true };

        } catch (err) {
            console.error("Migration Failed:", err);
            return { success: false, error: err };
        }
    };

    /**
     * Loads all MRP state for a specific SKU.
     */
    const fetchMRPState = async (userId, skuName) => {
        // Get Product
        const { data: product, error: pErr } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId)
            .eq('name', skuName)
            .single();

        if (pErr || !product) return null; // New SKU or error

        // Run parallel fetches
        const [entries, settings, snapshots] = await Promise.all([
            // 1. Planning Entries
            supabase
                .from('planning_entries')
                .select('date, entry_type, value')
                .eq('product_id', product.id),

            // 2. Settings
            supabase
                .from('production_settings')
                .select('*')
                .eq('product_id', product.id)
                .maybeSingle(),

            // 3. Snapshots (Latest Floor)
            supabase
                .from('inventory_snapshots')
                .select('*')
                .eq('product_id', product.id)
                .eq('location', 'floor')
                .order('date', { ascending: false }) // Get latest date? Or `updated_at`?
                .limit(1)
        ]);

        // Transform Entries to Objects
        const monthlyDemand = {};
        const monthlyInbound = {};
        const monthlyProductionActuals = {};

        entries.data?.forEach(row => {
            const val = Number(row.value);
            if (row.entry_type === 'demand_plan') monthlyDemand[row.date] = val;
            if (row.entry_type === 'inbound_trucks') monthlyInbound[row.date] = val;
            if (row.entry_type === 'production_actual') monthlyProductionActuals[row.date] = val;
        });

        // Transform Snapshot
        const inventoryAnchor = snapshots.data?.[0] ? {
            date: snapshots.data[0].date,
            count: Number(snapshots.data[0].quantity_pallets)
        } : null;

        return {
            product,
            monthlyDemand,
            monthlyInbound,
            monthlyProductionActuals,
            productionRate: settings.data?.production_rate || 5000,
            downtimeHours: settings.data?.downtime_hours || 0,
            isAutoReplenish: settings.data?.is_auto_replenish || false,
            inventoryAnchor
        };
    };

    /**
     * SAVERS
     */
    const savePlanningEntry = async (userId, skuName, date, type, value) => {
        // We need product ID. Assuming caller manages it or we fetch it? 
        // Fetching every save is slow. Ideally pass productId.
        // For now, fetch to be safe (cached likely by Supabase client? No.)
        // We'll require productId ideally. But `useMRP` works with SkuNames.
        // Let's ensureProduct again (it's fast if exists?).

        // OPTIMIZATION: In a real app, we'd cache the product ID in a context.
        // For now, I'll do a lookup.
        const productId = await ensureProduct(userId, skuName);

        // Upsert
        const { error } = await supabase.from('planning_entries').upsert({
            product_id: productId,
            user_id: userId,
            date: date,
            entry_type: type,
            value: value
        }, { onConflict: 'product_id, date, entry_type' });

        if (error) console.error("Save failed", error);
    };

    const saveProductionSetting = async (userId, skuName, field, value) => {
        const productId = await ensureProduct(userId, skuName);

        // We need to upsert the whole row or patch?
        // Supabase upsert needs PK (product_id).
        // If we only send one field, others might be null if new row?
        // We should probably fetch existing first or send all?
        // 'upsert' works if we don't overwrite others? No, it replaces row if not partial?
        // Postgres `INSERT ... ON CONFLICT DO UPDATE SET ...`
        // Supabase JS `upsert` handles this. We should pass just the PK and the field?
        // If row exists, it updates. If we omit columns, do they stay? 
        // No, standard SQL update doesn't touch omitted columns, but UPSERT (insert) requires all non-nulls.
        // But `production_settings` has defaults?

        // Safer:
        const { data } = await supabase.from('production_settings').select('*').eq('product_id', productId).maybeSingle();
        const existing = data || {};

        const update = { ...existing, product_id: productId, [field]: value };
        await supabase.from('production_settings').upsert(update);
    };

    const saveInventoryAnchor = async (userId, skuName, anchor) => {
        const productId = await ensureProduct(userId, skuName);

        // Anchor is a snapshot. We usually insert a NEW one?
        // Or update the "current" one?
        // Schema says `is_latest` boolean.

        // 1. Unset old is_latest
        await supabase.from('inventory_snapshots')
            .update({ is_latest: false })
            .eq('product_id', productId)
            .eq('location', 'floor');

        // 2. Insert new
        await supabase.from('inventory_snapshots').insert({
            product_id: productId,
            date: anchor.date,
            location: 'floor',
            quantity_pallets: anchor.count,
            is_latest: true
        });
    };

    const fetchUserProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('lead_time_days, safety_stock_loads, dashboard_layout')
            .eq('id', userId)
            .maybeSingle();

        if (error) console.error("Error fetching profile:", error);
        return data;
    };

    const saveUserProfile = async (userId, updates) => {
        // updates: { lead_time_days, safety_stock_loads, dashboard_layout }
        // Ensure ID matches
        const payload = { id: userId, ...updates, updated_at: new Date() };
        const { error } = await supabase.from('profiles').upsert(payload);
        if (error) console.error("Error saving profile:", error);
    };

    return {
        migrateLocalStorage,
        fetchMRPState,
        fetchUserProfile,
        savePlanningEntry,
        saveProductionSetting,
        saveInventoryAnchor,
        saveUserProfile
    };
};
