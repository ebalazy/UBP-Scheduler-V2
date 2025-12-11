
import React, { useMemo } from 'react';
import { TruckIcon, ExclamationTriangleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

/**
 * OrderActionLog
 * Displays a list of action items: "Order X Trucks Today for Delivery on Y"
 */
export default function OrderActionLog({ plannedOrders, leadTimeDays }) {
    const todayStr = new Date().toISOString().split('T')[0];

    const actions = useMemo(() => {
        if (!plannedOrders) return [];

        // Convert to array and sort
        return Object.entries(plannedOrders)
            .map(([orderDate, data]) => ({
                orderDate,
                ...data,
                isLate: orderDate < todayStr,
                isToday: orderDate === todayStr
            }))
            .filter(item => item.orderDate <= new Date(todayStr).toISOString().split('T')[0] || item.isToday) // Show Late + Today
            .sort((a, b) => a.orderDate.localeCompare(b.orderDate));
    }, [plannedOrders, todayStr]);

    const upcoming = useMemo(() => {
        if (!plannedOrders) return [];
        // Show next 5 days
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + 5);
        const limitStr = limitDate.toISOString().split('T')[0];

        return Object.entries(plannedOrders)
            .map(([orderDate, data]) => ({ orderDate, ...data }))
            .filter(item => item.orderDate > todayStr && item.orderDate <= limitStr)
            .sort((a, b) => a.orderDate.localeCompare(b.orderDate));
    }, [plannedOrders, todayStr]);

    if (!actions.length && !upcoming.length) return null;

    return (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <h3 className="font-bold text-gray-800 text-lg mb-3 flex items-center">
                <CalendarDaysIcon className="h-5 w-5 mr-2 text-blue-600" />
                Purchasing Advice
                <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {leadTimeDays} Day Lead Time
                </span>
            </h3>

            {/* Action Items (Late or Today) */}
            <div className="space-y-3 mb-6">
                {actions.length === 0 && (
                    <div className="p-3 bg-green-50 text-green-700 text-sm rounded border border-green-100 flex items-center">
                        <TruckIcon className="h-4 w-4 mr-2" />
                        No orders required today.
                    </div>
                )}
                {actions.map(action => (
                    <div
                        key={action.orderDate}
                        className={`p-3 rounded border flex justify-between items-center ${action.isLate
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-blue-50 border-blue-200 text-blue-800'
                            }`}
                    >
                        <div className="flex items-center">
                            {action.isLate ? (
                                <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-600 animate-pulse" />
                            ) : (
                                <TruckIcon className="h-5 w-5 mr-2 text-blue-600" />
                            )}
                            <div>
                                <p className="font-bold text-sm">
                                    {action.isLate ? `OVERDUE (${action.orderDate})` : 'ORDER TODAY'}
                                </p>
                                <p className="text-xs opacity-90">
                                    Placing order now ensures delivery by:
                                    <span className="font-semibold ml-1">
                                        {action.items.map(i => i.needDate).join(', ')}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block text-2xl font-bold">{action.count}</span>
                            <span className="text-[10px] uppercase opacity-75">Trucks</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Upcoming Preview */}
            {upcoming.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upcoming Orders</h4>
                    <div className="space-y-2">
                        {upcoming.map(item => (
                            <div key={item.orderDate} className="flex justify-between text-sm text-gray-600 border-b border-gray-100 pb-1 last:border-0">
                                <span>{item.orderDate}</span>
                                <span>{item.count} Trucks</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
