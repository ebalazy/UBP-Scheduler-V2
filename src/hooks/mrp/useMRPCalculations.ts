import { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useProducts } from '../../context/ProductsContext';
import { getLocalISOString } from '../../utils/dateUtils';
import { calculateMRP, MRPSpecs } from '../../utils/mrpLogic';

export function useMRPCalculations(state: any, poManifest: any = {}) {
    // state is 'any' for now because useMRPState is complex, but we can infer parts. 
    // Ideally we define an interface for MRPState, but that's in useMRPState.ts 
    // and might not be exported yet.

    const { safetyStockLoads, leadTimeDays: globalLeadTime } = useSettings();
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
    const specs: MRPSpecs | undefined = bottleDefinitions[selectedSize];
    const productionRate = specs?.productionRate || 0;

    // Determine effective lead time (product-specific or global fallback)
    const effectiveLeadTime = specs?.leadTimeDays !== undefined && specs?.leadTimeDays !== null
        ? specs.leadTimeDays
        : (globalLeadTime || 2);

    const results = useMemo(() => {
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
            safetyStockLoads,
            leadTimeDays: effectiveLeadTime
        };

        return calculateMRP(params);

    }, [
        selectedSize, productionRate, downtimeHours, incomingTrucks,
        bottleDefinitions, safetyStockLoads, yardInventory,
        monthlyDemand, monthlyInbound, inventoryAnchor, poManifest,
        monthlyProductionActuals, specs, effectiveLeadTime
    ]);

    // Backward compatibility wrapper for old components expecting direct returns
    return useMemo(() => ({
        totalScheduledCases: results?.effectiveScheduledCases || 0, // Fallback mapping 
        productionRate,
        calculations: results
    }), [results, productionRate]);
}
