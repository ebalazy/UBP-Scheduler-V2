import React from 'react';
import {
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    CubeIcon,
    TruckIcon
} from '@heroicons/react/24/outline';
import { formatLocalDate } from '../../utils/dateUtils';

export default function PulseHUD({ mrp, scheduler, activeSku }) {
    // 1. Extract Metrics
    const todayStr = formatLocalDate(new Date());
    const ledger = mrp.results?.dailyLedger || [];
    const todayLedger = ledger.find(l => l.date === todayStr);

    const floorBalance = todayLedger?.balance || 0; // Bottles
    const safetyLoads = scheduler.results?.safetyStockLoads || 0;

    // Get Specs for conversion
    // We assume 'scheduler' or 'mrp' has access to specs via context, 
    // OR we can pass specs as a prop. 
    // For now, let's try to infer from mrp state or just display raw first?
    // Better to use generic "Stock" for now.

    // Calculate Coverage (Runway)
    // Heuristic: Find first day where balance < 0
    let runwayDays = 0;
    let isCritical = false;

    // Simple lookahead
    for (const day of ledger) {
        if (day.balance < 0) {
            isCritical = true;
            break;
        }
        if (day.date >= todayStr) {
            runwayDays++;
        }
    }
    // Cap at 14+
    const displayRunway = isCritical ? runwayDays : '14+';
    const runwayColor = isCritical
        ? (runwayDays <= 2 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')
        : 'text-emerald-600 dark:text-emerald-400';

    const borderColor = isCritical
        ? (runwayDays <= 2 ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/10' : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/10')
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';

    return (
        <div className={`w-full mb-6 rounded-xl border p-4 shadow-sm transition-all ${borderColor}`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                {/* 1. Brand / SKU Context */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <CubeIcon className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Active Production
                        </h2>
                        <div className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                            {activeSku || 'Unknown SKU'}
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                                Line 1
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Key Metrics (Grid) */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full md:w-auto flex-grow justify-end">

                    {/* Metric: Floor Stock */}
                    <div className="text-center md:text-right">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Current Stock
                        </div>
                        <div className="text-2xl font-black text-slate-700 dark:text-slate-200">
                            {Number(floorBalance).toLocaleString()} <span className="text-xs font-medium text-slate-400">units</span>
                        </div>
                    </div>

                    {/* Metric: Runway */}
                    <div className="text-center md:text-right border-l dark:border-slate-700 pl-6">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Material Runway
                        </div>
                        <div className={`text-2xl font-black flex items-center justify-center md:justify-end gap-2 ${runwayColor}`}>
                            {isCritical ? (
                                <ExclamationTriangleIcon className="w-5 h-5" />
                            ) : (
                                <ClockIcon className="w-5 h-5" />
                            )}
                            {displayRunway} <span className="text-sm">Days</span>
                        </div>
                    </div>

                    {/* Metric: Safety Status */}
                    <div className="text-center md:text-right border-l dark:border-slate-700 pl-6 hidden md:block">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Safety Status
                        </div>
                        <div className="text-lg font-bold flex items-center justify-end gap-2">
                            {floorBalance > (safetyLoads * 20000) ? (
                                <>
                                    <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                    <span className="text-emerald-600 dark:text-emerald-400">Secure</span>
                                </>
                            ) : (
                                <>
                                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                                    <span className="text-amber-600 dark:text-amber-400">Below Safety</span>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
