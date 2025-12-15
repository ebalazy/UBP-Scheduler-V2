import { saveAs } from 'file-saver';
import {
    ClockIcon,
    TruckIcon,
    TrashIcon,
    DocumentTextIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

export default function VisualScheduler({ schedule, truckSchedule, onUpdatePO, onDelete, specs, readOnly = false }) {

    // ... (Helpers remain same)

    // ... (Export remains same)

    // --- Render ---
    return (
        <div className="space-y-8">

            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <TruckIcon className="w-6 h-6 text-indigo-500" />
                        Live Dock Schedule
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        {truckSchedule.length} Loads Scheduled • Auto-optimized intervals
                    </p>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span>Export CSV</span>
                </button>
            </div>

            {/* CARD GRID (The New Visual View) */}
            {truckSchedule && truckSchedule.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {truckSchedule.map((truck, idx) => {
                        const hasPO = truck.po && truck.po.length > 0;
                        return (
                            <div
                                key={truck.id}
                                className={`
                                    relative flex flex-col justify-between
                                    bg-white dark:bg-slate-800 
                                    rounded-2xl shadow-sm hover:shadow-md transition-shadow 
                                    border border-slate-200 dark:border-slate-700
                                    overflow-hidden group
                                `}
                            >
                                {/* Status Strip (Left Border equivalent) */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${hasPO ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>

                                <div className="p-5 pl-7"> {/* Padding adjusted for strip */}

                                    {/* Top Row: Time & Rank */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-lg ${hasPO ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                                                <ClockIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold uppercase text-slate-400">Arrival</div>
                                                <div className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                                                    {truck.time}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-300">#{idx + 1}</span>
                                    </div>

                                    {/* Middle: PO Entry */}
                                    <div className="mt-2">
                                        <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 mb-1">
                                            <DocumentTextIcon className="w-3 h-3" />
                                            Purchase Order
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={readOnly ? "Registered Only" : "Enter PO..."}
                                            value={truck.po || ''}
                                            disabled={readOnly}
                                            onChange={(e) => onUpdatePO(truck.id, e.target.value)}
                                            className={`
                                                w-full p-2 rounded-lg text-sm font-bold border transition-colors
                                                focus:ring-2 focus:ring-offset-0 outline-none
                                                ${readOnly ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}
                                                ${hasPO
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-400'
                                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-indigo-500 dark:bg-slate-900/50 dark:border-slate-600 dark:text-white'
                                                }
                                            `}
                                        />
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 pl-7 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <div className="text-xs font-medium text-slate-400">
                                        {hasPO ? 'Confirmed' : 'Awaiting PO'}
                                    </div>
                                    {!readOnly && (
                                        <button
                                            onClick={() => onDelete(truck.id)}
                                            className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                                            title="Delete Load"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <TruckIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-500">No Loads Scheduled</h3>
                    <p className="text-slate-400 text-sm">Use the settings above to generate a schedule.</p>
                </div>
            )}

            {/* Shift Breakdown Table (Retained for reference) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">Shift Distribution Check</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                        <thead>
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Shift</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase">Loads</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Timeline</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {schedule.map((shift, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700 dark:text-slate-200">
                                        {shift.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                                            {shift.loads}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-2">
                                            {generateTimestamps(shift.name, shift.loads).map((time, tIdx) => (
                                                <span key={tIdx} className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-600 text-slate-600 dark:text-slate-400 px-2 py-1 rounded text-xs font-mono">
                                                    {time}
                                                </span>
                                            ))}
                                            {shift.loads === 0 && <span className="text-slate-300 text-xs italic">Empty</span>}
                                        </div>
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
