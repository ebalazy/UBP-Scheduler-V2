/**
 * JIT Scheduler Utility
 * Calculates arrival times for orders based on "Feed the Machine" logic.
 * 
 * Logic:
 * 1. Start at Shift Start Time (e.g. 06:00).
 * 2. Calculate duration of each load based on Burn Rate (Bottles/Truck / CPH).
 * 3. Schedule next arrival exactly when the previous one runs out.
 * 4. Round the *Appointment Time* to the nearest hour for clean slots.
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
        // 1. Sort by PO Number Ascending (User Request: Sequential Order)
        dayOrders.sort((a, b) => {
            // Try numeric sort if possible (clean non-digits), else string
            const poA = a.po ? String(a.po).replace(/\D/g, '') : '';
            const poB = b.po ? String(b.po).replace(/\D/g, '') : '';
            if (poA && poB) {
                return Number(poA) - Number(poB);
            }
            return (a.po || '').localeCompare(b.po || '');
        });

        // 2. Initialize Start Time
        let [startH, startM] = (settings.schedulerSettings?.shiftStartTime || '06:00').split(':').map(Number);

        // Track EXACT consumption time (The "Running Clock")
        let exactTime = new Date();
        exactTime.setHours(startH, startM, 0, 0);

        dayOrders.forEach(order => {
            const sku = order.sku || Object.keys(settings.bottleDefinitions)[0]; // Fallback
            const specs = settings.bottleDefinitions[sku];

            // 3. Assign Current Slot (Rounded to Nearest Hour for the Appointment)
            const bookingDate = new Date(exactTime);
            if (bookingDate.getMinutes() >= 30) {
                bookingDate.setHours(bookingDate.getHours() + 1);
            }
            bookingDate.setMinutes(0);

            const timeStr = bookingDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            scheduledOrders.push({
                ...order,
                time: timeStr
            });

            if (!specs) return; // Cannot advance accurately without specs

            // 4. Advance Exact Counter based on Burn Rate
            // Duration = Total Bottles / Run Rate CPH
            const totalBottles = (order.qty || 1) * (specs.bottlesPerTruck || 20000);
            const rate = specs.productionRate || 1000;
            const durationHours = totalBottles / rate;
            const durationMinutes = durationHours * 60;

            // Add burn time to the running clock
            exactTime.setMinutes(exactTime.getMinutes() + durationMinutes);
        });
    });

    return scheduledOrders;
};
