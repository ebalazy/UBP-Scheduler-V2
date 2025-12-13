import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import {
    XMarkIcon,
    TruckIcon,
    CalendarDaysIcon,
    TrashIcon,
    PencilSquareIcon,
    ArrowRightCircleIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { useSettings } from '../../context/SettingsContext';
import { addDays, formatLocalDate } from '../../utils/dateUtils';

export default function ScheduleManagerModal({ isOpen, onClose, date, orders = [], monthlyInbound, updateDateInbound }) {
    const { updateDailyManifest, addOrdersBulk, removeOrder, updateOrder } = useProcurement();
    const { specs } = useSettings();

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [moveTargetDate, setMoveTargetDate] = useState('');
    const [movingId, setMovingId] = useState(null);

    // Helpers
    // Business Rule: 1 PO = 1 Truck (Always)
    const bottlesPerTruck = specs?.bottlesPerTruck || 20000; // still used for reference?
    const getTruckCount = (qty) => "1.0"; // Always 1 truck
    const getTruckFloat = (qty) => 1.0;

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
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                                {monthlyInbound && Number(monthlyInbound[date] || 0) > 0 ? (
                                    <div className="space-y-2">
                                        <TruckIcon className="w-12 h-12 text-green-400 mx-auto opacity-50" />
                                        <p className="text-lg font-bold text-gray-600 dark:text-gray-300">
                                            {Number(monthlyInbound[date])} Planned Trucks
                                        </p>
                                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                            These are calculated by Auto-Replenishment. <br />
                                            Active POs have not been imported/created yet.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-gray-400 italic">No deliveries scheduled for this day.</div>
                                )}
                            </div>
                        ) : (
                            orders.map((order, idx) => (
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
                                                        PO #{order.po}
                                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs rounded-full font-bold">
                                                            1 Truck
                                                        </span>
                                                    </h3>
                                                    <p className="text-sm text-gray-500">{order.supplier || 'Unknown Supplier'}</p>
                                                    {Number(order.qty) > 0 && (
                                                        <p className="text-xs text-gray-400 mt-1">Qty: {Number(String(order.qty).replace(/,/g, '')).toLocaleString()}</p>
                                                    )}
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
