import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import {
    XMarkIcon,
    TruckIcon,
    CalendarDaysIcon,
    TrashIcon,
    PencilSquareIcon,
    ArrowRightCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { useSettings } from '../../context/SettingsContext';
import { addDays, formatLocalDate, formatTime12h } from '../../utils/dateUtils';

export default function ScheduleManagerModal({ isOpen, onClose, date, orders = [], monthlyInbound, updateDateInbound, specs }) {
    const { updateDailyManifest, addOrdersBulk, removeOrder, updateOrder } = useProcurement();
    const { schedulerSettings } = useSettings();

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [moveTargetDate, setMoveTargetDate] = useState('');
    const [movingId, setMovingId] = useState(null);

    // Sorted Orders (Time Ascending, TBD last)
    const sortedOrders = [...orders].sort((a, b) => {
        // Treat 00:00 as No Time for sorting purposes if desired, 
        // or just strict string sort?
        // User complained about "12am" appearing, implying it's a default/invalid time.
        // Let's treat falsy OR "00:00" as TBD.
        const getVal = (o) => {
            if (!o.time || o.time === '00:00') return 'ZZZZ'; // End of list
            return o.time;
        };
        return getVal(a).localeCompare(getVal(b));
    });

    // Helpers
    // Business Rule: 1 PO = 1 Truck (Always)
    const bottlesPerTruck = specs?.bottlesPerTruck || 20000;
    const getTruckCount = (qty) => "1.0"; // Always 1 truck
    const getTruckFloat = (qty) => 1.0;

    // --- ESTIMATION LOGIC ---
    const getEstimatedTime = (index) => {
        if (!schedulerSettings || !specs) return 'TBD';

        const rate = specs.productionRate || 0; // Cases per Hour
        const capacity = specs.casesPerTruck || (specs.bottlesPerTruck / specs.bottlesPerCase);

        if (!rate || rate <= 0) return 'TBD (Set Rate)';

        const hoursPerTruck = capacity / rate;

        // Parse Start Time
        const [startH, startM] = (schedulerSettings.shiftStartTime || '00:00').split(':').map(Number);
        const startDecimal = startH + (startM / 60);

        // Calc Arrival: Start + (Index * Interval)
        // Index is 0-based for calculation purposes? 
        // Scheduler usually assumes Truck 1 arrives AT Start Time? Or after 1 interval?
        // Let's assume Truck 1 arrives *after* producing 1 truck worth? Or Just-In-Time?
        // Usually JIT means it arrives *before* needed.
        // Let's stick to Scheduler View logic: 
        // Scheduler: validArrival = currentHour + (hoursPerTruck * i)
        // So Truck 1 (Index 0) arrives at Start Time.

        const arrivalDecimal = startDecimal + (index * hoursPerTruck);
        const normalized = arrivalDecimal % 24;

        const roundedH = Math.round(normalized) % 24;

        const period = roundedH >= 12 ? 'PM' : 'AM';
        const displayH = roundedH % 12 || 12;
        const displayM = '00';

        return `${displayH}:${displayM} ${period}`;
    };

    // Recalculate Daily Total based on active orders
    const syncTruckCount = (targetDate, newOrdersList) => {
        if (!updateDateInbound) return;
        // Business Rule: Total Trucks = Number of POs
        const totalTrucks = newOrdersList.length;
        updateDateInbound(targetDate, totalTrucks);
    };

    // Actions
    const handleDelete = (orderId) => {
        if (!confirm('Are you sure you want to cancel this order?')) return;

        const orderToDelete = orders.find(o => o.id === orderId);
        removeOrder(date, orderId, orderToDelete?.po);

        // Recalculate remaining
        const remaining = orders.filter(o => o.id !== orderId);
        syncTruckCount(date, remaining);
    };

    const startMove = (orderId) => {
        setMovingId(orderId);
        const tomorrow = addDays(new Date(date + 'T00:00:00'), 1);
        setMoveTargetDate(formatLocalDate(tomorrow));
    };

    const confirmMove = () => {
        if (!moveTargetDate || !movingId) return;

        const orderToMove = orders.find(o => o.id === movingId);
        if (!orderToMove) return;

        // Apply edits if moving AND editing
        const finalOrder = (editingId === movingId)
            ? { ...orderToMove, ...editForm, date: moveTargetDate }
            : { ...orderToMove, date: moveTargetDate };

        // 1. Add to New Date
        addOrdersBulk([finalOrder]);

        // 2. Remove from Old Date (Current)
        removeOrder(date, movingId, orderToMove.po);

        // 3. Sync: Recalculate Source Date (Locally known)
        const remaining = orders.filter(o => o.id !== movingId);
        syncTruckCount(date, remaining);

        // 4. Sync: Increment Target Date (Delta update since we don't know full list)
        if (updateDateInbound && monthlyInbound) {
            const currentTargetTrucks = Number(monthlyInbound[moveTargetDate] || 0);
            const addedTrucks = getTruckFloat(finalOrder.qty);
            updateDateInbound(moveTargetDate, currentTargetTrucks + addedTrucks);
        }

        setMovingId(null);
        setMoveTargetDate('');
        setEditingId(null);
    };

    const [copied, setCopied] = useState(false);

    const handleCopyPlan = () => {
        const count = Math.round(Number(monthlyInbound[date] || 0));
        let text = `Replenishment Plan - ${new Date(date + 'T00:00:00').toLocaleDateString()}\n`;
        text += `Total Planned Trucks: ${count}\n`;
        text += `--------------------------------\n`;

        for (let i = 0; i < count; i++) {
            text += `Load #${i + 1}: ${getEstimatedTime(i)}\n`;
        }

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const startEdit = (order) => {
        setEditingId(order.id);
        setEditForm({ ...order });
    };

    const saveEdit = () => {
        if (!editingId) return;
        const updatedOrder = { ...orders.find(o => o.id === editingId), ...editForm };

        // Update Context & Cloud
        updateOrder(date, updatedOrder);

        // Recalculate Trucks for THIS day
        const NewList = orders.map(o => o.id === editingId ? updatedOrder : o);
        syncTruckCount(date, NewList);

        setEditingId(null);
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <div>
                            <Dialog.Title className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white uppercase tracking-wide">
                                <CalendarDaysIcon className="w-5 h-5 text-blue-500" />
                                {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                            </Dialog.Title>
                            <p className="text-xs text-gray-500 mt-1">Found {orders.length} Scheduled Deliveries</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto space-y-4">
                        {orders.length === 0 ? (
                            <>
                                {monthlyInbound && Number(monthlyInbound[date] || 0) > 0 ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                                            <div className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                                <span className="text-xl">ℹ️</span>
                                                <span>
                                                    <strong>{Number(monthlyInbound[date])} Trucks Planned</strong> via Auto-Replenishment.
                                                    <br />Purchase Orders have not been imported yet.
                                                </span>
                                            </div>
                                            <button
                                                onClick={handleCopyPlan}
                                                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                                                    }`}
                                            >
                                                {copied ? (
                                                    <>
                                                        <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <ClipboardDocumentCheckIcon className="w-4 h-4 mr-1.5" />
                                                        Copy Plan
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        {Array.from({ length: Math.round(Number(monthlyInbound[date])) }).map((_, i) => (
                                            <div key={`planned-${i}`} className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 flex items-center justify-between opacity-75 grayscale">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-lg">
                                                        <TruckIcon className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-500 dark:text-gray-400 italic">
                                                            Planned Load #{i + 1}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="flex items-center text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                                                <ClockIcon className="w-3 h-3 mr-1" />
                                                                Est. {getEstimatedTime(i)}
                                                            </div>
                                                            <span className="text-xs text-gray-400">Awaiting PO</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 rounded-full">
                                                    AUTO-PLAN
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-gray-400 italic bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        No deliveries scheduled for this day.
                                    </div>
                                )}
                            </>
                        ) : (
                            sortedOrders.map((order, idx) => (
                                <div key={order.id || idx} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm p-4 relative group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                    {editingId === order.id ? (
                                        // EDIT / MOVE MODE
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-1">
                                                    <label className="text-xs font-bold text-gray-500">PO Number</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        value={editForm.po || ''}
                                                        onChange={e => setEditForm(prev => ({ ...prev, po: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-bold text-gray-500">Appointment Time</label>
                                                    <input
                                                        type="time"
                                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        value={editForm.time || ''}
                                                        onChange={e => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-bold text-gray-500">Appointment Time</label>
                                                    <input
                                                        type="time"
                                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        value={editForm.time || ''}
                                                        onChange={e => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-bold text-gray-500">Supplier</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                        value={editForm.supplier || ''}
                                                        onChange={e => setEditForm(prev => ({ ...prev, supplier: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-bold text-gray-500">Quantity</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                            value={editForm.qty || 0}
                                                            onChange={e => setEditForm(prev => ({ ...prev, qty: e.target.value }))}
                                                        />
                                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                                            = {getTruckCount(editForm.qty || 0)} Trucks
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* MOVE ACTION */}
                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-blue-700 dark:text-blue-300">Move to Date</label>
                                                    <input
                                                        type="date"
                                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1"
                                                        value={moveTargetDate}
                                                        onChange={e => {
                                                            setMoveTargetDate(e.target.value);
                                                            if (!movingId) setMovingId(order.id);
                                                        }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={confirmMove}
                                                    disabled={!moveTargetDate}
                                                    className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-blue-500 flex items-center"
                                                >
                                                    <ArrowRightCircleIcon className="w-5 h-5 mr-1" />
                                                    Reschedule
                                                </button>
                                            </div>

                                            <div className="flex justify-between border-t dark:border-gray-700 pt-3">
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={saveEdit}
                                                    className="flex items-center text-sm font-bold text-green-600 hover:text-green-700"
                                                >
                                                    <CheckCircleIcon className="w-5 h-5 mr-1" />
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // VIEW MODE
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-4">
                                                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                                                    <TruckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                                                        <span className="font-mono">{(order.time && order.time !== '00:00') ? formatTime12h(order.time) : 'TBD'}</span>
                                                        <span className="mx-2 text-gray-300">|</span>
                                                        PO #{order.po}
                                                        {order.loadId && (
                                                            <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full font-bold">
                                                                Load ID: {order.loadId}
                                                            </span>
                                                        )}
                                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs rounded-full font-bold">
                                                            1 Truck
                                                        </span>
                                                        {/* STATUS TOGGLE */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const currentStatus = order.status || 'ordered';
                                                                const newStatus = currentStatus === 'confirmed' ? 'ordered' : 'confirmed';
                                                                updateOrder(date, { ...order, status: newStatus });
                                                            }}
                                                            className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold border transition-colors ${(order.status === 'confirmed')
                                                                ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                                                                : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
                                                                }`}
                                                            title="Click to Toggle Status (Ordered/Confirmed)"
                                                        >
                                                            {order.status === 'confirmed' ? 'Confirmed' : 'Ordered'}
                                                        </button>
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            {order.supplier || order.vendor || 'Unknown Supplier'}
                                                        </p>
                                                        {Number(order.qty) > 0 && (
                                                            <span className="text-xs text-gray-400">
                                                                ({Number(String(order.qty).replace(/,/g, '')).toLocaleString()} units)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        startEdit(order);
                                                        startMove(order.id); // Initialize move state too just in case
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg dark:hover:bg-blue-900/30"
                                                    title="Edit or Reschedule"
                                                >
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/30"
                                                    title="Cancel Delivery"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex gap-3 text-xs text-yellow-800 dark:text-yellow-200">
                            <span className="text-lg">💡</span>
                            <p>
                                <strong>Schedule Exception Management</strong><br />
                                Use this tool to handle cancellations or delays.
                                Removing a PO here is permanent unless re-imported from SAP.
                            </p>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
