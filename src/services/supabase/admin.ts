
import { supabase, supabaseUrl, supabaseAnonKey } from './client';
import { createClient } from '@supabase/supabase-js';

// --- Types ---
export interface UserRole {
    id: string; // or email if PK?
    email: string;
    role: string;
    created_at?: string;
}

// --- User Roles Management ---

export const fetchAllUserRoles = async (): Promise<UserRole[]> => {
    const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        // Handle missing table specifically in UI if needed, but here just throw or return empty
        if (error.code === '42P01') throw error; // Let UI handle "Table Missing" state
        throw error;
    }
    return (data as UserRole[]) || [];
};

export const updateUserRole = async (email: string, newRole: string): Promise<void> => {
    const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .match({ email }); // matching by email as pseudo-PK
    if (error) throw error;
};

export const deleteUserRole = async (email: string): Promise<void> => {
    const { error } = await supabase
        .from('user_roles')
        .delete()
        .match({ email });
    if (error) throw error;
};

export const upsertUserRole = async (email: string, role: string): Promise<void> => {
    const { error } = await supabase
        .from('user_roles')
        .upsert({
            email: email.toLowerCase(),
            role: role,
        }, { onConflict: 'email' });
    if (error) throw error;
};

// --- Provisioning (Legacy/Client-Side) ---

/**
 * Creates a user by instantiating a temporary Supabase client.
 * This is widely considered a hack but required if not using Edge Functions for admin.
 */
export const provisionUserClientSide = async (email: string, password: string): Promise<any> => {
    // Create a temporary client to sign up WITHOUT logging out admin
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    // Sign Up the User
    const { data, error } = await tempClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) throw error;
    return data;
};

// --- Enterprise Provisioning ---

export const inviteUserEnterprise = async (email: string, role: string): Promise<any> => {
    const { data, error: funcError } = await supabase.functions.invoke('invite-user', {
        body: {
            email: email,
            role: role
        }
    });

    if (funcError) throw funcError;
    if (data?.error) throw new Error(data.error);

    return data;
};
