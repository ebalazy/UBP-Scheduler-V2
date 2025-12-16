
import { describe, it, expect } from 'vitest';
import { calculateMRP } from './mrpLogic';

describe('calculateMRP', () => {
    const todayStr = '2025-01-01';

    const mockSpecs = {
        bottlesPerCase: 10,
        bottlesPerTruck: 1000,
        casesPerPallet: 10,
        scrapPercentage: 0
    };

    const baseParams = {
        todayStr,
        productionRate: 100,
        downtimeHours: 0,
        selectedSize: 'TEST_SKU',
        bottleSpecs: mockSpecs,
        inventoryAnchor: { date: '2025-01-01', count: 10 }, // 10 Pallets = 100 cases = 1000 bottles
        yardInventory: { count: 0, date: '2025-01-01' },
        incomingTrucks: 0,
        monthlyDemand: {},
        monthlyProductionActuals: {},
        monthlyInbound: {},
        poManifest: {},
        safetyStockLoads: 1
    };

    it('should calculate initial inventory correctly from anchor', () => {
        const result = calculateMRP(baseParams);

        // 10 Pallets * 10 Cases * 10 Bottles = 1000 Bottles
        expect(result.initialInventory).toBe(1000);
        expect(result.daysOfSupply).toBe(30); // No demand
    });

    it('should deplete inventory based on demand', () => {
        const params = {
            ...baseParams,
            monthlyDemand: {
                '2025-01-01': 50 // 50 Cases = 500 bottles
            }
        };
        const result = calculateMRP(params);

        // Day 1 Balance: 1000 - 500 = 500
        expect(result.dailyLedger[0].balance).toBe(500);
    });

    it('should add supply from inbound trucks', () => {
        const params = {
            ...baseParams,
            monthlyInbound: {
                '2025-01-01': 1 // 1 Truck = 1000 bottles
            },
            monthlyDemand: {}
        };
        const result = calculateMRP(params);

        // Day 1 Balance: 1000 + 1000 = 2000
        expect(result.dailyLedger[0].balance).toBe(2000);
    });

    it('should prioritize PO Manifest over Manual Inbound', () => {
        const params = {
            ...baseParams,
            monthlyInbound: {
                '2025-01-01': 1 // Plan: 1 Truck
            },
            poManifest: {
                '2025-01-01': { items: [{}, {}] } // Actual: 2 Trucks (Empty objects just to count length)
            }
        };
        const result = calculateMRP(params);

        // Supply should be 2 trucks * 1000 = 2000 bottles
        // Initial 1000 + 2000 = 3000
        expect(result.dailyLedger[0].balance).toBe(3000);
    });

    it('should detect stockouts', () => {
        const params = {
            ...baseParams,
            monthlyDemand: {
                '2025-01-01': 200 // 2000 bottles (Deficit 1000)
            }
        };
        const result = calculateMRP(params);

        // Balance: 1000 - 2000 = -1000
        expect(result.dailyLedger[0].balance).toBe(-1000);
        expect(result.firstStockoutDate).toBe('2025-01-01');
    });

    it('should back-calculate from anchor if anchor is in past', () => {
        // Anchor was 5 days ago (10 Pallets)
        // Production since then: 100 Cases (1000 bottles)
        // Inbound since then: 1 Truck (1000 bottles)
        // Derived Current = (1000) + (1000 Supply) - (1000 Demand) = 1000 Bottles

        const params = {
            ...baseParams,
            todayStr: '2025-01-06',
            inventoryAnchor: { date: '2025-01-01', count: 10 },
            monthlyDemand: {
                '2025-01-01': 20,
                '2025-01-02': 20,
                '2025-01-03': 20,
                '2025-01-04': 20,
                '2025-01-05': 20
            }, // Total 100 Cases = 1000 Bottles
            monthlyInbound: {
                '2025-01-03': 1 // 1000 Bottles
            }
        };

        const result = calculateMRP(params);
        expect(result.calculatedPallets).toBe(10); // Should remain steady if supply matches demand effectively?
        // Anchor 10 P -> Demand 10 P -> Supply 10 P -> Result 10 P

        // Let's verify derived pallets calculation manually
        // Initial: 10 P
        // Demand: 100 Cases / 10 CPP = 10 Pallets loss
        // Supply: 1 Truck * (1000/10/10 = 10 Pallets) = 10 Pallets gain
        // Net: 10 - 10 + 10 = 10. Correct.
    });
});
