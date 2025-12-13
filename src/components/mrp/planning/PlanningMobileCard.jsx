import React from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

export default function PlanningMobileCard({
    date,
    todayStr,
    demandVal,
    updateDateDemand,
    actualVal,
    updateDateActual,
    manifestItems,
    monthlyInboundVal, // Raw value from map
    updateDateInbound,
    ledgerItem,
    openManager
}) {
    const dateStr = formatLocalDate(date);
    const isToday = dateStr === todayStr;
    const hasActual = actualVal !== undefined;
    const hasManifest = manifestItems && manifestItems.length > 0;
    const inboundVal = hasManifest ? manifestItems.length : (monthlyInboundVal || 0);

    return (
        <div className={`p-4 rounded-xl border-2 mb-4 shadow-sm ${isToday ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div>
                    <span className="text-xs font-bold text-gray-500 uppercase">{date.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                    <div className="text-lg font-black text-gray-800 dark:text-white">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                {isToday && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Today</span>}
            </div>

            {/* Grid of Inputs */}
            <div className="grid grid-cols-2 gap-4">
                {/* PRODUCTION */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Production Plan</label>
                    <input
                        className="w-full bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 p-2 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="-"
                        value={demandVal || ''}
                        onChange={e => updateDateDemand(dateStr, e.target.value)}
                    />
                </div>

                {/* ACTUAL */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-900">
                    <label className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Actual / Prod</label>
                    <input
                        className="w-full bg-white dark:bg-gray-600 rounded border border-blue-200 dark:border-blue-800 p-2 text-sm font-bold text-center text-blue-700 dark:text-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="-"
                        value={hasActual ? Number(actualVal).toLocaleString() : ''}
                        onChange={e => {
                            const v = e.target.value.replace(/,/g, '');
                            if (!isNaN(v)) updateDateActual(dateStr, v);
                        }}
                    />
                </div>

                {/* INBOUND */}
                <div className="bg-green-50/50 dark:bg-green-900/10 p-2 rounded-lg border border-green-100 dark:border-green-900">
                    <label className="text-[10px] font-bold text-green-400 uppercase block mb-1">Inbound Trucks</label>
                    {hasManifest ? (
                        <button
                            className="w-full bg-white dark:bg-gray-600 rounded border border-green-200 dark:border-green-800 p-2 text-sm font-bold text-center text-green-700 dark:text-green-400 flex items-center justify-center gap-2"
                            onClick={() => openManager(dateStr)}
                        >
                            {inboundVal} <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        </button>
                    ) : (
                        <input
                            className="w-full bg-white dark:bg-gray-600 rounded border border-green-200 dark:border-green-800 p-2 text-sm font-bold text-center text-green-700 dark:text-green-400 focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="0"
                            value={inboundVal || ''}
                            onChange={e => {
                                const v = e.target.value.replace(/,/g, '');
                                if (!isNaN(v)) updateDateInbound(dateStr, v);
                            }}
                        />
                    )}
                </div>

                {/* END INVENTORY */}
                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg flex flex-col justify-center items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">End Balance</label>
                    <div className="text-sm font-black text-gray-700 dark:text-gray-300">
                        {ledgerItem ? ledgerItem.balance.toLocaleString() : '-'}
                    </div>
                </div>
            </div>
        </div>
    );
}
