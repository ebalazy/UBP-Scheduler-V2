import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'planner', 'viewer', 'production'
    const [loading, setLoading] = useState(true);

    const fetchRole = async (email) => {
        if (!email) {
            setUserRole(null);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('user_roles')
                .select('role')
                .eq('email', email)
                .maybeSingle();

            if (error && error.code !== '42P01') { // Ignore missing table error
                console.error('Error fetching role:', error);
            }

            // If user exists in table, use their role.
            // If table missing or user not found, default to 'admin' (for dev) or 'viewer'?
            // SAFEST FOR DEV: Default to 'admin' if row is missing, so they don't get locked out during setup.
            // ONCE SETUP: They should add themselves to table.
            setUserRole(data?.role || 'admin');
        } catch (e) {
            setUserRole('admin');
        }
    };

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null;
            setUser(u);
            if (u) fetchRole(u.email);
            else setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const u = session?.user ?? null;
            setUser(u);
            if (u) fetchRole(u.email);
            else {
                setUserRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Ensure loading is false only after role is fetched (if user exists)
    useEffect(() => {
        if (user && userRole !== null) setLoading(false);
        if (!user && !loading) setLoading(false);
    }, [user, userRole]);

    const signIn = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin // Ensure correct redirect
            }
        });
        if (error) throw error;
        return data;
    };

    const resendVerificationEmail = async (email) => {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const value = {
        user,
        userRole,
        signIn,
        signUp,
        signOut,
        resendVerificationEmail, // New Export
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
