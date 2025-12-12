import { saveAs } from 'file-saver';

export default function DeliveryTable({ schedule, truckSchedule, onUpdatePO, onDelete, specs }) {

    const generateTimestamps = (shiftName, loads) => {
        // Legacy generation kept for fallback or verifying shift distribution
        if (!loads || loads === 0) return [];
        let startHour = 0;
        if (shiftName.includes('08:00-16:00')) startHour = 8;
        else if (shiftName.includes('16:00-00:00')) startHour = 16;
        else startHour = 0;
        const shiftDuration = 8;
        const interval = shiftDuration / loads;
        const times = [];
        for (let i = 0; i < loads; i++) {
            const hourDecimal = startHour + (interval * i);
            const normalized = hourDecimal % 24;
            // Rounded to nearest hour to match main schedule
            const hour = Math.round(normalized);
            const safeHour = hour === 24 ? 0 : hour;
            const hStr = safeHour.toString().padStart(2, '0');
            const mStr = "00";
            times.push(`${hStr}:${mStr}`);
        }
        return times;
    };

    const getExportData = () => {
        if (!truckSchedule || truckSchedule.length === 0) return [];
        return truckSchedule.map(truck => {
            const bottleSize = specs ? specs.name : 'Unknown';
            // Cases removed as per request
            const pallets = specs ? specs.palletsPerTruck : 0;
            // Determine shift based on time
            const [h] = truck.time.split(':').map(Number);
            let shift = 'Unknown';
            if (h >= 0 && h < 8) shift = 'Shift 1';
            else if (h >= 8 && h < 16) shift = 'Shift 2';
            else shift = 'Shift 3';

            return {
                LoadID: truck.id,
                Time: truck.time,
                Shift: shift,
                PO: truck.po || '',
                BottleSize: bottleSize,
                Pallets: pallets
            };
        });
    };

    const getExportFilename = (extension) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        return `Schedule_Report_${year}-${month}-${day}_${hour}${minute}.${extension}`;
    };



    const handleExportCSV = () => {
        try {
            const data = getExportData();
            if (!data || data.length === 0) {
                alert("No schedule data to export. Please generate a schedule first.");
                return;
            }

            // CSV Header
            const headers = ["Load ID", "Delivery Time", "Shift", "PO Number", "Bottle Size", "Pallets"];
            // Add BOM for Excel compatibility with UTF-8
            let csvContent = "\uFEFF" + headers.join(",") + "\n";

            // CSV Rows
            data.forEach(row => {
                // Robust string conversion to prevent errors
                const po = String(row.PO || '').replace(/"/g, '""');
                const rowStr = [
                    row.LoadID,
                    row.Time,
                    row.Shift,
                    `"${po}"`,
                    row.BottleSize,
                    row.Pallets
                ].join(",");
                csvContent += rowStr + "\n";
            });

            const filename = getExportFilename("csv");
            console.log(`Exporting ${data.length} rows to ${filename}`);

            // Use file-saver for robust cross-browser saving
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
            saveAs(blob, filename);

        } catch (error) {
            console.error("Export failed:", error);
            alert(`Export failed: ${error.message}`);
        }
    };



    return (
        <div className="space-y-6">

            {/* Detailed Truck Schedule */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-indigo-100 dark:border-indigo-900 transition-colors">
                <div className="bg-indigo-600 dark:bg-indigo-700 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span>📋 Exact Truck Schedule</span>
                        <span className="text-xs font-normal bg-indigo-500 px-2 py-1 rounded">Auto-Generated (Rounded)</span>
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-3 rounded shadow transition-colors flex items-center gap-1"
                            title="Export to CSV"
                        >
                            <span>📄</span> Export CSV
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-gray-900/50">
                    <div className="flex flex-col gap-2">
                        {truckSchedule && truckSchedule.length > 0 ? (
                            truckSchedule.map((truck) => (
                                <div key={truck.id} className="bg-white dark:bg-gray-800 px-4 py-3 rounded shadow-sm border border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-4 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold w-8 h-8 flex items-center justify-center rounded-full text-sm">
                                            {truck.id}
                                        </div>
                                        <span className="text-xl font-mono text-gray-800 dark:text-white font-bold">{truck.time}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 flex-grow w-full sm:max-w-xs">
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold whitespace-nowrap">PO #</label>
                                        <input
                                            type="text"
                                            placeholder="Enter PO..."
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base sm:text-sm"
                                            value={truck.po}
                                            onChange={(e) => onUpdatePO(truck.id, e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => onDelete(truck.id)}
                                        className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                                        title="Remove Load"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))
                        ) : (
                            <span className="text-gray-500 italic p-2">Enter production requirements to generate schedule.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Breakdown (Legacy) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border dark:border-gray-700">
                <h3 className="bg-gray-800 dark:bg-gray-900 text-white p-4 font-bold text-lg">Shift Verification (Load Balancing)</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loads Required</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approximate Timing</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {schedule.map((shift, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/30'}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 border-r dark:border-gray-700">
                                        {shift.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-blue-600 dark:text-blue-400 border-r dark:border-gray-700 text-center w-32">
                                        {shift.loads}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {shift.loads > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {generateTimestamps(shift.name, shift.loads).map((time, tIdx) => (
                                                    <span key={tIdx} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md font-mono text-xs">
                                                        {time}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 dark:text-gray-500 italic">No deliveries</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
