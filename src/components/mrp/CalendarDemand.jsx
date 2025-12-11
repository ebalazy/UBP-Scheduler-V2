import { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'; // Falling back to text if icons issue, but package.json has heroicons

export default function CalendarDemand({ monthlyDemand, updateDateDemand, monthlyInbound, updateDateInbound, monthlyProductionActuals, updateDateActual }) {
    const [viewDate, setViewDate] = useState(new Date());

    // Generate calendar grid
    const { days, monthLabel, totalMonthlyDemand } = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sun

        // Array of empty slots for padding start
        const padding = Array(startDayOfWeek).fill(null);

        // Array of days
        const dateArray = Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month, i + 1);
            const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
            return {
                date: d,
                dateStr,
                dayNum: i + 1,
                val: monthlyDemand[dateStr] || 0,
                trucks: monthlyInbound?.[dateStr] || 0,
                actual: monthlyProductionActuals?.[dateStr]
            };
        });

        const totalMonthlyDemand = dateArray.reduce((sum, d) => {
            const usage = (d.actual !== undefined && d.actual !== null) ? Number(d.actual) : (d.val || 0);
            return sum + usage;
        }, 0);

        return {
            days: [...padding, ...dateArray],
            monthLabel: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
            totalMonthlyDemand
        };
    }, [viewDate, monthlyDemand, monthlyInbound]);

    const changeMonth = (offset) => {
        setViewDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + offset);
            return d;
        });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                    &lt; Prev
                </button>
                <div className="text-center">
                    <h3 className="font-bold text-gray-800">{monthLabel}</h3>
                    <p className="text-xs text-blue-600 font-medium">{totalMonthlyDemand.toLocaleString()} Cases</p>
                </div>
                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                    Next &gt;
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-2">
                <div>SUN</div>
                <div>MON</div>
                <div>TUE</div>
                <div>WED</div>
                <div>THU</div>
                <div>FRI</div>
                <div>SAT</div>
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1">
                {days.map((day, idx) => {
                    if (!day) return <div key={`pad-${idx}`} className="bg-gray-50/50 rounded" />;

                    const isToday = new Date().toISOString().split('T')[0] === day.dateStr;
                    const hasDemand = day.val > 0;
                    const hasActual = day.actual !== undefined;
                    const hasTrucks = day.trucks > 0;

                    return (
                        <div
                            key={day.dateStr}
                            className={`
                                relative p-1 rounded border min-h-[90px] flex flex-col justify-between
                                ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}
                                ${hasDemand || hasTrucks || hasActual ? 'bg-white' : 'bg-gray-50'}
                            `}
                        >
                            <span className={`text-[10px] items-start mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                {day.dayNum}
                            </span>

                            <div className="flex flex-col space-y-1">
                                {/* Plan Input */}
                                <div className="flex items-center">
                                    <span className="text-[8px] text-gray-400 w-3">P:</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-full text-center text-xs p-0 border-0 bg-transparent focus:ring-0 font-medium
                                            ${hasDemand ? 'text-gray-900 border-b border-gray-100' : 'text-gray-300'}
                                        `}
                                        placeholder="-"
                                        value={day.val ? day.val.toLocaleString() : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) {
                                                updateDateDemand(day.dateStr, raw);
                                            }
                                        }}
                                    />
                                </div>

                                {/* Actual Input */}
                                <div className="flex items-center">
                                    <span className="text-[8px] text-blue-400 w-3 font-bold">A:</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`
                                            w-full text-center text-xs p-0 border-0 bg-transparent focus:ring-0 font-bold
                                            ${hasActual ? 'text-blue-700 bg-blue-50/50 rounded' : 'text-gray-300'}
                                        `}
                                        placeholder="-"
                                        value={hasActual ? day.actual.toLocaleString() : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/,/g, '');
                                            if (!isNaN(raw)) {
                                                updateDateActual(day.dateStr, raw);
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Inbound Trucks Input */}
                            <div className="flex items-center justify-center mt-1 border-t border-gray-100 pt-1">
                                <span className="text-[9px] mr-1 text-gray-400">🚛</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`
                                        w-6 text-center text-[10px] p-0 border-0 bg-transparent focus:ring-0 font-bold
                                        ${hasTrucks ? 'text-green-600' : 'text-gray-300'}
                                    `}
                                    placeholder="0"
                                    value={day.trucks > 0 ? day.trucks : ''}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/,/g, '');
                                        if (!isNaN(raw)) {
                                            updateDateInbound(day.dateStr, raw);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
