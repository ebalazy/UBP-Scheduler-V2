import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSettings } from '../../context/SettingsContext';

function BurnDownChart({ currentInventoryBottles, weeklyDemandBottles, safetyStockBottles }) {
    const { theme } = useSettings();
    const isDark = theme === 'dark';

    const data = useMemo(() => {
        if (!currentInventoryBottles) return [];

        const dailyBurnRate = weeklyDemandBottles / 7;
        // If no demand, flat line
        const burn = dailyBurnRate > 0 ? dailyBurnRate : 0;

        const points = [];
        let current = currentInventoryBottles;

        // Project for 14 days
        for (let i = 0; i <= 14; i++) {
            points.push({
                day: `Day ${i}`,
                inventory: Math.max(0, Math.round(current)),
                safetyStock: safetyStockBottles
            });
            current -= burn;
        }

        return points;
    }, [currentInventoryBottles, weeklyDemandBottles, safetyStockBottles]);

    if (!data.length) return <div className="h-64 flex items-center justify-center text-gray-400">No Data to Display</div>;

    // Theme Colors
    const axisColor = isDark ? '#9CA3AF' : '#6B7280'; // gray-400 : gray-500
    const gridColor = isDark ? '#374151' : '#E5E7EB'; // gray-700 : gray-200
    const tooltipBg = isDark ? '#1F2937' : '#FFFFFF'; // gray-800 : white
    const tooltipColor = isDark ? '#F3F4F6' : '#111827'; // gray-100 : gray-900

    return (
        <div className="w-full h-80 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 transition-colors flex flex-col">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Inventory Burn Down (14 Days)</h3>
            <div className="flex-1 w-full min-h-[200px] min-w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis
                            dataKey="day"
                            tick={{ fontSize: 12, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            interval={2}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                borderRadius: '8px',
                                border: isDark ? '1px solid #374151' : 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                color: tooltipColor
                            }}
                            itemStyle={{ color: tooltipColor }}
                            labelStyle={{ color: axisColor }}
                            formatter={(value) => value.toLocaleString()}
                        />
                        <Legend wrapperStyle={{ color: axisColor }} />
                        <Line
                            type="monotone"
                            dataKey="inventory"
                            name="Projected Inventory"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="step"
                            dataKey="safetyStock"
                            name="Safety Stock"
                            stroke="#EF4444"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
export default React.memo(BurnDownChart);
