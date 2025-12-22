import React, { useState, useEffect } from 'react';
import {
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    CubeIcon,
    PencilSquareIcon
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { formatLocalDate, getLocalISOString } from '../../utils/dateUtils';
// import { useSettings } from '../../context/SettingsContext'; // Removed
import { useProducts } from '../../context/ProductsContext'; // Added

export default function PulseHUD({ mrp, scheduler, activeSku }) {
    // Extract State & Setters
    const { formState: state, setters, results } = mrp;
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Use Products Context
    const { productMap } = useProducts();
    const bottleSizes = Object.keys(productMap);

    // Safety Checks
    if (!results) return null;

    const todayStr = formatLocalDate(new Date());
    const ledger = results?.dailyLedger || [];
    const todayLedger = ledger.find(l => l.date === todayStr);

    // Metrics
    const floorBalance = results.calculatedPallets || 0;
    const yardBalance = state.yardInventory?.count || 0;

    // Precise Safety Target (Bottles -> Pallets)
    const specs = results.specs || {};
    const bpc = specs.bottlesPerCase || 1;
    const cpp = specs.casesPerPallet || 1;
    const safetyTargetBottles = results.safetyTarget || 0;
    const safetyTargetPallets = safetyTargetBottles / (bpc * cpp);

    // Use palletsPerTruck from DB specs (consistent with ProductsContext)
    const palletsPerTruck = specs.palletsPerTruck || 22;
    const totalEffectivePallets = floorBalance + (yardBalance * palletsPerTruck);

    // Coverage Logic
    let runwayDays = 0;
    let isCritical = false;
    for (const day of ledger) {
        if (day.balance < 0) {
            isCritical = true;
            break;
        }
        if (day.date >= todayStr) runwayDays++;
    }
    const displayRunway = isCritical ? runwayDays : '14+';
    const runwayColor = isCritical
        ? (runwayDays <= 2 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')
        : 'text-emerald-600 dark:text-emerald-400';

    const borderColor = isCritical
        ? (runwayDays <= 2 ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/10' : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/10')
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';

    return (
        <div className={`w-full mb-6 rounded-xl border shadow-lg bg-slate-200 dark:bg-slate-800/50 transition-all duration-300 relative ${borderColor} ${isCollapsed ? 'p-2' : 'p-4'}`}>

            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute top-0 right-0 p-1.5 m-1 text-slate-400 hover:text-blue-500 transition-colors z-10"
                title={isCollapsed ? "Expand Dashboard" : "Collapse Dashboard"}
            >
                {isCollapsed
                    ? <ChevronDownIcon className="w-4 h-4" />
                    : <ChevronDownIcon className="w-4 h-4 rotate-180" />
                }
            </button>

            {isCollapsed ? (
                /* MINI MODE */
                <div className="flex items-center justify-between px-2 pr-8">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                                <CubeIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">{state.selectedSize}</span>
                        </div>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-500 uppercase tracking-wider">Floor:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{Math.round(floorBalance)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-500 uppercase tracking-wider">Runway:</span>
                            <span className={`font-mono font-black ${runwayColor}`}>{displayRunway} Days</span>
                        </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${totalEffectivePallets >= safetyTargetPallets
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                        }`}>
                        {totalEffectivePallets >= safetyTargetPallets ? 'Secure' : 'Below Safety'}
                    </div>
                </div>
            ) : (
                /* EXPANDED MODE (Original) */
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">

                    {/* 1. Context & Production Settings */}
                    <div className="flex items-center gap-6 w-full lg:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-inner">
                                <CubeIcon className="w-6 h-6 text-slate-500" />
                            </div>
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Production Plan
                                </h2>
                                <div className="relative group flex items-center">
                                    <select
                                        className="appearance-none bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-xl font-extrabold text-slate-800 dark:text-white pr-6 py-0.5 rounded cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                        value={state.selectedSize}
                                        onChange={(e) => setters.setSelectedSize(e.target.value)}
                                    >
                                        {bottleSizes.map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 text-slate-400 -ml-4 pointer-events-none group-hover:text-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* Production Inputs (Run Rate / Downtime) */}
                        <div className="hidden md:flex items-center gap-4 border-l border-slate-200 dark:border-slate-700 pl-6">
                            <EditableInput
                                label="Rate (cph)"
                                value={state.productionRate}
                                onChange={v => setters.setProductionRate(v)}
                                width="w-20"
                            />
                            <EditableInput
                                label="Downtime (hr)"
                                value={state.downtimeHours}
                                onChange={v => setters.setDowntimeHours(v)}
                                width="w-16"
                            />
                        </div>
                    </div>

                    {/* 2. Key Metrics (Editable) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full lg:w-auto flex-grow justify-end">

                        {/* Floor Stock Input */}
                        <div className="text-center md:text-right">
                            <EditableStat
                                label="Floor Stock"
                                value={Math.round(floorBalance)}
                                unit="plts"
                                onSave={(val) => setters.setInventoryAnchor({ date: getLocalISOString(), count: Number(val) })}
                            />
                        </div>

                        {/* Yard Stock Input */}
                        <div className="text-center md:text-right border-l dark:border-slate-700 pl-6">
                            <EditableStat
                                label="Yard Stock"
                                value={Number(yardBalance)}
                                unit="loads"
                                onSave={(val) => setters.updateYardInventory(val)}
                                colorClass="text-blue-600 dark:text-blue-400"
                            />
                        </div>

                        {/* Runway */}
                        <div className="text-center md:text-right border-l dark:border-slate-700 pl-6">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Runway
                            </div>
                            <div className={`text-2xl font-black flex items-center justify-center md:justify-end gap-2 ${runwayColor}`}>
                                {isCritical ? <ExclamationTriangleIcon className="w-5 h-5" /> : <ClockIcon className="w-5 h-5" />}
                                {displayRunway} <span className="text-sm text-slate-400 font-medium">Days</span>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="hidden md:flex flex-col items-end justify-center border-l dark:border-slate-700 pl-6">
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${totalEffectivePallets >= safetyTargetPallets
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                                }`}>
                                {totalEffectivePallets >= safetyTargetPallets ? 'Secure' : 'Below Safety'}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-component for Hover-to-Edit Inputs
function EditableStat({ label, value, unit, onSave, colorClass = 'text-slate-700 dark:text-slate-200' }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempVal, setTempVal] = useState(value === 0 ? '' : value);

    useEffect(() => setTempVal(value === 0 ? '' : value), [value]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onSave(tempVal);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex flex-col items-end">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</span>
                <input
                    autoFocus
                    type="number"
                    className="w-24 text-right text-xl font-bold p-1 bg-white dark:bg-slate-800 border-2 border-blue-400 rounded shadow-md outline-none"
                    value={tempVal}
                    onChange={e => setTempVal(e.target.value)}
                    onBlur={() => { onSave(tempVal); setIsEditing(false); }}
                    onKeyDown={handleKeyDown}
                />
            </div>
        );
    }

    return (
        <div
            className="group cursor-pointer relative"
            onClick={() => setIsEditing(true)}
        >
            <div className="flex items-center justify-end gap-1 mb-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-500 transition-colors">
                    {label}
                </span>
                <PencilSquareIcon className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className={`text-2xl font-black ${colorClass} group-hover:bg-slate-50 dark:group-hover:bg-slate-800 rounded px-1 -mr-1 transition-colors`}>
                {Number(value).toLocaleString()} <span className="text-xs font-medium text-slate-400">{unit}</span>
            </div>
        </div>
    );
}

function EditableInput({ label, value, onChange, width }) {
    return (
        <div className="flex flex-col">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-0.5 ml-1">{label}</label>
            <input
                type="number"
                className={`${width} bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 rounded-t p-1 text-lg font-extrabold text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-0 outline-none transition-all`}
                value={value === 0 ? '' : value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={(e) => e.target.select()}
            />
        </div>
    );
}
