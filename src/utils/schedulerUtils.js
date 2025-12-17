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
/**
 * Calculates the estimated delivery time.
 * Supports "Compression" to fit all trucks within 24h (ignoring run rate) if demand is high.
 */
export const calculateDeliveryTime = (index, shiftStartTime = '00:00', bottlesPerTruck, productionRate, bottlesPerCase = 1, totalTrucksForDay = 0) => {
    if (!productionRate || productionRate <= 0) return '';

    let effectiveRate = productionRate;
    let effectiveCapacity = bottlesPerTruck;

    // Heuristic: Auto-detect Case/Bottle mismatch
    if (bottlesPerCase > 1 && productionRate < 10000 && bottlesPerTruck > 20000) {
        effectiveCapacity = bottlesPerTruck / bottlesPerCase;
    }

    // Standard Spacing (Hours based on Run Rate)
    const standardHoursPerTruck = effectiveCapacity / effectiveRate;

    // Compressed Spacing (If needed to fit all trucks in 24h)
    // If we have 30 trucks, we can't space them 2 hours apart. We must space them 0.8 hours apart.
    let actualHoursPerTruck = standardHoursPerTruck;

    if (totalTrucksForDay > 0) {
        // Available window: 24 hours (minus a little buffer? say 23h to be safe)
        const availableHours = 23.5;
        const neededHours = totalTrucksForDay * standardHoursPerTruck;

        if (neededHours > availableHours) {
            // COMPRESS: Ignore run rate, squeeze them in.
            // New Interval = Available / Count
            actualHoursPerTruck = availableHours / totalTrucksForDay;
        }
    }

    // Parse Start Time
    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const startDecimal = (startH || 0) + ((startM || 0) / 60);

    // Calculate Arrival
    const arrivalDecimal = startDecimal + (index * actualHoursPerTruck);

    // Normalize to 24h
    let normalized = arrivalDecimal % 24;
    if (normalized < 0) normalized += 24;

    const h = Math.floor(normalized);
    const m = Math.round((normalized - h) * 60);

    const finalH = (h + Math.floor(m / 60)) % 24;
    const finalM = m % 60;

    return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
};
