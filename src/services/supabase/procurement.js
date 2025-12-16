
import { supabase } from './client';

export const fetchProcurementOrders = async () => {
    const { data, error } = await supabase
        .from('procurement_orders')
        .select('*')
        .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const upsertProcurementOrder = async (order, userId) => {
    const payload = {
        po_number: order.po,
        quantity: order.qty,
        sku: order.sku,
        supplier: order.supplier,
        carrier: order.carrier,
        status: order.status || 'planned',
        date: order.date,
        delivery_time: order.time,
        user_id: userId
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
};

export const deleteProcurementOrder = async (poNumber) => {
    const { error } = await supabase
        .from('procurement_orders')
        .delete()
        .eq('po_number', poNumber);
    if (error) throw error;
};
