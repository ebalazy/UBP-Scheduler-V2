import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useProducts() {
    const { user } = useAuth();
    const [productsList, setProductsList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchProducts = async () => {
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

        fetchProducts();

        // Optional: Realtime subscription could go here
    }, [user]);

    // ADAPTER: Transform DB List -> Map { '20oz': { ... } }
    // Compatible with old 'bottleDefinitions' format but derived from DB
    const productMap = useMemo(() => {
        const map = {};
        productsList.forEach(p => {
            // Find default rate (Line 1 or first one)
            const defaultLine = p.production_settings?.find(s => s.line_name === 'Line 1') || p.production_settings?.[0];
            const rate = defaultLine?.production_rate || 0;

            map[p.name] = {
                bottlesPerCase: p.bottles_per_case,
                bottlesPerTruck: p.bottles_per_truck,
                casesPerTruck: Math.floor(p.bottles_per_truck / p.bottles_per_case), // Derived
                casesPerPallet: p.cases_per_pallet,
                palletsPerTruck: Math.floor((p.bottles_per_truck / p.bottles_per_case) / p.cases_per_pallet), // Derived
                productionRate: rate, // Default single rate for now
                scrapPercentage: 0,
                // New Fields
                id: p.id,
                description: p.description,
                allLines: p.production_settings || []
            };
        });
        return map;
    }, [productsList]);

    return {
        productsList,
        productMap,
        loading
    };
}
