import { createContext, useContext, useState, useEffect } from 'react';

const DEFAULTS = {
    bottleDefinitions: {
        '20oz': { bottlesPerCase: 12, bottlesPerTruck: 80784, casesPerTruck: 6732, casesPerPallet: 306, palletsPerTruck: 22 },
        '16.9oz': { bottlesPerCase: 24, bottlesPerTruck: 90288, casesPerTruck: 3762, casesPerPallet: 171, palletsPerTruck: 22 },
        '32oz': { bottlesPerCase: 15, bottlesPerTruck: 50820, casesPerTruck: 3388, casesPerPallet: 154, palletsPerTruck: 22 },
    },
    safetyStockLoads: 6,
    csvMapping: {
        statusColumn: 'Trailer State',
        fullValue: 'Loaded - Inbound',
        skuColumn: 'Commodity'
    },
    dashboardLayout: {
        top: ['kpis', 'demand'],
        col1: ['chart'],
        col2: ['inputs', 'dropzone']
    }
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
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
            // Fix: Number(null) is 0, so we must explicitly check for null (missing key)
            if (item === null) return DEFAULTS.safetyStockLoads;

            const val = Number(item);
            // If value is 0, it might be the previous bug. Default to 6 if 0.
            // Users can manually set to 0 if they really want it, but this fixes the "stuck at 0" default.
            if (val === 0) return DEFAULTS.safetyStockLoads;

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
            const parsed = saved ? JSON.parse(saved) : DEFAULTS.dashboardLayout;

            // Migration: Check if 'top' has 'demand' (our new standard). If not, reset to defaults.
            // This ensures users get the new requested layout automatically.
            if (!parsed.top || !parsed.top.includes('demand')) return DEFAULTS.dashboardLayout;

            return parsed;
        } catch (e) {
            return DEFAULTS.dashboardLayout;
        }
    });

    // Persist to LocalStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('bottleDefinitions', JSON.stringify(bottleDefinitions));
    }, [bottleDefinitions]);

    useEffect(() => {
        localStorage.setItem('safetyStockLoads', JSON.stringify(safetyStockLoads));
    }, [safetyStockLoads]);

    useEffect(() => {
        localStorage.setItem('csvMapping', JSON.stringify(csvMapping));
    }, [csvMapping]);

    useEffect(() => {
        localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));
    }, [dashboardLayout]);

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

    const resetDefaults = () => {
        setBottleDefinitions(DEFAULTS.bottleDefinitions);
        setSafetyStockLoads(DEFAULTS.safetyStockLoads);
        setCsvMapping(DEFAULTS.csvMapping);
        setDashboardLayout(DEFAULTS.dashboardLayout);
    };

    const value = {
        bottleDefinitions,
        safetyStockLoads,
        csvMapping,
        dashboardLayout,
        setDashboardLayout,
        setSafetyStockLoads: (v) => {
            const val = Number(v);
            setSafetyStockLoads(!isNaN(val) && val >= 0 ? val : 0);
        },
        updateBottleDefinition,
        updateCsvMapping,
        resetDefaults,
        bottleSizes: Object.keys(DEFAULTS.bottleDefinitions)
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
