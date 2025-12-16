import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase/client';
import { useAuth } from './AuthContext';

const ProductsContext = createContext();

export function useProducts() {
    return useContext(ProductsContext);
}

export function ProductsProvider({ children }) {
    const { user } = useAuth();
    // Optimistic Init: Load from cache
    const [productsList, setProductsList] = useState(() => {
        try {
            const cached = localStorage.getItem('ubp_products_list');
            return cached ? JSON.parse(cached) : [];
        } catch { return []; }
    });

    // If we have cached products, we aren't "loading" in a blocking sense.
    const [loading, setLoading] = useState(() => !localStorage.getItem('ubp_products_list'));

    // Fetch Logic
    const fetchProducts = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    production_settings (
                        line_name,
                        production_rate
                    )
                `);

            if (error) throw error;
            const list = data || [];

            // Update State & Cache
            setProductsList(list);
            localStorage.setItem('ubp_products_list', JSON.stringify(list));

        } catch (err) {
            console.error("Error loading products:", err);
        } finally {
            setLoading(false);
        }
    };

    const updateProductSettings = async (productName, updates) => {
        // Find product by name
        const product = productsList.find(p => p.name === productName);
        if (!product) return;

        // Optimistic Update
        const newList = productsList.map(p =>
            p.name === productName ? { ...p, ...updates } : p
        );
        setProductsList(newList);

        // API Call
        try {
            // updates keys: { lead_time_days: X, safety_stock_loads: Y }
            const { error } = await supabase
                .from('products')
                .update(updates)
                .eq('id', product.id);

            if (error) throw error;

        } catch (err) {
            console.error("Failed to update product settings", err);
            fetchProducts(); // Revert on error
        }
    };

    useEffect(() => {
        fetchProducts();
        // Optional: Realtime subscription could go here
    }, [user]);

    // Derived Map for fast lookup (replaces legacy bottleDefinitions)
    const productMap = useMemo(() => {
        const map = {};
        productsList.forEach(p => {
            // Logic to determine "Default" rate
            // 1. Try 'Line 1'
            // 2. Try first available line
            // 3. 0
            const defaultLine = p.production_settings?.find(s => s.line_name === 'Line 1') || p.production_settings?.[0];
            const rate = defaultLine?.production_rate || 0;

            map[p.name] = {
                // Settings Context 'bottleDefinitions' shape:
                bottlesPerCase: p.bottles_per_case,
                bottlesPerTruck: p.bottles_per_truck,
                casesPerTruck: Math.floor((p.bottles_per_truck || 0) / (p.bottles_per_case || 1)), // Derived if missing
                casesPerPallet: p.cases_per_pallet,
                palletsPerTruck: 22, // defaults? or derived?
                productionRate: rate,
                scrapPercentage: 0,

                // New: Global Lead Time
                leadTimeDays: p.lead_time_days, // Can be null/undefined
                safetyStockLoads: p.safety_stock_loads, // Can be null/undefined

                // Original Data
                id: p.id
            };
        });
        return map;
    }, [productsList]);


    // Public API
    const value = {
        products: productsList,
        productMap, // The replacement for bottleDefinitions
        loading,
        refreshProducts: fetchProducts,
        updateProductSettings, // Generalized Action

        // Helper to get specs safe
        getProductSpecs: (skuName) => {
            return productMap[skuName] || null;
        }
    };

    return (
        <ProductsContext.Provider value={value}>
            {children}
        </ProductsContext.Provider>
    );
}
