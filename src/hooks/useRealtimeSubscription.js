import { useEffect } from 'react';
import { supabase } from '../services/supabase/client';

export function useRealtimeSubscription(activeProduct, onDataChange) {
    useEffect(() => {
        if (!activeProduct?.id) return;

        // 1. Define Channel
        const channel = supabase
            .channel(`public:planning_entries:product_id=eq.${activeProduct.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'planning_entries',
                    filter: `product_id=eq.${activeProduct.id}`
                },
                (payload) => {
                    // console.log("Realtime Update:", payload);
                    if (onDataChange) onDataChange(payload);
                }
            )
            .subscribe((status) => {
                // console.log("Realtime Status:", status);
            });

        // 2. Cleanup
        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeProduct?.id, onDataChange]);
}
