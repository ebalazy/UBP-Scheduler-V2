import { createContext, useContext, useState, useEffect } from 'react';

const DEFAULTS = {
    bottleDefinitions: {
        '20oz': { bottlesPerCase: 12, bottlesPerTruck: 80784, casesPerTruck: 6732, casesPerPallet: 306, palletsPerTruck: 22 },
        '16.9oz': { bottlesPerCase: 24, bottlesPerTruck: 90288, casesPerTruck: 3762, casesPerPallet: 171, palletsPerTruck: 22 },
        '32oz': { bottlesPerCase: 15, bottlesPerTruck: 50820, casesPerTruck: 3388, casesPerPallet: 154, palletsPerTruck: 22 },
    },
    safetyStockLoads: 6,
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
            const saved = JSON.parse(localStorage.getItem('safetyStockLoads'));
            const val = Number(saved);
            return !isNaN(val) && val >= 0 ? val : DEFAULTS.safetyStockLoads;
        } catch (e) {
            return DEFAULTS.safetyStockLoads;
        }
    });

    // Persist to LocalStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('bottleDefinitions', JSON.stringify(bottleDefinitions));
    }, [bottleDefinitions]);

    useEffect(() => {
        localStorage.setItem('safetyStockLoads', JSON.stringify(safetyStockLoads));
    }, [safetyStockLoads]);

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

    const resetDefaults = () => {
        setBottleDefinitions(DEFAULTS.bottleDefinitions);
        setSafetyStockLoads(DEFAULTS.safetyStockLoads);
    };

    const value = {
        bottleDefinitions,
        safetyStockLoads,
        setSafetyStockLoads: (v) => {
            const val = Number(v);
            setSafetyStockLoads(!isNaN(val) && val >= 0 ? val : 0);
        },
        updateBottleDefinition,
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
