/**
 * @typedef {Object} ProductionRun
 * @property {string} id
 * @property {string} sku
 * @property {string} lineId
 * @property {string} startTime - ISO String
 * @property {number} durationHours
 * @property {number} targetCases
 * @property {string} status - 'planned' | 'running' | 'completed' | 'maintenance'
 * @property {string} color - Tailwind Class
 */

export const PRODUCTION_LINES = [
    { id: 'L1', name: 'Line 1 (High Speed)' },
    { id: 'L2', name: 'Line 2 (Flex)' },
    { id: 'L3', name: 'Line 3 (Manual)' }
];

export const SKUS = [
    { id: '20oz', color: 'bg-blue-500' },
    { id: '2L', color: 'bg-indigo-500' },
    { id: '1L', color: 'bg-purple-500' },
    { id: '12pk', color: 'bg-emerald-500' }
];

export function generateMockRuns(dateStr) {
    const runs = [];
    const baseDate = new Date(dateStr);

    // Mock Schedule
    // Line 1: 20oz all day
    runs.push({
        id: 'run-1',
        sku: '20oz',
        lineId: 'L1',
        startTime: new Date(baseDate.setHours(6, 0, 0, 0)).toISOString(),
        durationHours: 8,
        targetCases: 12000,
        status: 'running',
        color: 'bg-blue-500'
    });

    // Line 1: 2L Night shift
    runs.push({
        id: 'run-2',
        sku: '2L',
        lineId: 'L1',
        startTime: new Date(baseDate.setHours(14, 0, 0, 0)).toISOString(),
        durationHours: 8,
        targetCases: 5000,
        status: 'planned',
        color: 'bg-indigo-500'
    });

    // Line 2: Maintenance then 1L
    runs.push({
        id: 'run-3',
        sku: 'MAINT',
        lineId: 'L2',
        startTime: new Date(baseDate.setHours(8, 0, 0, 0)).toISOString(),
        durationHours: 4,
        targetCases: 0,
        status: 'maintenance',
        color: 'bg-gray-400'
    });

    runs.push({
        id: 'run-4',
        sku: '1L',
        lineId: 'L2',
        startTime: new Date(baseDate.setHours(13, 0, 0, 0)).toISOString(),
        durationHours: 6,
        targetCases: 8000,
        status: 'planned',
        color: 'bg-purple-500'
    });

    return runs;
}

export function getHoursFromISO(isoString) {
    const d = new Date(isoString);
    return d.getHours() + (d.getMinutes() / 60);
}
