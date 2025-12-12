
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useSupabaseSync } from '../hooks/useSupabaseSync';

const DEFAULTS = {
    bottleDefinitions: {
        '20oz': { bottlesPerCase: 12, bottlesPerTruck: 80784, casesPerTruck: 6732, casesPerPallet: 306, palletsPerTruck: 22, productionRate: 1000 },
        '16.9oz': { bottlesPerCase: 24, bottlesPerTruck: 90288, casesPerTruck: 3762, casesPerPallet: 171, palletsPerTruck: 22, productionRate: 1200 },
        '32oz': { bottlesPerCase: 15, bottlesPerTruck: 50820, casesPerTruck: 3388, casesPerPallet: 154, palletsPerTruck: 22, productionRate: 800 },
    },
    safetyStockLoads: 6,
    csvMapping: {
        statusColumn: 'Trailer State',
        fullValue: 'Loaded - Inbound',
        skuColumn: 'Commodity'
    },
    dashboardLayout: {
        top: ['kpis', 'demand'],
        col1: [], // 'chart' is better in col2
        col2: ['inventory', 'chart', 'production']
    }
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const { user } = useAuth();
    const { fetchUserProfile, saveUserProfile } = useSupabaseSync();

    // Initialize state from LocalStorage or Defaults
    const [bottleDefinitions, setBottleDefinitions] = useState(() => {
        try {
            const saved = localStorage.getItem('bottleDefinitions');
            return saved ? JSON.parse(saved) : DEFAULTS.bottleDefinitions;
        } catch (e) {
            return DEFAULTS.bottleDefinitions;
        }
    });

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

            // Migration: Clean up old keys if they persist in LocalStorage
            if (parsed.col2) {
                // If col2 has 'supply', remove it.
                parsed.col2 = parsed.col2.filter(id => id !== 'supply' && id !== 'purchasing' && id !== 'inputs');

                // Ensure critical widgets exist
                if (!parsed.col2.includes('inventory')) parsed.col2.unshift('inventory');
                if (!parsed.col2.includes('chart')) parsed.col2.push('chart');
            }
            // Ensure Top has demand + kpis
            if (!parsed.top) parsed.top = ['kpis', 'demand'];
            else {
                if (!parsed.top.includes('kpis')) parsed.top.unshift('kpis');
                if (!parsed.top.includes('demand')) parsed.top.push('demand');
            }

            return parsed;
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
        localStorage.setItem('bottleDefinitions', JSON.stringify(bottleDefinitions));
    }, [bottleDefinitions]);

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

                    // Handle Dashboard Layout + Scheduler Stored inside it
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
                    }
                }
            });
        }
    }, [user]);

    // Savers
    useEffect(() => {
        localStorage.setItem('bottleDefinitions', JSON.stringify(bottleDefinitions));
    }, [bottleDefinitions]);

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

    // Consolidated Dashboard & Scheduler Saver
    // We save both into 'dashboard_layout' column to simulate a 'settings' jsonb column
    useEffect(() => {
        localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));

        // Also persist scheduler settings locally for fallback? 
        // We used to use separate keys. Let's keep separate local keys for safety if we revert?
        // Or just trust this context.
        // Let's keep local keys sync'd for now so if user reloads without net, 'useScheduler' legacy logic works?
        // No, we are porting useScheduler to use THIS context. So local keys 'sched_*' are obsolete unless we write back to them for backup.
        // Let's write to `settings_scheduler` local key.
        localStorage.setItem('settings_scheduler', JSON.stringify(schedulerSettings));

        if (user) {
            // merge dashboardLayout + scheduler into one JSON
            const merged = {
                ...dashboardLayout,
                scheduler: schedulerSettings
            };
            saveUserProfile(user.id, { dashboard_layout: merged });
        }
    }, [dashboardLayout, schedulerSettings, user]);


    const updateBottleDefinition = (size, field, value) => {
        setBottleDefinitions(prev => {
            const val = Number(value);
            const safeVal = !isNaN(val) && val >= 0 ? val : 0;
            return {
                ...prev,
                [size]: {
                    ...prev[size],
                    [field]: safeVal
                }
            };
        });
    };

    const updateCsvMapping = (field, value) => {
        setCsvMapping(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const updateSchedulerSetting = (field, value) => {
        setSchedulerSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const addBottleDefinition = (name) => {
        if (!name) return;
        setBottleDefinitions(prev => {
            if (prev[name]) return prev;
            // Clone structure from 20oz default
            return {
                ...prev,
                [name]: { ...DEFAULTS.bottleDefinitions['20oz'] }
            };
        });
    };

    const deleteBottleDefinition = (name) => {
        setBottleDefinitions(prev => {
            const copy = { ...prev };
            delete copy[name];
            return copy;
        });
    };

    const resetDefaults = () => {
        setBottleDefinitions(DEFAULTS.bottleDefinitions);
        setSafetyStockLoads(DEFAULTS.safetyStockLoads);
        setLeadTimeDays(DEFAULTS.leadTimeDays || 2);
        setCsvMapping(DEFAULTS.csvMapping);
        setDashboardLayout(DEFAULTS.dashboardLayout);
        setSchedulerSettings({ targetDailyProduction: 0, shiftStartTime: '00:00', poAssignments: {}, cancelledLoads: [] });
    };

    // Stable Bottle Sizes (derived from constant)
    const staticBottleSizes = Object.keys(DEFAULTS.bottleDefinitions);

    const value = useMemo(() => ({
        bottleDefinitions,
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
        updateBottleDefinition,
        updateCsvMapping,
        updateSchedulerSetting, // Exported
        resetDefaults,
        addBottleDefinition, // Exported
        deleteBottleDefinition, // Exported
        bottleSizes: Object.keys(bottleDefinitions) // Dynamic
    }), [
        bottleDefinitions,
        safetyStockLoads,
        leadTimeDays,
        csvMapping,
        dashboardLayout,
        schedulerSettings,
        theme
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
