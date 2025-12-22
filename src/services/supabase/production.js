import { supabase } from './client';

export const TABLE_NAME = 'production_runs';

/**
 * Fetch runs within a date range (plus buffer)
 * @param {string} dateStrISO - Start date ISO string
 * @param {number} days - Number of days to look ahead
 */
export async function fetchRunsByDateRange(dateStrISO, days = 45) {
    const startDate = new Date(dateStrISO);
    // Buffer: 1 week before to catch long running jobs
    const bufferStart = new Date(startDate);
    bufferStart.setDate(bufferStart.getDate() - 7);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .gte('start_time', bufferStart.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching production runs:', error);
        return [];
    }

    return data || [];
}

/**
 * Upsert (Insert or Update) a production run
 * @param {Object} run - Production run object
 */
export async function upsertRun(run) {
    // Convert to DB casing if needed (snake_case)
    // Map JS camelCase to snake_case for DB
    const dbPayload = {
        id: run.id,
        sku: run.sku,
        line_id: run.lineId,
        start_time: run.startTime,
        duration_hours: run.durationHours,
        target_cases: run.targetCases,
        status: run.status,
        // Calculate End Time
        end_time: calculateEndTime(run.startTime, run.durationHours),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert(dbPayload)
        .select()
        .single();

    if (error) {
        throw error;
    }

    // Map back to JS
    return mapToAppModel(data);
}

/**
 * Delete a production run
 * @param {string} id 
 */
export async function deleteRun(id) {
    const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

    if (error) throw error;
}

/**
 * Helper: Map DB snake_case to App camelCase
 * Note: color is looked up from ProductsContext by SKU name at render time
 */
function mapToAppModel(dbRecord) {
    return {
        id: dbRecord.id,
        sku: dbRecord.sku,
        lineId: dbRecord.line_id,
        startTime: dbRecord.start_time,
        durationHours: dbRecord.duration_hours,
        targetCases: dbRecord.target_cases,
        status: dbRecord.status
    };
}

function calculateEndTime(startTime, hours) {
    const d = new Date(startTime);
    d.setTime(d.getTime() + (hours * 60 * 60 * 1000));
    return d.toISOString();
}
