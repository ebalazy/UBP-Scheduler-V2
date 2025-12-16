import { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useProducts } from '../../context/ProductsContext';
import { getLocalISOString } from '../../utils/dateUtils';
import { calculateMRP } from '../../utils/mrpLogic';

export function useMRPCalculations(state, poManifest = {}) {
    const { safetyStockLoads } = useSettings();
    const { productMap: bottleDefinitions } = useProducts();
    const {
        selectedSize,
        monthlyDemand,
        monthlyProductionActuals,
        monthlyInbound,
        downtimeHours,
        incomingTrucks,
        yardInventory,
        inventoryAnchor
    } = state;

    // Derived productionRate for calculations
    const productionRate = bottleDefinitions[selectedSize]?.productionRate || 0;

    const results = useMemo(() => {
        const specs = bottleDefinitions[selectedSize];
        if (!specs) return null;

        const params = {
            todayStr: getLocalISOString(),
            productionRate,
            downtimeHours,
            selectedSize,
            bottleSpecs: specs,
            inventoryAnchor,
            yardInventory,
            incomingTrucks,
            monthlyDemand,
            monthlyProductionActuals,
            monthlyInbound,
            poManifest,
            safetyStockLoads
        };

        return calculateMRP(params);

    }, [
        selectedSize, productionRate, downtimeHours, incomingTrucks,
        bottleDefinitions, safetyStockLoads, yardInventory,
        monthlyDemand, monthlyInbound, inventoryAnchor, poManifest,
        monthlyProductionActuals
    ]);

    // Backward compatibility wrapper for old components expecting direct returns
    return useMemo(() => ({
        totalScheduledCases: results?.effectiveScheduledCases || 0, // Fallback mapping 
        productionRate,
        calculations: results
    }), [results, productionRate, results?.effectiveScheduledCases]);
}
