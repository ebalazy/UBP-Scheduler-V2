import { useEffect } from 'react';
import { supabase } from '../services/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define generic payload type if desired, or use Supabase's default
type RealtimePayload = RealtimePostgresChangesPayload<any>;

interface UseRealtimeSubscriptionProps {
    table: string;
    filter?: string; // e.g., "product_id=eq.123"
    event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
    schema?: string;
    onDataChange: (payload: RealtimePayload) => void;
    enabled?: boolean;
}

export function useRealtimeSubscription({
    table,
    filter,
    event = '*',
    schema = 'public',
    onDataChange,
    enabled = true
}: UseRealtimeSubscriptionProps) {

    useEffect(() => {
        if (!enabled) return;

        // Channel Name should be unique-ish
        const channelName = `public:${table}${filter ? `:${filter}` : ''}`;
        console.log(`[Realtime] Connecting to: ${channelName}`, { table, filter, event });

        const validFilter = {
            event: event as '*' | 'INSERT' | 'UPDATE' | 'DELETE',
            schema,
            table,
            filter: filter || undefined // ensuring it's valid if string is empty
        };

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                validFilter,
                (payload: RealtimePayload) => {
                    // console.log(`[Realtime] Received ${payload.eventType} on ${table}`, payload);
                    onDataChange(payload);
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Channel ${channelName} status:`, status);
                if (status === 'CHANNEL_ERROR') {
                    console.error(`[Realtime] Error connecting to ${channelName}`);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, filter, event, schema, onDataChange, enabled]);
}
