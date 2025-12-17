import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    // Forced re-compile
    // Optimistic User: Load from cache to prevent "Login Flash"
    const [user, setUser] = useState(() => {
        try {
            const cached = localStorage.getItem('ubp_session_user');
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    });

    // Initialize role from cache if available to prevent blocking load
    const [userRole, setUserRole] = useState(() => localStorage.getItem('ubp_user_role') || null);

    // Optimistic Load: If we have a role/user, assume we are good to go.
    // If we have a user in cache but no role, we still might be loading role.
    // So 'loading' should be false if we have ENOUGH to render AuthenticatedApp (which needs user).
    // Actually, App.jsx checks `if (!user)`. So if we have cached user, App renders App.
    // loading can be initialized false if we have a user.
    const [loading, setLoading] = useState(() => {
        return !localStorage.getItem('ubp_session_user');
    });



    const fetchRole = async (email) => {
        if (!email) {
            setUserRole(null);
            localStorage.removeItem('ubp_user_role');
            return;
        }
        try {
            const { data, error } = await supabase
                .from('user_roles')
                .select('role')
                .eq('email', email)
                .maybeSingle();

            if (error) {
                // If table is missing (42P01) or other error, log it and default to viewer
                if (error.code !== '42P01') {
                    console.error('Error fetching role:', error);
                }
                setUserRole('viewer');
                return;
            }

            // If user not found in table, or field is null, default to viewer
            const newRole = data?.role || 'viewer';
            setUserRole(newRole);
            localStorage.setItem('ubp_user_role', newRole);

        } catch (e) {
            console.error('Unexpected error fetching role:', e);
            setUserRole('viewer');
        }
    };



    useEffect(() => {
        let mounted = true;

        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!mounted) return;
            const u = session?.user ?? null;
            setUser(u);
            if (u) {
                // Cache user for next load
                localStorage.setItem('ubp_session_user', JSON.stringify(u));
                // Background refresh role
                fetchRole(u.email);
            } else {
                // Session Invalid/Expired
                localStorage.removeItem('ubp_session_user');
                localStorage.removeItem('ubp_user_role');

                // If we optimistically set loading=false (cached user existed?) but now find no user,
                // we must trigger a re-render to show LandingPage.
                setLoading(false);
            }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            const u = session?.user ?? null;
            setUser(u);
            if (u) {
                localStorage.setItem('ubp_session_user', JSON.stringify(u));
                fetchRole(u.email);
            } else {
                setUserRole(null);
                localStorage.removeItem('ubp_user_role');
                localStorage.removeItem('ubp_session_user');
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Remove the secondary effect that was forcing loading state logic
    // We now rely on initial state + async updates.



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
