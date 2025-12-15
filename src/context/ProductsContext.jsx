import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

const ProductsContext = createContext();

export function useProducts() {
    return useContext(ProductsContext);
}

export function ProductsProvider({ children }) {
    const { user } = useAuth();
    const [productsList, setProductsList] = useState([]);
    const [loading, setLoading] = useState(true);

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
            setProductsList(data || []);
        } catch (err) {
            console.error("Error loading products:", err);
        } finally {
            setLoading(false);
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
