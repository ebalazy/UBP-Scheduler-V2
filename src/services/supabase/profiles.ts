
import { supabase } from './client';

export interface UserProfile {
    id: string;
    lead_time_days?: number | null;
    safety_stock_loads?: number | null;
    dashboard_layout?: any; // JSONB
    theme?: string;
    updated_at?: string;
    [key: string]: any;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('lead_time_days, safety_stock_loads, dashboard_layout, theme')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile:", error);
        return null;
    }
    return data as UserProfile;
};

export const upsertUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
    const payload = { id: userId, ...updates, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) throw error;
};
