import { supabase } from './client';
import { PlanningEntrySchema, InventorySnapshotSchema } from '../../types/schemas';

// --- Types ---
export interface PlanningEntry {
    date: string;
    entry_type: 'demand_plan' | 'inbound_trucks' | 'production_actual' | 'truck_manifest_json';
    value: number;
    meta_json?: any;
    product_id?: string;
    user_id?: string;
    id?: string;
}

export interface ProductionSettings {
    id?: string;
    product_id: string;
    production_rate?: number;
    downtime_hours?: number;
    is_auto_replenish?: boolean;
    [key: string]: any;
}

export interface InventorySnapshot {
    id?: string;
    product_id: string;
    date: string;
    location: 'floor' | 'yard';
    quantity_pallets: number;
    user_id?: string;
}

export interface SAPPlannedInbound {
    date: string;
    po_number: string;
    scheduled_qty: number;
    open_qty: number;
    received_qty: number;
    product_id: string;
    vendor_name?: string;
    appointment_time?: string;
    status?: string;
}

interface FetchPlanningDetailsResult {
    entries: PlanningEntry[];
    settings: ProductionSettings | null;
    snapshotFloor: InventorySnapshot | null;
    snapshotYard: InventorySnapshot | null;
    plannedInbound: SAPPlannedInbound[];
}

/**
 * Loads all planning entries and settings for a product
 */
export const fetchPlanningDetails = async (productId: string): Promise<FetchPlanningDetailsResult> => {
    const [entries, settings, snapshotsFloor, snapshotsYard, plannedInbound] = await Promise.all([
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
            .maybeSingle(),
        supabase
            .from('planned_inbound')
            .select('*')
            .eq('product_id', productId)
            .order('date', { ascending: true })
    ]);

    return {
        entries: (entries.data as PlanningEntry[]) || [],
        settings: (settings.data as ProductionSettings | null),
        snapshotFloor: (snapshotsFloor.data as InventorySnapshot | null),
        snapshotYard: (snapshotsYard.data as InventorySnapshot | null),
        plannedInbound: (plannedInbound.data as SAPPlannedInbound[]) || []
    };
};

/**
 * Save or Delete a planning entry
 */
export const upsertPlanningEntry = async (productId: string, userId: string, date: string, type: string, value: number | null | undefined, metaJson: any = null): Promise<void> => {
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
    } catch (validationError: any) {
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
export const saveProductionSetting = async (productId: string, field: string, value: any): Promise<void> => {
    // Partial Validation - tricky with single field updates
    if (field === 'production_rate' && (typeof value === 'number' && value < 0)) throw new Error("Production Rate cannot be negative");
    if (field === 'downtime_hours' && (typeof value === 'number' && value < 0)) throw new Error("Downtime cannot be negative");

    const { data } = await supabase
        .from('production_settings')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

    const existingId = data && data.length > 0 ? data[0].id : null;
    const update: any = { product_id: productId, [field]: value };
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
export const batchUpsertPlanningEntries = async (entries: PlanningEntry[]): Promise<void> => {
    if (!entries.length) return;
    const { error } = await supabase
        .from('planning_entries')
        .upsert(entries, { onConflict: 'product_id, date, entry_type' });
    if (error) throw error;
};

export const batchUpsertSettings = async (settings: ProductionSettings[]): Promise<void> => {
    const { error } = await supabase
        .from('production_settings')
        .upsert(settings);
    if (error) throw error;
};

/**
 * Save Inventory Snapshot
 */
export const saveInventorySnapshot = async (productId: string, userId: string, date: string, count: number, location: 'floor' | 'yard' = 'floor'): Promise<void> => {
    // VALIDATION
    try {
        InventorySnapshotSchema.parse({ date, count, location });
    } catch (e: any) {
        throw new Error(`Invalid Snapshot: ${e.errors[0].message}`);
    }

    const { error } = await supabase.from('inventory_snapshots').upsert({
        product_id: productId,
        user_id: userId,
        date: date,
        location: location,
        quantity_pallets: count
    }, { onConflict: 'product_id, date, location' });

    if (error) throw error;
};
