/**
 * Supabase service functions for CSV imports
 */

import { supabase } from './client';
import type { InboundReceipt } from '../../utils/parsers/ymsParser';
import type { ProductionActual } from '../../utils/parsers/mesParser';

export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
}

/**
 * Import inbound truck receipts from YMS
 */
export async function importInboundReceipts(
    receipts: InboundReceipt[]
): Promise<ImportResult> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
        // Get product mapping (SKU -> product_id)
        const { data: products } = await supabase
            .from('products')
            .select('id, sku, name');

        const productMap = new Map(
            products?.map(p => [p.sku?.toLowerCase(), p.id]) || []
        );

        // Transform receipts to database format
        const dbReceipts = receipts.map(receipt => {
            // Try to find product by SKU
            let product_id = productMap.get(receipt.product_sku.toLowerCase());

            // Fallback: try partial match (e.g., "16.9oz" matches "16.9")
            if (!product_id) {
                const partialMatch = Array.from(productMap.entries()).find(([sku]) =>
                    receipt.product_sku.toLowerCase().includes(sku) ||
                    sku.includes(receipt.product_sku.toLowerCase())
                );
                product_id = partialMatch?.[1];
            }

            return {
                date: receipt.date,
                po_number: receipt.po_number,
                product_id,
                loads: receipt.loads,
                location: receipt.location,
                yms_reference: receipt.yms_reference,
                checked_in_at: receipt.checked_in_at,
                status: receipt.status,
                import_source: 'yms',
            };
        });

        // Upsert to database (on conflict, do nothing to avoid duplicates)
        const { data, error } = await supabase
            .from('inbound_receipts')
            .upsert(dbReceipts, {
                onConflict: 'date,po_number',
                ignoreDuplicates: true,
            })
            .select();

        if (error) {
            errors.push(`Database error: ${error.message}`);
            failed = receipts.length;
        } else {
            imported = data?.length || 0;
            skipped = receipts.length - imported;
        }

        // Log import
        await logImport('yms', {
            rows_total: receipts.length,
            rows_imported: imported,
            rows_skipped: skipped,
            rows_failed: failed,
            error_details: errors.length > 0 ? { errors } : null,
        });

        return {
            success: errors.length === 0,
            imported,
            skipped,
            failed,
            errors,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            imported: 0,
            skipped: 0,
            failed: receipts.length,
            errors: [errorMsg],
        };
    }
}

/**
 * Import production actuals from MES
 */
export async function importProductionActuals(
    actuals: ProductionActual[]
): Promise<ImportResult> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
        // Get product mapping
        const { data: products } = await supabase
            .from('products')
            .select('id, sku, name');

        const productMap = new Map(
            products?.map(p => [p.sku?.toLowerCase(), p.id]) || []
        );

        // Transform actuals to database format
        const dbActuals = actuals.map(actual => {
            // Find product by SKU
            let product_id = productMap.get(actual.product_sku.toLowerCase());

            // Fallback: partial match
            if (!product_id) {
                const partialMatch = Array.from(productMap.entries()).find(([sku]) =>
                    actual.product_sku.toLowerCase().includes(sku) ||
                    sku.includes(actual.product_sku.toLowerCase())
                );
                product_id = partialMatch?.[1];
            }

            return {
                date: actual.date,
                product_id,
                cases: actual.cases,
                bottles: actual.bottles,
                shift: actual.shift || 'day',
                import_source: 'mes',
            };
        });

        // Upsert to database
        const { data, error } = await supabase
            .from('production_actuals')
            .upsert(dbActuals, {
                onConflict: 'date,product_id,shift',
                ignoreDuplicates: false, // Update if exists
            })
            .select();

        if (error) {
            errors.push(`Database error: ${error.message}`);
            failed = actuals.length;
        } else {
            imported = data?.length || 0;
            skipped = actuals.length - imported;
        }

        // Log import
        await logImport('mes', {
            rows_total: actuals.length,
            rows_imported: imported,
            rows_skipped: skipped,
            rows_failed: failed,
            error_details: errors.length > 0 ? { errors } : null,
        });

        return {
            success: errors.length === 0,
            imported,
            skipped,
            failed,
            errors,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            imported: 0,
            skipped: 0,
            failed: actuals.length,
            errors: [errorMsg],
        };
    }
}

/**
 * Log import to audit trail
 */
async function logImport(
    type: 'yms' | 'mes',
    data: {
        file_name?: string;
        rows_total: number;
        rows_imported: number;
        rows_skipped: number;
        rows_failed: number;
        error_details?: any;
    }
) {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('import_log').insert({
            import_type: type,
            ...data,
            imported_by: user?.id,
        });
    } catch (error) {
        console.error('Failed to log import:', error);
    }
}

/**
 * Get import history
 */
export async function getImportHistory(limit = 50) {
    const { data, error } = await supabase
        .from('import_log')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to fetch import history:', error);
        return [];
    }

    return data || [];
}
