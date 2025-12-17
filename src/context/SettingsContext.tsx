
import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

// --- Types ---
interface CSVMapping {
    statusColumn: string;
    fullValue: string;
    skuColumn: string;
    [key: string]: string;
}

interface DashboardLayout {
    top: string[];
    col1: string[];
    col2: string[];
    scheduler?: SchedulerSettings; // Legacy storage location
    [key: string]: any;
}

interface SchedulerSettings {
    targetDailyProduction: number;
    shiftStartTime: string;
    poAssignments: Record<string, any>;
    cancelledLoads: any[];
    leadTimeDays?: number; // Sometimes stored here
}

interface SettingsContextType {
    safetyStockLoads: number;
    leadTimeDays: number;
    csvMapping: CSVMapping;
    dashboardLayout: DashboardLayout;
    schedulerSettings: SchedulerSettings;
    theme: string;
    activeSku: string;

    setTheme: (theme: string) => void;
    setDashboardLayout: (layout: DashboardLayout) => void;
    setSafetyStockLoads: (v: number | string) => void;
    setLeadTimeDays: (v: number | string) => void;
    updateCsvMapping: (field: string, value: string) => void;
    updateSchedulerSetting: (field: string, value: any) => void;
    resetDefaults: () => void;
    setActiveSku: (sku: string) => void;
    updateGlobalSetting: (key: string, value: any) => void;
}

