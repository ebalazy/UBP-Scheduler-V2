/**
 * MES (Manufacturing Execution System) CSV Parser
 * Flexible parser that auto-detects column names
 */

interface MESRawRow {
    [key: string]: any;
}

export interface ProductionActual {
    date: string;           // ISO date (YYYY-MM-DD)
    product_sku: string;    // Product SKU
    cases: number;          // Cases produced
    bottles?: number;       // Bottles produced (optional)
    shift?: string;         // Shift (if available)
}

export interface MESParseResult {
    success: boolean;
    data: ProductionActual[];
    errors: string[];
    totalRows: number;
    columnMapping: {
        date?: string;
        sku?: string;
        cases?: string;
        bottles?: string;
    };
}

/**
 * Detect if CSV is MES format
 */
export function isMESFormat(headers: string[]): boolean {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    // MES files should have production/date + SKU/product + cases
    const hasDate = lowerHeaders.some(h =>
        h.includes('date') || h.includes('day') || h.includes('production')
    );

    const hasSKU = lowerHeaders.some(h =>
        h.includes('sku') || h.includes('product') || h.includes('item')
    );

    const hasCases = lowerHeaders.some(h =>
        h.includes('case') || h.includes('quantity') || h.includes('produced')
    );

    return hasDate && hasSKU && hasCases;
}

/**
 * Auto-detect column names
 */
function detectColumns(headers: string[]): {
    date?: string;
    sku?: string;
    cases?: string;
    bottles?: string;
    shift?: string;
} {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    return {
        date: headers.find((_h, i) =>
            lowerHeaders[i].includes('production') && lowerHeaders[i].includes('date') ||
            lowerHeaders[i] === 'date' ||
            lowerHeaders[i].includes('run date')
        ),

        sku: headers.find((_h, i) =>
            lowerHeaders[i].includes('product code') ||
            lowerHeaders[i].includes('sku') ||
            lowerHeaders[i] === 'product'
        ),

        cases: headers.find((_h, i) =>
            lowerHeaders[i].includes('cases produced') ||
            lowerHeaders[i].includes('cases') ||
            lowerHeaders[i].includes('quantity')
        ),

        bottles: headers.find((_h, i) =>
            lowerHeaders[i].includes('bottles produced') ||
            lowerHeaders[i].includes('bottles') ||
            lowerHeaders[i].includes('units')
        ),

        shift: headers.find((_h, i) =>
            lowerHeaders[i].includes('shift')
        ),
    };
}

/**
 * Parse various date formats
 */
function parseMESDate(dateStr: string): string | null {
    if (!dateStr) return null;

    try {
        // Try ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0]; // Remove time component
        }

        // Try MM/DD/YYYY
        const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (mdyMatch) {
            const [, month, day, year] = mdyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try DD/MM/YYYY
        const dmyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
            const [, day, month, year] = dmyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try parsing with Date object
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Parse MES data rows
 */
function parseMESRows(
    rows: MESRawRow[],
    columnMapping: ReturnType<typeof detectColumns>
): MESParseResult {
    const errors: string[] = [];
    const data: ProductionActual[] = [];

    rows.forEach((row, index) => {
        const rowNum = index + 2;

        // Parse date
        const dateValue = columnMapping.date ? row[columnMapping.date] : null;
        const date = parseMESDate(dateValue);
        if (!date) {
            errors.push(`Row ${rowNum}: Invalid or missing date "${dateValue}"`);
            return;
        }

        // Parse SKU
        const product_sku = columnMapping.sku ? String(row[columnMapping.sku]).trim() : '';
        if (!product_sku) {
            errors.push(`Row ${rowNum}: Missing product SKU`);
            return;
        }

        // Parse cases
        const casesValue = columnMapping.cases ? row[columnMapping.cases] : null;
        const cases = parseInt(String(casesValue).replace(/,/g, ''), 10);
        if (isNaN(cases)) {
            errors.push(`Row ${rowNum}: Invalid cases value "${casesValue}"`);
            return;
        }

        // Parse bottles (optional)
        const bottlesValue = columnMapping.bottles ? row[columnMapping.bottles] : null;
        const bottles = bottlesValue ? parseInt(String(bottlesValue).replace(/,/g, ''), 10) : undefined;

        // Parse shift (optional)
        const shift = columnMapping.shift ? String(row[columnMapping.shift]).trim() : undefined;

        data.push({
            date,
            product_sku,
            cases,
            bottles,
            shift,
        });
    });

    return {
        success: errors.length === 0,
        data,
        errors,
        totalRows: rows.length,
        columnMapping,
    };
}

/**
 * Main entry point: parse MES CSV
 */
export function parseMES(csvData: string): MESParseResult {
    try {
        // Parse CSV to objects
        const Papa = require('papaparse');
        const parsed = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
        });

        if (parsed.errors.length > 0) {
            return {
                success: false,
                data: [],
                errors: parsed.errors.map((e: any) => e.message),
                totalRows: 0,
                columnMapping: {},
            };
        }

        const headers = parsed.meta.fields || [];

        // Check if it's MES format
        if (!isMESFormat(headers)) {
            return {
                success: false,
                data: [],
                errors: ['Not a valid MES export format. Expected columns with date, product/SKU, and cases.'],
                totalRows: 0,
                columnMapping: {},
            };
        }

        // Detect columns
        const columnMapping = detectColumns(headers);

        if (!columnMapping.date || !columnMapping.sku || !columnMapping.cases) {
            return {
                success: false,
                data: [],
                errors: [
                    'Could not auto-detect required columns.',
                    `Detected: date=${columnMapping.date}, sku=${columnMapping.sku}, cases=${columnMapping.cases}`,
                    'Please verify CSV format.',
                ],
                totalRows: 0,
                columnMapping,
            };
        }

        // Parse the data
        return parseMESRows(parsed.data, columnMapping);

    } catch (error) {
        return {
            success: false,
            data: [],
            errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`],
            totalRows: 0,
            columnMapping: {},
        };
    }
}
