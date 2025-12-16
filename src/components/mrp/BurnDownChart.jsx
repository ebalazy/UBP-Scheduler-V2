import React, { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useSettings } from '../../context/SettingsContext';

function BurnDownChart({ dailyLedger = [], safetyTargetBottles = 0, specs = {} }) {
    const { theme } = useSettings();
    const isDark = theme === 'dark';

    const data = useMemo(() => {
        if (!dailyLedger.length || !specs.bottlesPerCase) return [];

        const bottlesPerPallet = (specs.bottlesPerCase * (specs.casesPerPallet || 1));
        const safetyPallets = Math.round(safetyTargetBottles / bottlesPerPallet);

        return dailyLedger.map(day => {
            const pallets = day.balance / bottlesPerPallet;
            // SAFE PARSING: Avoid UTC 'previous day' shift
            const [y, m, d] = day.dateStr.split('-').map(Number);
            const localDate = new Date(y, m - 1, d);

            return {
                date: day.dateStr,
                displayDate: localDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
                pallets: Math.round(pallets),
                safety: safetyPallets
            };
        });
    }, [dailyLedger, safetyTargetBottles, specs]);

    if (!data.length) {
        return (
            <div className="w-full h-80 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-gray-400 font-medium">No projection data available</span>
            </div>
        );
    }

    const safetyLevel = data[0]?.safety || 0;
    const maxVal = Math.max(...data.map(d => d.pallets), safetyLevel * 1.5);

    // Theme Colors
    const axisColor = isDark ? '#9CA3AF' : '#6B7280';
    const gridColor = isDark ? '#374151' : '#E5E7EB';
    const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
    const tooltipColor = isDark ? '#F3F4F6' : '#111827';

    // Gradient logic based on lowest point?
    // Simply Blue for inventory, with Red Line for Safety.

    return (
        <div className="w-full h-80 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col transition-all">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    30-Day Inventory Projection
                </h3>
                <div className="flex items-center space-x-4 text-xs font-medium">
                    <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
                        <span className="text-gray-600 dark:text-gray-300">Projected Balance</span>
                    </div>
                    <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 opacity-50"></span>
                        <span className="text-gray-600 dark:text-gray-300">Safety Target ({safetyLevel} plts)</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="colorSafety" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis
                            dataKey="displayDate"
                            tick={{ fontSize: 11, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            interval={6} // Show roughly weekly labels
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, 'auto']} // Start at 0 to show true crash risk
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                borderRadius: '8px',
                                border: isDark ? '1px solid #374151' : 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                color: tooltipColor,
                                padding: '8px 12px'
                            }}
                            itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                            labelStyle={{ color: axisColor, fontSize: '11px', marginBottom: '4px' }}
                            formatter={(value, name) => [
                                `${value} Pallets`,
                                name === 'pallets' ? 'Balance' : 'Safety'
                            ]}
                        />
                        <ReferenceLine y={safetyLevel} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.6} />
                        <Area
                            type="monotone"
                            dataKey="pallets"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPv)"
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default React.memo(BurnDownChart);