const DEFAULTS = {
    safetyStockLoads: 6,
    csvMapping: {
        statusColumn: 'Trailer State',
        fullValue: 'Loaded - Inbound',
        skuColumn: 'Commodity'
    },
    dashboardLayout: {
        top: ['kpis'],
        col1: ['demand'],
        col2: ['chart', 'inventory', 'production']
    } as DashboardLayout,
    leadTimeDays: 2
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
    children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
    const { user } = useAuth();
    const { fetchUserProfile, saveUserProfile } = useSupabaseSync();

    // 1. Safety Stock
    const [safetyStockLoads, setSafetyStockLoads] = useState<number>(() => {
        try {
            const item = localStorage.getItem('safetyStockLoads');
            if (item === null) return DEFAULTS.safetyStockLoads;
            const val = Number(item);
            return !isNaN(val) && val >= 0 ? val : DEFAULTS.safetyStockLoads;
        } catch { return DEFAULTS.safetyStockLoads; }
    });

    // 2. CSV Mapping
    const [csvMapping, setCsvMapping] = useState<CSVMapping>(() => {
        try {
            const saved = localStorage.getItem('csvMapping');
            return saved ? JSON.parse(saved) : DEFAULTS.csvMapping;
        } catch { return DEFAULTS.csvMapping; }
    });

    // 3. Dashboard Layout
    const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>(() => {
        try {
            const saved = localStorage.getItem('dashboardLayout');
            let parsed = saved ? JSON.parse(saved) : DEFAULTS.dashboardLayout;

            // v2.11 Cleanup Logic (Retained from original)
            if (parsed.top && parsed.top.includes('demand')) {
                parsed.top = parsed.top.filter((x: string) => x !== 'demand');
                if (!parsed.col1.includes('demand')) parsed.col1.unshift('demand');
            }

            return {
                top: parsed.top || ['kpis'],
                col1: parsed.col1 || ['demand'],
                col2: parsed.col2 || ['chart', 'inventory', 'production'],
                ...parsed
            };
        } catch { return DEFAULTS.dashboardLayout; }
    });

    // 4. Lead Time
    const [leadTimeDays, setLeadTimeDays] = useState<number>(() => {
        try {
            const item = localStorage.getItem('leadTimeDays');
            const val = Number(item);
            return !isNaN(val) && val >= 0 ? val : DEFAULTS.leadTimeDays;
        } catch { return DEFAULTS.leadTimeDays; }
    });

    // 5. Active SKU (Local Only Preference usually)
    const [activeSku, setActiveSku] = useState<string>(() => {
        return localStorage.getItem('activeSku') || '20oz';
    });

    // 6. Theme
    const [theme, setTheme] = useState<string>(() => {
        return localStorage.getItem('theme') || 'light';
    });

    // 7. Scheduler Settings
    const [schedulerSettings, setSchedulerSettings] = useState<SchedulerSettings>(() => {
        try {
            // Legacy Migration Check
            const target = localStorage.getItem('sched_targetDailyProduction');
            const start = localStorage.getItem('sched_shiftStartTime');
            const pos = localStorage.getItem('sched_poAssignments');
            const cancelled = localStorage.getItem('sched_cancelledLoads');

            if (target !== null || start !== null || pos !== null) {
                return {
                    targetDailyProduction: target ? Number(target) : 0,
                    shiftStartTime: start || '00:00',
                    poAssignments: pos ? JSON.parse(pos) : {},
                    cancelledLoads: cancelled ? JSON.parse(cancelled) : []
                };
            }
            // Defaults
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


    // --- REALTIME SYNC (Profiles) ---
    // User Settings are stored in 'profiles' table.
    useRealtimeSubscription({
        table: 'profiles',
        filter: user ? `id=eq.${user.id}` : undefined,
        event: 'UPDATE', // We only care if our profile updates
        enabled: !!user,
        onDataChange: (payload: any) => {
            const newProfile = payload.new;
            if (!newProfile) return;

            // console.log("Realtime Profile Update:", newProfile);

            // Sync States
            if (newProfile.lead_time_days !== undefined && newProfile.lead_time_days !== null) {
                setLeadTimeDays(Number(newProfile.lead_time_days));
            }
            if (newProfile.safety_stock_loads !== undefined && newProfile.safety_stock_loads !== null) {
                setSafetyStockLoads(Number(newProfile.safety_stock_loads));
            }
            if (newProfile.theme) {
                setTheme(newProfile.theme);
            }
            if (newProfile.dashboard_layout) {
                const dl = newProfile.dashboard_layout;
                // Merge carefully
                setDashboardLayout(prev => ({
                    ...prev,
                    top: dl.top || prev.top,
                    col1: dl.col1 || prev.col1,
                    col2: dl.col2 || prev.col2
                }));

                // Scheduler settings living inside dashboard_layout JSON
                if (dl.scheduler) {
                    setSchedulerSettings(prev => ({ ...prev, ...dl.scheduler }));
                }
            }
        }
    });

    // --- Persistence Effects ---

    // Initial Cloud Load
    useEffect(() => {
        if (user) {
            fetchUserProfile(user.id).then((profile: any) => {
                if (profile) {
                    if (profile.lead_time_days !== null) setLeadTimeDays(profile.lead_time_days);
                    if (profile.safety_stock_loads !== null) setSafetyStockLoads(profile.safety_stock_loads);
                    if (profile.dashboard_layout) {
                        const dl = profile.dashboard_layout;
                        setDashboardLayout(prev => ({
                            ...prev,
                            top: dl.top || prev.top,
                            col1: dl.col1 || prev.col1,
                            col2: dl.col2 || prev.col2
                        }));
                        if (dl.scheduler) {
                            setSchedulerSettings(prev => ({ ...prev, ...dl.scheduler }));
                        }
                    }
                    if (profile.theme) setTheme(profile.theme);
                }
            });
        }
    }, [user, fetchUserProfile]);


    // Local Savers & Cloud Push
    useEffect(() => {
        localStorage.setItem('safetyStockLoads', JSON.stringify(safetyStockLoads));
        if (user) saveUserProfile(user.id, { safety_stock_loads: safetyStockLoads });
    }, [safetyStockLoads, user, saveUserProfile]);

    useEffect(() => {
        localStorage.setItem('leadTimeDays', JSON.stringify(leadTimeDays));
        if (user) saveUserProfile(user.id, { lead_time_days: leadTimeDays });
    }, [leadTimeDays, user, saveUserProfile]);

    useEffect(() => {
        localStorage.setItem('csvMapping', JSON.stringify(csvMapping));
    }, [csvMapping]);

    useEffect(() => {
        localStorage.setItem('activeSku', activeSku);
    }, [activeSku]);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');

        localStorage.setItem('theme', theme);
        if (user) saveUserProfile(user.id, { theme });
    }, [theme, user, saveUserProfile]);

    useEffect(() => {
        localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));
        localStorage.setItem('settings_scheduler', JSON.stringify(schedulerSettings));

        if (user) {
            const merged = {
                ...dashboardLayout,
                scheduler: schedulerSettings
            };
            saveUserProfile(user.id, { dashboard_layout: merged });
        }
    }, [dashboardLayout, schedulerSettings, user, saveUserProfile]);


    const updateCsvMapping = useCallback((field: string, value: string) => {
        setCsvMapping(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const updateSchedulerSetting = useCallback((field: string, value: any) => {
        setSchedulerSettings(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const resetDefaults = useCallback(() => {
        setSafetyStockLoads(DEFAULTS.safetyStockLoads);
        setLeadTimeDays(DEFAULTS.leadTimeDays);
        setCsvMapping(DEFAULTS.csvMapping);
        setDashboardLayout(DEFAULTS.dashboardLayout);
        setSchedulerSettings({ targetDailyProduction: 0, shiftStartTime: '00:00', poAssignments: {}, cancelledLoads: [] });
    }, []);

    const value = useMemo(() => ({
        safetyStockLoads,
        leadTimeDays,
        csvMapping,
        dashboardLayout,
        schedulerSettings,
        theme,
        activeSku,
        setTheme,
        setDashboardLayout,
        setSafetyStockLoads: (v: number | string) => {
            const val = Number(v);
            setSafetyStockLoads(!isNaN(val) && val >= 0 ? val : 0);
        },
        setLeadTimeDays: (v: number | string) => {
            const val = Number(v);
            setLeadTimeDays(!isNaN(val) && val >= 0 ? val : 2);
        },
        updateCsvMapping,
        updateSchedulerSetting,
        resetDefaults,
        setActiveSku,
        updateGlobalSetting: (key: string, value: any) => {
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
        activeSku,
        updateCsvMapping,
        updateSchedulerSetting,
        resetDefaults
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
