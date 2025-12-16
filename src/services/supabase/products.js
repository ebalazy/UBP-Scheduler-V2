
import { supabase } from './client';

/**
 * Ensures a product (SKU) exists for the given user.
 * Returns the product ID.
 * @param {string} userId 
 * @param {string} skuName 
 * @param {object} defaults - Optional default values for new product
 * @returns {Promise<string>} Product ID
 */
export const ensureProduct = async (userId, skuName, defaults = {}) => {
    // Check if exists
    const { data: existing, error: fetchError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .eq('name', skuName)
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
 * Fetch a single product by name
 */
export const getProductByName = async (userId, skuName) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('name', skuName)
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
};

/**
 * Fetch all products for a user
 */
export const getUserProducts = async (userId) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId);

    if (error) throw error;
    return data || [];
};
