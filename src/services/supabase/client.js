
import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://jbedxxdpqtmprixfxgos.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZWR4eGRwcXRtcHJpeGZ4Z29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQxODcsImV4cCI6MjA4MTA0MDE4N30.U-3j_SAvrno9vMAVCsa2RHrmYFs0wLfyYka-Ax0TUQ4';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

if (!import.meta.env.VITE_SUPABASE_URL) {
    console.warn('Using Fallback Supabase Keys. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
