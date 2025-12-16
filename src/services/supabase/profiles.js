
import { supabase } from './client';

export const getUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('lead_time_days, safety_stock_loads, dashboard_layout')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile:", error);
        return null;
    }
    return data;
};

export const upsertUserProfile = async (userId, updates) => {
    const payload = { id: userId, ...updates, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) throw error;
};
