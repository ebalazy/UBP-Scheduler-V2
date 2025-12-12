import { useState, useMemo } from 'react';
import {
    ClockIcon,
    TruckIcon,
    ExclamationTriangleIcon,
    ClipboardDocumentCheckIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

const MOCK_DATA = {
    lines: [
        {
            id: "L1",
            name: "Line 1 (Bottles)",
            burn_rate_minutes: 60, // 1 truck per hour
            inventory_pallets: 132,
            current_sku: "20oz_Cola",
            color: "blue"
        },
        {
            id: "L2",
            name: "Line 2 (Cans)",
            burn_rate_minutes: 120, // 1 truck per 2 hours
            inventory_pallets: 14, // Critical < 4h? 
            current_sku: "12oz_Sprite",
            color: "purple"
        }
    ],
    yard_status: {
        total_slots: 50,
        used_slots: 42,
        checked_in_trailers: ["PO_9901", "PO_9902"]
    }
};

export default function CockpitView({ mrpData, schedulerData }) {
    // Derive Line 1 Data from MRP Context
    const line1Data = useMemo(() => {
        if (!mrpData?.results) return MOCK_DATA.lines[0];

        const { formState, results } = mrpData;
        const { productionRate } = formState; // Cases/Hr
        const { specs, calculatedPallets } = results;

        // Calculate Burn Rate (Minutes per Truck)
        // Rate = Cases/Hr * Bottles/Case = Bottles/Hr
        // Trucks/Hr = Bottles/Hr / Bottles/Truck
        // Mins/Truck = 60 / Trucks/Hr
        let burnRateMins = 0;
        if (productionRate > 0 && specs) {
            const bottlesPerHour = productionRate * specs.bottlesPerCase;
            const trucksPerHour = bottlesPerHour / specs.bottlesPerTruck;
            if (trucksPerHour > 0) burnRateMins = Math.round(60 / trucksPerHour);
        }

        return {
            id: "L1",
            name: "Production Line 1",
            burn_rate_minutes: burnRateMins || 60, // Default if 0
            inventory_pallets: Math.round(calculatedPallets || 0),
            current_sku: formState.selectedSize,
            color: "blue"
        };
    }, [mrpData]);

    // Merge Real Line 1 with Mock Line 2
    const currentLines = [
        line1Data,
        {
            ...MOCK_DATA.lines[1],
            name: "Line 2 (Offline)",
            current_sku: "No Schedule",
            inventory_pallets: 0,
            burn_rate_minutes: 0,
            color: "gray"
        }
    ];

    const [lines, setLines] = useState(currentLines);

    // Update local state when prop changes
    useMemo(() => {
        setLines([
            line1Data,
            {
                ...MOCK_DATA.lines[1],
                name: "Line 2 (Offline)",
                current_sku: "Idle",
                inventory_pallets: 0,
                burn_rate_minutes: 0, // Infinite/Stop
                color: "gray"
            }
        ]);
    }, [line1Data]);

    const yardData = mrpData?.formState?.yardInventory || { count: 0 };
    // Use effective count if override is active, but here we just show raw inventory for now
    const yardUsed = yardData.effectiveCount !== undefined ? yardData.effectiveCount : yardData.count;
    const yardTotal = 50; // Hardcoded capacity for now
    const [sapInput, setSapInput] = useState("");
    const [morningTrueUp, setMorningTrueUp] = useState({ L1: "", L2: "" });

    // --- Logic Helpers ---

    // Calculate Hours of Supply
    const getHoursOfSupply = (pallets, burnRateMins) => {
        // Assume 1 Truck = 22 Pallets? (Standard beverage)
        // Burn Rate is Mins per TRUCK.
        // So Pallets / 22 = Trucks.
        // Trucks * BurnRate = Minutes of Supply.
        // Mins / 60 = Hours.
        const palletsPerTruck = 22;
        const trucks = pallets / palletsPerTruck;
        const mins = trucks * burnRateMins;
        return (mins / 60).toFixed(1);
    };

    const getStatusColor = (hours) => {
        if (hours > 24) return 'text-green-400 border-green-500/50 shadow-[0_0_15px_rgba(74,222,128,0.2)]';
        if (hours < 4) return 'text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse';
        return 'text-yellow-400 border-yellow-500/50';
    };

    const [generatedSchedule, setGeneratedSchedule] = useState(null);

    const handleTrueUp = (lineId, val) => {
        setMorningTrueUp(prev => ({ ...prev, [lineId]: val }));
    };

    const applyTrueUp = (lineId) => {
        // In a real app, this would recalculate inventory based on the delta
        // For visual demo, we'll just flash a success
        alert(`Updated ${lineId} actuals to ${morningTrueUp[lineId]}`);
    };

    const handleGenerateSchedule = () => {
        // 1. Regex to find POs (assumes 10 digit, or starts with 45...)
        // Let's grabs generic number strings > 4 digits for demo flexibility
        const poRegex = /\b(45\d{8}|PO[0-9]{4,})\b|\b\d{5,10}\b/g;
        const matches = sapInput.match(poRegex) || [];

        if (matches.length === 0) {
            alert("No PO numbers found in text! Try pasting 'PO 4500012345' or similar.");
            return;
        }

        // 2. Round Robin Assignment logic
        // Start at 08:00
        let currentHour = 8;
        let minute = 0;

        const schedule = matches.map((po, index) => {
            // Assign Line
            const line = index % 2 === 0 ? 'L1' : 'L2';

            // Format Time
            const timeStr = `${currentHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

            // Increment Time (every 30 mins)
            minute += 30;
            if (minute >= 60) {
                minute = 0;
                currentHour++;
            }

            return { time: timeStr, po, line };
        });

        setGeneratedSchedule(schedule);
    };

    const handleCopyTable = () => {
        if (!generatedSchedule) return;

        // Build Tab-Separated String for Excel/Email
        const headers = ['Load #', 'Del. Date', 'Del. Time', 'Description', 'Bill to', 'PO #'];
        const rows = generatedSchedule.map((slot, i) => [
            i + 1,
            new Date().toLocaleDateString(),
            slot.time,
            slot.line === 'L1' ? '20 oz. Clear' : '12 oz. Can',
            'UBP',
            slot.po
        ]);

        const tsv = [
            headers.join('\t'),
            ...rows.map(r => r.join('\t'))
        ].join('\n');

        navigator.clipboard.writeText(tsv);
        alert("Table copied to clipboard! Ready to paste into Excel or Email.");
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 font-mono transition-colors">
            {/* 1. Morning True-Up (Header) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-center bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600/20 p-2 rounded-lg">
                        <ClockIcon className="h-8 w-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-wider uppercase">Morning True-Up</h2>
                        <span className="text-xs text-gray-400">Validate yesterday's actuals</span>
                    </div>
                </div>

                {lines.map(line => (
                    <div key={line.id} className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                        <span className={`text-xs font-bold uppercase w-12 text-${line.color}-600 dark:text-${line.color}-400`}>{line.id} Act:</span>
                        <input
                            type="text"
                            className="bg-transparent border-none focus:ring-0 text-right w-20 font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                            placeholder="60k"
                            value={morningTrueUp[line.id]}
                            onChange={e => handleTrueUp(line.id, e.target.value)}
                        />
                        <button
                            onClick={() => applyTrueUp(line.id)}
                            className="text-gray-400 hover:text-green-400"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* 2. Swimlanes Dashboard */}
            <div className="space-y-6 mb-12">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Live Status</h3>

                {lines.map(line => {
                    const hours = getHoursOfSupply(line.inventory_pallets, line.burn_rate_minutes);
                    const statusClass = getStatusColor(hours);

                    return (
                        <div key={line.id} className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden shadow-sm">
                            {/* Background Pulse for Critical */}
                            {hours < 4 && <div className="absolute inset-0 bg-red-900/10 pointer-events-none"></div>}

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                {/* Line Identity */}
                                <div className="md:col-span-3 flex flex-col">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{line.name}</h2>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Run: {line.current_sku}</span>
                                    <div className="mt-4 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 w-fit px-2 py-1 rounded">
                                        <TruckIcon className="h-4 w-4" />
                                        <span>Burn: 1 Truck / {line.burn_rate_minutes}m</span>
                                    </div>
                                </div>

                                {/* Gauge / Hours of Coverage */}
                                <div className="md:col-span-3 flex flex-col items-center justify-center">
                                    <div className={`text-5xl font-black ${statusClass} rounded-full w-32 h-32 flex items-center justify-center border-4 bg-gray-50 dark:bg-gray-900`}>
                                        {hours}h
                                    </div>
                                    <span className="text-xs text-gray-400 mt-2 uppercase tracking-wide">Coverage</span>
                                </div>

                                {/* Next Deliveries (Mock Timeline) */}
                                <div className="md:col-span-6 border-l border-gray-200 dark:border-gray-700 pl-6">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Inbound Schedule</h4>
                                    <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
                                        {/* Real Schedule from Logistics */}
                                        {schedulerData?.results?.truckSchedule?.length > 0 ? (
                                            schedulerData.results.truckSchedule.map((truck) => (
                                                <div key={truck.id} className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded p-3 min-w-[120px]">
                                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">
                                                        {truck.time}
                                                    </div>
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white truncate" title={truck.po || "No PO"}>
                                                        {truck.po ? (truck.po.length > 10 ? 'PO...' + truck.po.slice(-4) : truck.po) : "No PO"}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-1">Load #{truck.id}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-gray-400 italic p-2 border border-dashed border-gray-300 rounded">
                                                No trucks scheduled
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Row: SAP Zipper & Yard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 3. SAP Zipper */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <ClipboardDocumentCheckIcon className="h-6 w-6 text-purple-400" />
                            <h3 className="font-bold text-lg">SAP Zipper</h3>
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded">Paste Mode</span>
                    </div>

                    <textarea
                        className="w-full h-32 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-900 dark:text-gray-300 font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                        placeholder="Paste list of PO numbers here..."
                        value={sapInput}
                        onChange={(e) => setSapInput(e.target.value)}
                    />

                    {/* Controls */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">Auto-detects POs</span>
                            {generatedSchedule && (
                                <button
                                    onClick={handleCopyTable}
                                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded font-bold text-xs transition-colors flex items-center"
                                >
                                    <ClipboardDocumentCheckIcon className="h-4 w-4 mr-1" />
                                    Copy
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleGenerateSchedule}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-purple-900/20"
                        >
                            Generate Schedule
                        </button>
                    </div>

                    {/* Results Output (Supplier Table Format) */}
                    {generatedSchedule && (
                        <div className="mt-2 text-xs font-mono">
                            <div className="mb-2 text-gray-400 font-bold">Ref: Part# DD 1855526</div>
                            <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-left text-gray-700 dark:text-gray-300">
                                    <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="p-2">Load #</th>
                                            <th className="p-2">Del. Date</th>
                                            <th className="p-2">Del. Time</th>
                                            <th className="p-2">Description</th>
                                            <th className="p-2">Bill to</th>
                                            <th className="p-2">PO #</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-800/50">
                                        {generatedSchedule.map((slot, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="p-2">{i + 1}</td>
                                                <td className="p-2">{new Date().toLocaleDateString()}</td>
                                                <td className="p-2 text-blue-400 font-bold">{slot.time}</td>
                                                <td className="p-2">{slot.line === 'L1' ? '20 oz. Clear' : '12 oz. Can'}</td>
                                                <td className="p-2">UBP</td>
                                                <td className="p-2 font-bold text-gray-900 dark:text-white">{slot.po}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Yard Status */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
                            <h3 className="font-bold text-lg">Yard Status</h3>
                        </div>
                        <span className="text-xs text-gray-400">Live Feed</span>
                    </div>

                    <div className="flex items-center justify-center mb-6">
                        <div className="relative w-full bg-gray-100 dark:bg-gray-900 rounded-full h-6 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (yardUsed / yardTotal) * 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="flex justify-between text-center">
                        <div>
                            <div className="text-3xl font-black text-gray-900 dark:text-white">{yardUsed}</div>
                            <div className="text-xs text-gray-500 uppercase">Occupied</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-gray-400 dark:text-gray-600">{Math.max(0, yardTotal - yardUsed)}</div>
                            <div className="text-xs text-gray-500 uppercase">Available</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-red-500">2</div>
                            <div className="text-xs text-red-400 uppercase font-bold">Late</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
