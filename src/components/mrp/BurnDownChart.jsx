import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function BurnDownChart({ currentInventoryBottles, weeklyDemandBottles, safetyStockBottles }) {

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

    // Determine intersection point (roughly) for color coding?
    // For now, simpler: Line is Blue. Safety Stock is Red dashed.

    return (
        <div className="w-full h-80 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Inventory Burn Down (14 Days)</h3>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        axisLine={false}
                        tickLine={false}
                        interval={2}
                    />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value) => value.toLocaleString()}
                    />
                    <Legend />
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
    );
}
