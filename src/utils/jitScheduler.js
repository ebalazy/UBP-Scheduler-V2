/**
 * JIT Scheduler Utility
 * Calculates arrival times for orders based on "Feed the Machine" logic.
 * 
 * Logic:
 * 1. Start at Shift Start Time (e.g. 06:00).
 * 2. Calculate duration of each load: (Truck_Qty * Bottles_Per_Truck) / Production_Rate_CPH.
 * 3. Next arrival = Previous Arrival + Duration.
 */

export const calculateJITSchedule = (orders, settings) => {
    // settings: { bottleDefinitions, schedulerSettings: { shiftStartTime } }

    // Group by Date
    const byDate = {};
    orders.forEach(o => {
        if (!byDate[o.date]) byDate[o.date] = [];
        byDate[o.date].push(o);
    });

    const scheduledOrders = [];

    Object.entries(byDate).forEach(([date, dayOrders]) => {
        // Sort? Assuming import order is sequence for now.
        // Or we could sort by existing time if present? 
        // For bulk import, we assume list order = arrival order preference.

        let currentTime = settings.schedulerSettings?.shiftStartTime || '06:00';

        // Helper to add minutes to HH:mm
        const addMinutes = (timeStr, minutes) => {
            const [h, m] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(h, m, 0, 0);
            date.setMinutes(date.getMinutes() + minutes);
            return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        };

        dayOrders.forEach(order => {
            // Determine SKU specs
            const sku = order.sku || Object.keys(settings.bottleDefinitions)[0]; // Fallback to first if missing
            const specs = settings.bottleDefinitions[sku];

            if (!specs) {
                // No specs, cannot calc. Keep original or default?
                // Use original calculation if possible, else just keep current time.
                scheduledOrders.push({ ...order, time: currentTime });
                return;
            }

            // Calc Duration
            // Qty = Trucks
            // Bottles = Qty * bottlesPerTruck
            // Duration Hours = Bottles / productionRate
            const totalBottles = (order.qty || 1) * (specs.bottlesPerTruck || 20000);
            const rate = specs.productionRate || 1000;
            const durationHours = totalBottles / rate;
            const durationMinutes = Math.round(durationHours * 60);

            // Assign Time
            const assignedTime = currentTime;

            // Advance Time for NEXT order
            currentTime = addMinutes(currentTime, durationMinutes);

            scheduledOrders.push({
                ...order,
                time: assignedTime,
                _debug_duration: durationMinutes // Helpful for verification
            });
        });
    });

    return scheduledOrders;
};
