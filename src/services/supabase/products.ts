
import { supabase } from './client';

export interface Product {
    id: string;
    user_id: string;
    name: string;
    bottles_per_case: number;
    bottles_per_truck: number;
    cases_per_pallet: number;
    scrap_percentage?: number;
    created_at?: string;
}

/**
 * Ensures a product (SKU) exists for the given user.
 * Returns the product ID.
 */
export const ensureProduct = async (userId: string, skuName: string, defaults: Partial<Product> = {}): Promise<string> => {
    // Check if exists
    const { data: existing, error: fetchError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .eq('name', skuName)
        .order('created_at', { ascending: true }) // Deterministic: Oldest First
        .limit(1)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing.id;

    // Create if not
    const { data: created, error: createError } = await supabase
        .from('products')
        .insert({
            user_id: userId,
            name: skuName,
            bottles_per_case: defaults.bottles_per_case || 12, // Fixed camelCase mixing in original
            bottles_per_truck: defaults.bottles_per_truck || 20000,
            cases_per_pallet: defaults.cases_per_pallet || 100
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
 * Fetch a single product by name
 */
export const getProductByName = async (userId: string, skuName: string): Promise<Product | null> => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('name', skuName)
        .order('created_at', { ascending: true }) // Deterministic: Oldest First
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data as Product | null;
};

/**
 * Fetch all products for a user
 */
export const getUserProducts = async (userId: string): Promise<Product[]> => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId);

    if (error) throw error;
    return (data as Product[]) || [];
};
