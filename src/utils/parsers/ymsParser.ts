/**
 * YMS Hub CSV Parser
 * Parses ymshub.com export files and extracts truck arrival data
 */

// YMS export format uses these columns:
// - Ref#1: PO Number
// - Arrival Date: When truck arrived
// - Open Status: "Complete" when checked in
// - Sub Load Type: Product description (SKU extraction)

export interface InboundReceipt {
    date: string;              // ISO date (YYYY-MM-DD)
    po_number: string;         // From Ref1
    product_sku: string;       // Extracted from Description SubLoad Type
    location: 'yard' | 'dock'; // Default to 'yard'
    loads: number;             // Default 1 per row
    yms_reference?: string;    // Trailer number if available
    checked_in_at?: string;    // ISO timestamp
    status: string;            // Original status
}

export interface ParseResult {
    success: boolean;
    data: InboundReceipt[];
    errors: string[];
    skipped: number;
    totalRows: number;
}

/**
 * Detect if CSV is YMS format
 */
export function isYMSFormat(headers: string[]): boolean {
    console.log('Checking YMS format. Headers found:', headers);

    const requiredColumns = ['ref #1', 'arrival date', 'open status'];
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    console.log('Lower headers:', lowerHeaders);

    const matches = requiredColumns.map(col => {
        const found = lowerHeaders.some(h => h.includes(col));
        console.log(`Looking for "${col}": ${found}`);
        return found;
    });

    const isValid = matches.every(m => m);
    console.log('YMS format valid:', isValid);

    return isValid;
}

/**
 * Extract SKU from "Sub Load Type" field
 * Examples:
 *   "Vitamin Water 16.9oz" -> "16.9oz"
 *   "Vitamin Water 20oz" -> "20oz"
 */
function extractSKU(description: string): string {
    if (!description) return 'Unknown';

    // Look for common patterns
    const patterns = [
        /(\d+\.?\d*\s?oz)/i,      // "16.9oz", "20 oz"
        /(\d+\s?liter)/i,         // "1 liter", "2liter"
        /(bottle|can)/i,          // Generic "bottle" or "can"
    ];

    for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }

    // Fallback: return full description
    return description.trim();
}

/**
 * Parse date from YMS format (appears to be MM/DD/YYYY HH:MM)
 */
function parseYMSDate(dateStr: string): { date: string; timestamp: string } | null {
    if (!dateStr) return null;

    try {
        // Try parsing MM/DD/YYYY HH:MM format
        const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (!match) return null;

        const [, month, day, year, hour = '00', minute = '00'] = match;

        // Create ISO date string
        const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const timestamp = `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;

        return { date, timestamp };
    } catch (error) {
        console.error('Error parsing YMS date:', dateStr, error);
        return null;
    }
}

/**
 * Parse YMS CSV data
 */
export function parseYMSData(rows: any[]): ParseResult {
    const errors: string[] = [];
    const data: InboundReceipt[] = [];
    let skipped = 0;

    rows.forEach((row, index) => {
        const rowNum = index + 2; // +2 for header + 1-indexed

        // Skip rows that aren't "Complete" (YMS shows Complete when truck is checked in)
        const status = row['Open Status'] || '';
        if (!status.toLowerCase().includes('complete')) {
            skipped++;
            return;
        }

        // Parse date from Arrival Date
        const parsedDate = parseYMSDate(row['Arrival Date']);
        if (!parsedDate) {
            errors.push(`Row ${rowNum}: Invalid date format "${row['Arrival Date']}"`);
            return;
        }

        // Extract PO from Ref#1
        const po_number = row['Ref#1']?.trim();
        if (!po_number) {
            errors.push(`Row ${rowNum}: Missing PO (Ref#1)`)
                ;
            return;
        }

        // Extract SKU from Sub Load Type
        const product_sku = extractSKU(row['Sub Load Type']);
        if (product_sku === 'Unknown') {
            errors.push(`Row ${rowNum}: Could not extract SKU from "${row['Sub Load Type']}"`);
            // Continue anyway with "Unknown"
        }

        // Build receipt
        const receipt: InboundReceipt = {
            date: parsedDate.date,
            po_number,
            product_sku,
            location: 'yard', // Default to yard
            loads: 1,
            yms_reference: row['Trailer']?.trim(),
            checked_in_at: parsedDate.timestamp,
            status: status,
        };

        data.push(receipt);
    });

    return {
        success: errors.length === 0,
        data,
        errors,
        skipped,
        totalRows: rows.length,
    };
}

/**
 * Main entry point: parse YMS CSV
 */
export function parseYMS(csvData: string): ParseResult {
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
                skipped: 0,
                totalRows: 0,
            };
        }

        // Check if it's YMS format
        if (!isYMSFormat(parsed.meta.fields || [])) {
            return {
                success: false,
                data: [],
                errors: ['Not a valid YMS export format. Missing required columns: Ref#1, Arrival Date, Open Status'],
                skipped: 0,
                totalRows: 0,
            };
        }

        // Parse the data
        return parseYMSData(parsed.data);

    } catch (error) {
        return {
            success: false,
            data: [],
            errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`],
            skipped: 0,
            totalRows: 0,
        };
    }
}
