import Papa from 'papaparse';

export interface SAPInboundRow {
    dueDate: string;          // ISO format YYYY-MM-DD
    deliveryDate: string;     // ISO format YYYY-MM-DD
    plant: string;
    vendorName: string;
    poNumber: string;
    material: string;
    materialDescription: string;
    openQty: number;
    scheduledQty: number;
    receivedQty: number;
    materialDoc: string;
    grBatch: string;
}

export interface SAPParseResult {
    success: boolean;
    data: SAPInboundRow[];
    errors: string[];
    totalRows: number;
}

/**
 * Check if CSV headers match SAP inbound shipment format
 */
export function isSAPFormat(headers: string[]): boolean {
    const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

    // Key SAP columns that must be present
    const requiredColumns = [
        'due date',
        'purch doc',
        'material',
        'scheduled qty'
    ];

    return requiredColumns.every(col =>
        normalizedHeaders.some(h => h.includes(col.toLowerCase()))
    );
}

/**
 * Parse SAP inbound shipment CSV export
 */
export function parseSAP(csvText: string): SAPParseResult {
    const result: SAPParseResult = {
        success: true,
        data: [],
        errors: [],
        totalRows: 0,
    };

    try {
        // DEBUG: Log what we're receiving
        console.log('[SAP Parser] Received text (first 500 chars):', csvText.substring(0, 500));

        // Auto-detect delimiter (pipe or comma)
        const delimiter = csvText.includes('|') ? '|' : ',';

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            delimiter: delimiter,
            transformHeader: (header: string) => header.trim(),
        });

        result.totalRows = parsed.data.length;

        parsed.data.forEach((row: any, index: number) => {
            try {
                // DEBUG: Log first row to see structure
                if (index === 0) {
                    console.log('[SAP Parser DEBUG] First row keys:', Object.keys(row));
                    console.log('[SAP Parser DEBUG] First row data:', row);
                    console.log('[SAP Parser DEBUG] Due Date value:', row['Due Date']);
                    console.log('[SAP Parser DEBUG] Stat. Delivery Date value:', row['Stat. Delivery Date']);
                }

                // Parse date (MM/DD/YYYY to YYYY-MM-DD)
                const parseDateToISO = (dateStr: string): string => {
                    if (!dateStr || dateStr.trim() === '') return '';

                    // Handle MM/DD/YYYY format
                    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                    if (match) {
                        const month = match[1].padStart(2, '0');
                        const day = match[2].padStart(2, '0');
                        const year = match[3];
                        return `${year}-${month}-${day}`;
                    }

                    result.errors.push(`Row ${index + 1}: Invalid date format: ${dateStr}`);
                    return '';
                };

                // Parse quantity (remove commas and convert to number)
                const parseQty = (qtyStr: string): number => {
                    if (!qtyStr || qtyStr.trim() === '') return 0;
                    const cleaned = qtyStr.replace(/,/g, '');
                    const num = parseFloat(cleaned);
                    return isNaN(num) ? 0 : num;
                };

                const dueDate = parseDateToISO(row['Due Date']);
                const deliveryDate = parseDateToISO(row['Stat. Delivery Date']);
                const scheduledQty = parseQty(row['Scheduled Qty']);

                // Skip rows without essential data
                if (!dueDate && !deliveryDate) {
                    result.errors.push(`Row ${index + 1}: Missing delivery date`);
                    return;
                }

                if (!row['Purch Doc.'] || row['Purch Doc.'].trim() === '') {
                    result.errors.push(`Row ${index + 1}: Missing PO number`);
                    return;
                }

                if (scheduledQty === 0) {
                    result.errors.push(`Row ${index + 1}: Zero scheduled quantity`);
                    return;
                }

                result.data.push({
                    dueDate: dueDate || deliveryDate,
                    deliveryDate: deliveryDate || dueDate,
                    plant: (row['Plnt'] || '').trim(),
                    vendorName: (row['Vendor Name'] || '').trim(),
                    poNumber: (row['Purch Doc.'] || '').trim(),
                    material: (row['Material'] || '').trim(),
                    materialDescription: (row['Material Description'] || '').trim(),
                    openQty: parseQty(row['Open Qty']),
                    scheduledQty: scheduledQty,
                    receivedQty: parseQty(row['Qty Received(GR Qty)']),
                    materialDoc: (row['Mat. Doc.'] || '').trim(),
                    grBatch: (row['GR Batch'] || '').trim(),
                });
            } catch (error) {
                result.errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
            }
        });

        if (result.data.length === 0) {
            result.success = false;
            result.errors.push('No valid rows found in SAP export');
        }

    } catch (error) {
        result.success = false;
        result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
}

/**
 * Map SAP material code to product SKU
 * Example: 1855526 -> 20oz
 */
export function mapMaterialToSKU(materialCode: string, materialDescription: string): string {
    const code = materialCode.trim();
    const desc = materialDescription.toUpperCase();

    // Add your material code mappings here
    const materialMap: Record<string, string> = {
        '1855526': '20oz',  // BTL 20OZ GLC VWTR POWERSTRAP
        // Add more mappings as needed
    };

    if (materialMap[code]) {
        return materialMap[code];
    }

    // Try to detect from description
    if (desc.includes('20OZ')) return '20oz';
    if (desc.includes('16.9OZ')) return '16.9oz';
    if (desc.includes('12OZ')) return '12oz';

    // Return material code if no mapping found
    return code;
}
