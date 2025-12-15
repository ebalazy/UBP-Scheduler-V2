import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jbedxxdpqtmprixfxgos.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZWR4eGRwcXRtcHJpeGZ4Z29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQxODcsImV4cCI6MjA4MTA0MDE4N30.U-3j_SAvrno9vMAVCsa2RHrmYFs0wLfyYka-Ax0TUQ4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
