/**
 * Calculates the estimated delivery time based on production rate and truck position.
 * 
 * @param {number} index - The 0-based index of the truck for the day (0 = 1st truck).
 * @param {string} shiftStartTime - The start time of the shift (e.g., "06:00").
 * @param {number} bottlesPerTruck - Number of bottles in a full truck.
 * @param {number} productionRate - Bottles (or cases) per hour consumption rate.
 * @param {number} bottlesPerCase - Scaling factor if rate is in cases (optional, defaults to 1 if rate is bottles).
 * @returns {string} - The calculated time in "HH:MM" (24-hour) format.
 */
export const calculateDeliveryTime = (index, shiftStartTime = '00:00', bottlesPerTruck, productionRate, bottlesPerCase = 1) => {
    if (!productionRate || productionRate <= 0) return ''; // Cannot calculate without rate

    // Normalize inputs
    // If rate is very small (< 5000), assume it is Cases Per Hour.
    // If bottlesPerTruck is large (> 20000), we know we need to convert.
    // However, usually SettingsContext provides standardized units. 
    // Let's assume input 'productionRate' matches 'bottlesPerTruck' unit OR we use bottlesPerCase.

    // Logic from ScheduleManagerModal:
    // const capacity = specs.casesPerTruck || (specs.bottlesPerTruck / specs.bottlesPerCase);
    // const rate = specs.productionRate; // Cases per Hour

    // We'll calculate in Hours.
    // Capacity (Units) / Rate (Units/Hr) = Hours per Truck.

    // Safeguard:
    let effectiveRate = productionRate;
    let effectiveCapacity = bottlesPerTruck;

    // Heuristic: If rate is CPH and Capacity is Bottles, convert Capacity to Cases.
    if (bottlesPerCase > 1 && productionRate < 10000 && bottlesPerTruck > 20000) {
        effectiveCapacity = bottlesPerTruck / bottlesPerCase;
    }

    const hoursPerTruck = effectiveCapacity / effectiveRate;

    // Parse Start Time
    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const startDecimal = (startH || 0) + ((startM || 0) / 60);

    // Calculate Arrival: Start + (Index * Interval)
    const arrivalDecimal = startDecimal + (index * hoursPerTruck);

    // Normalize to 24h
    let normalized = arrivalDecimal % 24;
    if (normalized < 0) normalized += 24;

    const h = Math.floor(normalized);
    const m = Math.round((normalized - h) * 60);

    // Handle minute rollover
    const finalH = (h + Math.floor(m / 60)) % 24;
    const finalM = m % 60;

    // Format HH:MM
    const hStr = String(finalH).padStart(2, '0');
    const mStr = String(finalM).padStart(2, '0');

    return `${hStr}:${mStr}`;
};
