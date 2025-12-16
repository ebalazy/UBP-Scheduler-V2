import { z } from 'zod';

export const ProductSchema = z.object({
    name: z.string().min(1, "SKU Name is required"),
    bottlesPerCase: z.number().min(1),
    bottlesPerTruck: z.number().min(1),
    casesPerPallet: z.number().min(1),
    scrapPercentage: z.number().min(0).default(0)
});

export const PlanningEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    type: z.enum(['demand_plan', 'inbound_trucks', 'production_actual', 'truck_manifest_json']),
    value: z.number(), // Can be negative? usually not for these types but allow for adjustments
    metaJson: z.any().optional()
});

export const ProductionSettingsSchema = z.object({
    productionRate: z.number().min(0),
    downtimeHours: z.number().min(0),
    isAutoReplenish: z.boolean().optional()
});

export const InventorySnapshotSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    count: z.number().min(0),
    location: z.enum(['floor', 'yard'])
});
