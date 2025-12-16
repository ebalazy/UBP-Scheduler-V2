
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

const DEFAULTS = {
    bottleDefinitions: {}, // Deprecated: Use ProductsContext
    safetyStockLoads: 6,
    csvMapping: {
        statusColumn: 'Trailer State',
        fullValue: 'Loaded - Inbound',
        skuColumn: 'Commodity'
    },
    top: ['kpis'],
    col1: ['demand'],
    col2: ['chart', 'inventory', 'production']
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const { user } = useAuth();
    const { fetchUserProfile, saveUserProfile } = useSupabaseSync();

    // Initialize state from LocalStorage or Defaults


    const [safetyStockLoads, setSafetyStockLoads] = useState(() => {
        try {
            const item = localStorage.getItem('safetyStockLoads');
            if (item === null) return DEFAULTS.safetyStockLoads;
            const val = Number(item);
            if (val === 0) return DEFAULTS.safetyStockLoads; // Default fix
            return !isNaN(val) && val >= 0 ? val : DEFAULTS.safetyStockLoads;
        } catch (e) {
            return DEFAULTS.safetyStockLoads;
        }
    });

    const [csvMapping, setCsvMapping] = useState(() => {
        try {
            const saved = localStorage.getItem('csvMapping');
            return saved ? JSON.parse(saved) : DEFAULTS.csvMapping;
        } catch (e) {
            return DEFAULTS.csvMapping;
        }
    });

    const [dashboardLayout, setDashboardLayout] = useState(() => {
        try {
            const saved = localStorage.getItem('dashboardLayout');
            let parsed = saved ? JSON.parse(saved) : DEFAULTS.dashboardLayout;

            // --- STRICT MIGRATION FOR v2.11 ---
            // 1. Ensure 'demand' is in col1 (The Main Zone), not top.
            // We want the Grid to have vertical space.
            if (parsed.top && parsed.top.includes('demand')) {
                parsed.top = parsed.top.filter(x => x !== 'demand');
                if (!parsed.col1.includes('demand')) parsed.col1.unshift('demand');
            }

            // 2. Remove duplicates (Fixing the double chart issue)
            const allWidgets = new Set();
            const cleanList = (list) => {
                if (!Array.isArray(list)) return [];
                return list.filter(id => {
                    if (allWidgets.has(id)) return false; // Duplicate
                    allWidgets.add(id);
                    return true;
                });
            };

            // Order of priority for claiming widgets:
            // Top (KPIs only) -> Col1 (Main Input) -> Col2 (Context)
            // But we actually want to FORCE a specific structure for this cleanup:
            // Top: kpis
            // Col1: demand
            // Col2: chart, inventory, production

            // Let's just FORCE reset the layout for this version to ensure the cleanup sticks.
            // It's safer than trying to patch a broken user state.
            // We will respect if they previously had it, but re-organize it.

            return {
                top: ['kpis'],
                col1: ['demand'],
                col2: ['chart', 'inventory', 'production']
            };

        } catch (e) {
            return DEFAULTS.dashboardLayout;
        }
    });

    const [leadTimeDays, setLeadTimeDays] = useState(() => {
        try {
            const item = localStorage.getItem('leadTimeDays');
            if (item === null) return DEFAULTS.leadTimeDays || 2;
            const val = Number(item);
            return !isNaN(val) && val >= 0 ? val : (DEFAULTS.leadTimeDays || 2);
        } catch (e) {
            return DEFAULTS.leadTimeDays || 2;
        }
    });

    // --- Persist to LocalStorage AND Cloud ---

    // Cloud Load Effect
    useEffect(() => {
        if (user) {
            fetchUserProfile(user.id).then(profile => {
                if (profile) {
                    if (profile.lead_time_days !== null) setLeadTimeDays(profile.lead_time_days);
                    if (profile.safety_stock_loads !== null) setSafetyStockLoads(profile.safety_stock_loads);
                    if (profile.dashboard_layout) setDashboardLayout(profile.dashboard_layout);
                    if (profile.theme) setTheme(profile.theme);
                }
            });
        }
    }, [user]);

    // Savers


    useEffect(() => {
        localStorage.setItem('safetyStockLoads', JSON.stringify(safetyStockLoads));
        if (user) saveUserProfile(user.id, { safety_stock_loads: safetyStockLoads });
    }, [safetyStockLoads, user]);

    useEffect(() => {
        localStorage.setItem('leadTimeDays', JSON.stringify(leadTimeDays));
        if (user) saveUserProfile(user.id, { lead_time_days: leadTimeDays });
    }, [leadTimeDays, user]);

    useEffect(() => {
        localStorage.setItem('csvMapping', JSON.stringify(csvMapping));
    }, [csvMapping]);



    const [activeSku, setActiveSku] = useState(() => {
        return localStorage.getItem('activeSku') || '20oz'; // Default
    });

    useEffect(() => {
        localStorage.setItem('activeSku', activeSku);
    }, [activeSku]);

    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('theme') || 'light';
        } catch (e) {
            return 'light';
        }
    });

    // Theme Effect: Apply class to <html/>
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);

        // Sync to Cloud
        if (user) saveUserProfile(user.id, { theme });
    }, [theme, user]);

    const [schedulerSettings, setSchedulerSettings] = useState(() => {
        try {
            // Check if we have specific legacy keys
            const target = localStorage.getItem('sched_targetDailyProduction');
            const start = localStorage.getItem('sched_shiftStartTime');
            const pos = localStorage.getItem('sched_poAssignments');
            const cancelled = localStorage.getItem('sched_cancelledLoads');

            // If we have any legacy data, construct object
            if (target !== null || start !== null || pos !== null) {
                return {
                    targetDailyProduction: target ? Number(target) : 0,
                    shiftStartTime: start || '00:00',
                    poAssignments: pos ? JSON.parse(pos) : {},
                    cancelledLoads: cancelled ? JSON.parse(cancelled) : []
                };
            }
            return {
                targetDailyProduction: 0,
                shiftStartTime: '00:00',
                poAssignments: {},
                cancelledLoads: []
            };
        } catch (e) {
            return { targetDailyProduction: 0, shiftStartTime: '00:00', poAssignments: {}, cancelledLoads: [] };
        }
    });

    // Cloud Load Effect - Consolidated
    useEffect(() => {
        if (user) {
            fetchUserProfile(user.id).then(profile => {
                if (profile) {
                    if (profile.lead_time_days !== null) setLeadTimeDays(profile.lead_time_days);
                    if (profile.safety_stock_loads !== null) setSafetyStockLoads(profile.safety_stock_loads);

                    // Handle Dashboard Layout + Scheduler + Product Settings Stored inside it
                    if (profile.dashboard_layout) {
                        const dl = profile.dashboard_layout;
                        setDashboardLayout({
                            top: dl.top || DEFAULTS.dashboardLayout.top,
                            col1: dl.col1 || DEFAULTS.dashboardLayout.col1,
                            col2: dl.col2 || DEFAULTS.dashboardLayout.col2
                        });

                        // Extract Scheduler Settings from JSON if present
                        if (dl.scheduler) {
                            setSchedulerSettings(prev => ({ ...prev, ...dl.scheduler }));
                        }

                        // Extract Product Lead Times
                        if (dl.productLeadTimes) {
                            setProductLeadTimes(dl.productLeadTimes);
                        }
                    }
                }
            });
        }
    }, [user]);

    // Savers


    useEffect(() => {
        localStorage.setItem('safetyStockLoads', JSON.stringify(safetyStockLoads));
        if (user) saveUserProfile(user.id, { safety_stock_loads: safetyStockLoads });
    }, [safetyStockLoads, user]);

    useEffect(() => {
        localStorage.setItem('leadTimeDays', JSON.stringify(leadTimeDays));
        if (user) saveUserProfile(user.id, { lead_time_days: leadTimeDays });
    }, [leadTimeDays, user]);

    useEffect(() => {
        localStorage.setItem('csvMapping', JSON.stringify(csvMapping));
    }, [csvMapping]);

    // Consolidated Dashboard & Scheduler & Product Settings Saver
    // We save both into 'dashboard_layout' column to simulate a 'settings' jsonb column
    useEffect(() => {
        localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));
        localStorage.setItem('settings_scheduler', JSON.stringify(schedulerSettings));

        if (user) {
            // merge dashboardLayout + scheduler into one JSON
            const merged = {
                ...dashboardLayout,
                scheduler: schedulerSettings
            };

            // Sync to Cloud (Requires 'dashboard_layout' column in profiles table)
            saveUserProfile(user.id, { dashboard_layout: merged });
        }
    }, [dashboardLayout, schedulerSettings, user]);




    const updateCsvMapping = useCallback((field, value) => {
        setCsvMapping(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const updateSchedulerSetting = useCallback((field, value) => {
        setSchedulerSettings(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);





    const resetDefaults = useCallback(() => {

        setSafetyStockLoads(DEFAULTS.safetyStockLoads);
        setLeadTimeDays(DEFAULTS.leadTimeDays || 2);
        setCsvMapping(DEFAULTS.csvMapping);
        setDashboardLayout(DEFAULTS.dashboardLayout);
        setSchedulerSettings({ targetDailyProduction: 0, shiftStartTime: '00:00', poAssignments: {}, cancelledLoads: [] });
    }, []);


    const value = useMemo(() => ({
        safetyStockLoads,
        leadTimeDays,
        csvMapping,
        dashboardLayout,
        schedulerSettings, // Exported
        theme, // Exported
        setTheme, // Exported
        setDashboardLayout,
        setSafetyStockLoads: (v) => {
            const val = Number(v);
            setSafetyStockLoads(!isNaN(val) && val >= 0 ? val : 0);
        },
        setLeadTimeDays: (v) => {
            const val = Number(v);
            setLeadTimeDays(!isNaN(val) && val >= 0 ? val : 2);
        },
        updateCsvMapping,
        updateSchedulerSetting, // Exported
        resetDefaults,
        activeSku,
        setActiveSku,
        updateGlobalSetting: (key, value) => { // Adding missing export if needed? No, logic inside.
            if (key === 'leadTimeDays') setLeadTimeDays(Number(value));
            if (key === 'safetyStockLoads') setSafetyStockLoads(Number(value));
        }
    }), [
        safetyStockLoads,
        leadTimeDays,
        csvMapping,
        dashboardLayout,
        schedulerSettings,
        theme,
        activeSku
    ]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
