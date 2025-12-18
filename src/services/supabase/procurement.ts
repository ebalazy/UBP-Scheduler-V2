
import { supabase } from './client';

export interface ProcurementOrderModel {
    id?: string;
    po_number: string;
    date: string; // YYYY-MM-DD
    sku: string;
    quantity: number;
    supplier?: string;
    carrier?: string;
    status: string;
    delivery_time?: string;
    user_id?: string;
    created_at?: string;
}

export const fetchProcurementOrders = async (): Promise<any[]> => {
    // Note: The UI expects a map, but this returns raw rows. The context handles mapping.
    // We return 'any[]' because the specific shape depends on DB, but aligned with ProcurementOrderModel roughly.
    const { data, error } = await supabase
        .from('procurement_orders')
        .select('*')
        .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const upsertProcurementOrder = async (order: any, userId: string): Promise<void> => {
    // Order object comes from App Context (camelCase)
    // Payload maps to DB (snake_case)
    const payload = {
        po_number: order.po, // Maps 'po' -> 'po_number'
        quantity: order.qty,
        sku: order.sku,
        supplier: order.supplier,
        carrier: order.carrier,
        status: order.status || 'planned',
        date: order.date,
        delivery_time: order.time,
        user_id: userId
    };

    // Check by PO Number (Business Key)
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
};


export const deleteProcurementOrder = async (poNumber: string): Promise<void> => {
    const { error } = await supabase
        .from('procurement_orders')
        .delete()
        .eq('po_number', poNumber);
    if (error) throw error;
};

/**
 * Update SAP shipment overrides (status, appointment_time)
 */
export const updateSAPShipment = async (id: string, updates: { status?: string, appointment_time?: string }): Promise<void> => {
    const { error } = await supabase
        .from('planned_inbound')
        .update(updates)
        .eq('id', id);
    if (error) throw error;
};

/**
 * Fetch all SAP planned inbound shipments with product names
 */
export const fetchAllSAPShipments = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('planned_inbound')
        .select(`
            *,
            products (
                name
            )
        `)
        .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
};
