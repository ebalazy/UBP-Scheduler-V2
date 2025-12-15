import React, { useState, useEffect, useRef } from 'react';
import { getLocalISOString, formatLocalDate, addDays } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';
import { useProcurement } from '../../context/ProcurementContext';
import ScheduleManagerModal from '../procurement/ScheduleManagerModal';

// Icons
import {
    CalendarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    TableCellsIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

/**
 * Workbench 2.0
 * A high-density, spreadsheet-like view for expert planners.
 * Features:
 * - Sticky Headers (Top & Left)
 * - Compact Rows
 * - Inline Editing
 * - Visual "Pills" for Truck Arrivals
 */
export default function PlanningGridWorkbench({
    monthlyDemand,
    monthlyProductionActuals,
    monthlyInbound,
    updateDateDemand,
    updateDateActual,
    poManifest = {}, // Default to empty object
    dailyLedger = [],
    specs,
    userProfile
}) {
    const { saveProcurementEntry, deleteProcurementEntry } = useProcurement();
    const { bottleSizes } = useSettings();
    // Start view 3 days in the past to show recent actuals for reconciliation
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d;
    });
    const [managerDate, setManagerDate] = useState(null);
    const [dates, setDates] = useState([]);

    // --- Date Logic (30 Days View) ---
    useEffect(() => {
        const d = [];
        for (let i = 0; i < 30; i++) {
            const next = new Date(startDate);
            next.setDate(startDate.getDate() + i);
            d.push(next);
        }
        setDates(d);
    }, [startDate]);

    const shiftDate = (days) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + days);
        setStartDate(newDate);
    };

    // --- Helpers ---
    const getLedgerForDate = (dateStr) => dailyLedger.find(l => l.dateStr === dateStr) || {};

    // --- Renderers ---
    const renderInboundCell = (dateStr) => {
        const manifest = poManifest[dateStr];
        const isConfirmed = manifest?.items?.length > 0;
        const count = isConfirmed ? manifest.items.length : (monthlyInbound[dateStr] || 0);

        // Visual Pills for Time
        const times = manifest?.items?.map(i => i.time).filter(Boolean).sort() || [];

        return (
            <div
                className={`relative h-full w-full flex flex-col justify-center px-1 cursor-pointer transition-colors ${count > 0 ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                onClick={() => setManagerDate(dateStr)}
            >
                {count > 0 ? (
                    <div className="flex flex-wrap gap-0.5">
                        {/* Count Badge */}
                        <span className={`text-[10px] font-bold px-1 rounded-sm shadow-sm ${isConfirmed ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                            {count} {isConfirmed ? '✓' : ''}
                        </span>

                        {/* Time Pills (Only for confirmed) */}
                        {isConfirmed && times.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="text-[9px] bg-blue-100 text-blue-800 px-0.5 border border-blue-200 rounded-sm dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                {t}
                            </span>
                        ))}
                        {times.length > 2 && <span className="text-[8px] text-blue-400">...</span>}
                    </div>
                ) : (
                    <span className="text-gray-200 text-xs text-center">-</span>
                )}
            </div>
        );
    };

    const renderInventoryCell = (ledger) => {
        const pallets = Math.round(ledger.projectedPallets || 0);
        const days = ledger.daysOfSupply || 0;
        const target = ledger.safetyStockTarget || 0;

        // Colors
        let bgClass = "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300";
        if (days < 2) bgClass = "bg-red-50 text-red-900 font-bold dark:bg-red-900/40 dark:text-red-300";
        else if (days < 4) bgClass = "bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300";

        return (
            <div className={`h-full w-full flex flex-col justify-center px-1 text-right text-xs ${bgClass}`}>
                <div>{pallets} <span className="text-[9px] opacity-60">plts</span></div>
                <div className="text-[9px] opacity-75">{days.toFixed(1)} Days</div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden font-sans">

            {/* Toolbar */}
            <div className="flex justify-between items-center p-2 border-b bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <TableCellsIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Workbench View</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => shiftDate(-7)} className="p-1 hover:bg-gray-200 rounded"><ChevronLeftIcon className="w-4 h-4" /></button>
                    <button onClick={() => setStartDate(new Date())} className="px-2 text-xs font-medium hover:bg-gray-200 rounded">Today</button>
                    <button onClick={() => shiftDate(7)} className="p-1 hover:bg-gray-200 rounded"><ChevronRightIcon className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Scrollable Grid Container */}
            <div className="flex-1 overflow-auto relative custom-scrollbar">
                <table className="w-full border-collapse text-xs">

                    {/* Sticky Header */}
                    <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 shadow-sm">
                        <tr>
                            <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 w-32 border-b border-r p-2 text-left font-semibold text-gray-500">
                                Metric
                            </th>
                            {dates.map(date => {
                                const dateStr = formatLocalDate(date);
                                const todayStr = formatLocalDate(new Date());
                                const isToday = dateStr === todayStr;
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                let headerClass = "min-w-[80px] p-1 border-b border-r text-center font-medium transition-colors ";
                                if (isToday) headerClass += "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-600 ring-inset ring-offset-0 z-20";
                                else if (isPast) headerClass += "bg-gray-100 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700";
                                else if (isWeekend) headerClass += "bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500";
                                else headerClass += "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200";

                                return (
                                    <th key={dateStr} className={headerClass}>
                                        <div className={`text-[10px] uppercase ${isToday ? 'text-blue-100' : 'opacity-60'}`}>
                                            {isToday ? 'TODAY' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div className={isToday ? 'font-bold' : ''}>{date.toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' })}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {/* 1. Demand Row */}
                        <tr className="hover:bg-gray-50 group">
                            <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-b p-2 font-medium text-gray-600 group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Production Plan
                                <span className="block text-[9px] font-normal text-gray-400">Cases</span>
                            </td>
                            {dates.map(date => {
                                const dateStr = formatLocalDate(date);
                                const todayStr = formatLocalDate(new Date());
                                const isToday = dateStr === todayStr;
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                const val = monthlyDemand[dateStr] || '';
                                const act = monthlyProductionActuals[dateStr];
                                const hasActual = act !== undefined && act !== null;

                                let cellClass = "border-r border-b p-0 h-10 relative ";
                                if (isToday) cellClass += "bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500 z-10 ";
                                else if (isPast) cellClass += "bg-gray-50/50 dark:bg-gray-900/40 ";
                                else cellClass += "bg-white dark:bg-gray-800 ";

                                return (
                                    <td key={dateStr} className={cellClass}>
                                        <input
                                            type="number"
                                            className={`w-full h-full text-center border-none focus:ring-0 bg-transparent p-0 text-gray-900 dark:text-gray-100 ${act ? 'font-bold' : ''} ${isToday ? 'font-bold' : ''}`}
                                            value={val}
                                            onChange={(e) => updateDateDemand(dateStr, e.target.value)}
                                            placeholder="-"
                                        />
                                        {/* Optional: Show little indicator for actual */}
                                        {hasActual && (
                                            <div className="absolute bottom-0 right-0 text-[8px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 pointer-events-none" title={`Actual: ${act}`}>
                                                Act: {act}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* 1b. Actual Production Row (New Planner Input) */}
                        <tr className="hover:bg-gray-50 group">
                            <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-b p-2 font-medium text-blue-700 dark:text-blue-400 group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Actual Reconciliation
                                <span className="block text-[9px] font-normal text-gray-400">Past Dates Only</span>
                            </td>
                            {dates.map(date => {
                                const dateStr = formatLocalDate(date);
                                const todayStr = formatLocalDate(new Date());
                                const isToday = dateStr === todayStr;
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                const act = monthlyProductionActuals[dateStr] || '';

                                let cellClass = "border-r border-b p-0 h-10 relative ";
                                if (isToday) cellClass += "bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500 z-10 ";
                                else if (!isPast) cellClass += "bg-gray-50/30 dark:bg-gray-800/50 "; // Future dates default
                                else cellClass += "bg-white dark:bg-gray-800 "; // Past dates (editable)

                                const isLocked = !isPast; // Locked if today or future

                                return (
                                    <td key={dateStr} className={cellClass}>
                                        {!isLocked ? (
                                            <input
                                                type="number"
                                                className="w-full h-full text-center border-none focus:ring-0 bg-transparent p-0 font-bold text-blue-700 dark:text-blue-300"
                                                value={act}
                                                onChange={(e) => updateDateActual(dateStr, e.target.value)}
                                                placeholder="-"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-[10px] select-none cursor-not-allowed italic">
                                                Locked
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* 2. Inbound Row */}
                        <tr className="hover:bg-gray-50 group">
                            <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-b p-2 font-medium text-gray-600 group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Inbound Trucks
                                <span className="block text-[9px] font-normal text-gray-400">Click to Manage</span>
                            </td>
                            {dates.map(date => {
                                const dateStr = formatLocalDate(date);
                                const todayStr = formatLocalDate(new Date());
                                const isToday = dateStr === todayStr;
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                                let cellClass = "border-r border-b p-0 h-12 align-middle ";
                                if (isToday) cellClass += "bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500 z-10 ";
                                else if (isPast) cellClass += "bg-gray-50/50 dark:bg-gray-900/40 ";
                                else cellClass += "bg-white dark:bg-gray-800 ";

                                return (
                                    <td key={dateStr} className={cellClass}>
                                        {renderInboundCell(dateStr)}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* 3. Inventory Row (Read Only) */}
                        <tr className="hover:bg-gray-50 group">
                            <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-b p-2 font-medium text-gray-600 group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Projected End
                                <span className="block text-[9px] font-normal text-gray-400">Pallets & DOS</span>
                            </td>
                            {dates.map(date => {
                                const dateStr = formatLocalDate(date);
                                const todayStr = formatLocalDate(new Date());
                                const isToday = dateStr === todayStr;
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                const ledger = getLedgerForDate(dateStr);

                                let cellClass = "border-r border-b p-0 h-12 align-middle ";
                                if (isToday) cellClass += "bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500 z-10 ";
                                else if (isPast) cellClass += "bg-gray-50/50 dark:bg-gray-900/40 ";
                                else cellClass += "bg-white dark:bg-gray-800 ";

                                return (
                                    <td key={dateStr} className={cellClass}>
                                        {renderInventoryCell(ledger)}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Hidden Modal Overlay */}
            {managerDate && (
                <ScheduleManagerModal
                    isOpen={!!managerDate}
                    onClose={() => setManagerDate(null)}
                    date={managerDate}
                    monthlyInbound={monthlyInbound}
                    specs={specs}
                    orders={poManifest[managerDate]?.items || []}
                    onSave={saveProcurementEntry}
                    onDelete={deleteProcurementEntry}
                />
            )}
        </div>
    );
}
