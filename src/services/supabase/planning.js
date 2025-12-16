
import { supabase } from './client';
import { PlanningEntrySchema, ProductionSettingsSchema, InventorySnapshotSchema } from '../../types/schemas';

/**
 * Loads all planning entries and settings for a product
 */
export const fetchPlanningDetails = async (productId) => {
    const [entries, settings, snapshotsFloor, snapshotsYard] = await Promise.all([
        supabase
            .from('planning_entries')
            .select('date, entry_type, value, meta_json')
            .eq('product_id', productId),
        supabase
            .from('production_settings')
            .select('*')
            .eq('product_id', productId)
            .maybeSingle(),
        supabase
            .from('inventory_snapshots')
            .select('*')
            .eq('product_id', productId)
            .eq('location', 'floor')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('inventory_snapshots')
            .select('*')
            .eq('product_id', productId)
            .eq('location', 'yard')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle()
    ]);

    return {
        entries: entries.data || [],
        settings: settings.data,
        snapshotFloor: snapshotsFloor.data,
        snapshotYard: snapshotsYard.data
    };
};

/**
 * Save or Delete a planning entry
 */
export const upsertPlanningEntry = async (productId, userId, date, type, value, metaJson = null) => {
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

    // VALIDATION
    try {
        PlanningEntrySchema.parse({ date, type, value, metaJson });
    } catch (validationError) {
        console.error("Validation Failed:", validationError);
        throw new Error(`Invalid Planning Entry: ${validationError.errors[0].message}`);
    }

    const { data: existing } = await supabase
        .from('planning_entries')
        .select('id')
        .eq('product_id', productId)
        .eq('date', date)
        .eq('entry_type', type)
        .maybeSingle();

    const payload = {
        product_id: productId,
        user_id: userId,
        date,
        entry_type: type,
        value: value,
        meta_json: metaJson
    };

    if (existing) {
        const { error } = await supabase
            .from('planning_entries')
            .update({
                value: value,
                meta_json: metaJson,
                user_id: userId
            })
            .eq('id', existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('planning_entries')
            .insert(payload);
        if (error) throw error;
    }
};

/**
 * Save Production Settings
 */
export const saveProductionSetting = async (productId, field, value) => {
    // Partial Validation - tricky with single field updates
    // Ideally we fetch, merge, and validate, but that's expensive for a single field toggle.
    // We'll trust the caller for now or manual check.
    if (field === 'production_rate' && value < 0) throw new Error("Production Rate cannot be negative");
    if (field === 'downtime_hours' && value < 0) throw new Error("Downtime cannot be negative");

    const { data } = await supabase
        .from('production_settings')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

    const existingId = data && data.length > 0 ? data[0].id : null;
    const update = { product_id: productId, [field]: value };
    if (existingId) update.id = existingId;

    const { error } = await supabase.from('production_settings').upsert(update);
    if (error) {
        console.error("Error saving production setting:", error);
        throw error;
    }
};

/**
 * Batch insert planning entries (used for migration)
 */
export const batchUpsertPlanningEntries = async (entries) => {
    if (!entries.length) return;
    const { error } = await supabase
        .from('planning_entries')
        .upsert(entries, { onConflict: 'product_id, date, entry_type' });
    if (error) throw error;
};

export const batchUpsertSettings = async (settings) => {
    const { error } = await supabase
        .from('production_settings')
        .upsert(settings);
    if (error) throw error;
};

/**
 * Save Inventory Snapshot
 */
export const saveInventorySnapshot = async (productId, userId, date, count, location = 'floor') => {
    // VALIDATION
    try {
        InventorySnapshotSchema.parse({ date, count, location });
    } catch (e) {
        throw new Error(`Invalid Snapshot: ${e.errors[0].message}`);
    }

    /* 
    // Legacy: We used to manage an 'is_latest' flag, but the DB schema doesn't support it.
    // Relying on Date sorting instead.
    await supabase.from('inventory_snapshots')
        .update({ is_latest: false })
        .eq('product_id', productId)
        .eq('location', location);
    */

    const { error } = await supabase.from('inventory_snapshots').upsert({
        product_id: productId,
        user_id: userId,
        date: date,
        location: location,
        quantity_pallets: count
    }, { onConflict: 'product_id, date, location' });

    if (error) throw error;
};
