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
import { useProducts } from '../../context/ProductsContext';
import { addDays, formatLocalDate, formatTime12h } from '../../utils/dateUtils';
import { calculateDeliveryTime } from '../../utils/schedulerUtils';

export default function ScheduleManagerModal({ isOpen, onClose, date, orders = [], monthlyInbound, updateDateInbound }) {
    const { updateDailyManifest, addOrdersBulk, removeOrder, updateOrder } = useProcurement();
    const { schedulerSettings, activeSku } = useSettings();
    const { getProductSpecs, productMap: bottleDefinitions } = useProducts();

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [moveTargetDate, setMoveTargetDate] = useState('');
    const [movingId, setMovingId] = useState(null);

    // Sorted Orders (Time Ascending)
    const sortedOrders = [...orders].sort((a, b) => {
        // Robust Sort: Convert "HH:MM" to minutes for comparison.
        // Determines order: 9:00 (540m) < 10:00 (600m).
        const getMinutes = (t) => {
            if (!t || t === '00:00') return 99999; // No time = End of Day
            const [h, m] = t.split(':').map(Number);
            return (h * 60) + (m || 0);
        };
        return getMinutes(a.time) - getMinutes(b.time);
    });

    // Helpers
    // Business Rule: 1 PO = 1 Truck (Always)
    // TODO: Implement LTL (Less Than Truckload) logic here if 'qty' < 20 pallets.
    const getTruckCount = (qty) => "1.0"; // Always 1 truck for now
    const getTruckFloat = (qty) => 1.0;

    // --- ESTIMATION LOGIC (Shared with Import) ---
    const getEstimatedTime = (index) => {
        if (!schedulerSettings) return 'TBD (Settings)';

        const order = sortedOrders[index];
        const sku = order?.sku || activeSku;

        // Try New Context first, fallback to Legacy Settings
        const specs = getProductSpecs(sku) || bottleDefinitions?.[sku];

        if (!specs) return 'TBD (No SKU)';

        // Ensure numeric values
        const rate = Number(specs.productionRate);
        const capacity = Number(specs.bottlesPerTruck);

        if (!rate || rate <= 0) return 'TBD (No Rate)';
        if (!capacity) return 'TBD (No Cap)';

        const time24 = calculateDeliveryTime(
            index,
            schedulerSettings.shiftStartTime || '06:00',
            capacity,
            rate,
            Number(specs.bottlesPerCase) || 1,
            Math.max(sortedOrders.length, Math.round(Number(monthlyInbound[date] || 0))) // Total Trucks for Compression
        );

        return time24 ? formatTime12h(time24) : 'TBD';
    };

    // Recalculate Daily Total based on active orders
    const syncTruckCount = (targetDate, newOrdersList) => {
        if (!updateDateInbound) return;
        // Business Rule: Total Trucks = Number of POs
        const totalTrucks = newOrdersList.length;
        updateDateInbound(targetDate, totalTrucks);
    };

    // --- CONFIRMATION STATE ---
    const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm, type: 'danger'|'info' }

    const performDelete = (orderId) => {
        const orderToDelete = orders.find(o => o.id === orderId);
        removeOrder(date, orderId, orderToDelete?.po);
        const remaining = orders.filter(o => o.id !== orderId);
        syncTruckCount(date, remaining);
        setConfirmAction(null);
    };

    const handleDeleteClick = (orderId) => {
        setConfirmAction({
            title: 'Cancel Delivery?',
            message: 'Are you sure you want to remove this delivery? This action cannot be undone if not synced with SAP.',
            type: 'danger',
            onConfirm: () => performDelete(orderId)
        });
    };

    const performReceive = (order) => {
        updateOrder(date, { ...order, status: 'received' });
        setConfirmAction(null);
    };

    const handleReceiveClick = (order) => {
        // Immediate action as requested by user ("just delete" implies keep delete confirm, remove others)
        performReceive(order);
    };

    // Actions
    // Old 'handleDelete' removed. Use 'handleDeleteClick' for UI confirmation flow.

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

                    {/* CONFIRMATION OVERLAY (Window Style) */}
                    {confirmAction && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fadeIn">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm flex flex-col items-center text-center transform transition-all scale-100">
                                <div className={`p-4 rounded-full mb-4 ${confirmAction.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {confirmAction.type === 'danger' ? <TrashIcon className="w-8 h-8" /> : <CheckCircleIcon className="w-8 h-8" />}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{confirmAction.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">{confirmAction.message}</p>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setConfirmAction(null)}
                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => confirmAction.onConfirm()}
                                        className={`flex-1 px-4 py-2 rounded-lg text-white font-bold shadow-lg transition-transform hover:scale-105 ${confirmAction.type === 'danger'
                                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
                                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
                                            }`}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-6 overflow-y-auto space-y-4">
                        {/* Summary Header if trucks are expected */}
                        {(orders.length > 0 || (monthlyInbound && Number(monthlyInbound[date] || 0) > 0)) && (
                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md mb-2">
                                <div className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                    <span className="text-xl">ℹ️</span>
                                    <span>
                                        <strong>{Math.round(Number(monthlyInbound[date] || orders.length))} Trucks Planned</strong>
                                        {orders.length === 0 ? " via Auto-Replenishment." : ` (${orders.length} SAP/Manual, ${Math.max(0, Math.round(Number(monthlyInbound[date] || 0)) - orders.length)} Suggested)`}
                                    </span>
                                </div>
                                <button
                                    onClick={handleCopyPlan}
                                    className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                                        }`}
                                >
                                    {copied ? <><CheckCircleIcon className="w-4 h-4 mr-1.5" />Copied!</> : <><ClipboardDocumentCheckIcon className="w-4 h-4 mr-1.5" />Copy Plan</>}
                                </button>
                            </div>
                        )}

                        {/* 1. ACTUAL SCHEDULED LOADS (Solid Boxes) */}
                        {orders.length > 0 && (
                            <div className="space-y-4">
                                {sortedOrders.map((order, idx) => (
                                    <div key={order.id || idx} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm p-4 relative group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                        {editingId === order.id ? (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">PO Number</label>
                                                        <input
                                                            type="text"
                                                            className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1"
                                                            value={editForm.po || ''}
                                                            onChange={e => setEditForm(prev => ({ ...prev, po: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Appointment</label>
                                                        <input
                                                            type="time"
                                                            className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1"
                                                            value={editForm.time || ''}
                                                            onChange={e => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Supplier</label>
                                                        <input
                                                            type="text"
                                                            className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white mt-1"
                                                            value={editForm.supplier || ''}
                                                            onChange={e => setEditForm(prev => ({ ...prev, supplier: e.target.value }))}
                                                        />
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
                                                    <button onClick={() => setEditingId(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                                                    <button onClick={saveEdit} className="flex items-center text-sm font-bold text-green-600 hover:text-green-700">
                                                        <CheckCircleIcon className="w-5 h-5 mr-1" />Save Changes
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
                                                            <span className="font-mono">{(order.time && order.time !== '00:00') ? formatTime12h(order.time) : (getEstimatedTime(idx))}</span>
                                                            <span className="mx-2 text-gray-300">|</span>
                                                            PO #{order.po}
                                                            {order.source === 'sap' && (
                                                                <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 text-[10px] rounded-full font-bold uppercase tracking-tighter">
                                                                    SAP
                                                                </span>
                                                            )}
                                                            <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs rounded-full font-bold">
                                                                1 Truck
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const currentStatus = order.status || 'ordered';
                                                                    if (currentStatus === 'received') {
                                                                        if (confirm("Revert 'Received' status?")) updateOrder(date, { ...order, status: 'ordered' });
                                                                    } else {
                                                                        updateOrder(date, { ...order, status: currentStatus === 'confirmed' ? 'ordered' : 'confirmed' });
                                                                    }
                                                                }}
                                                                className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold border transition-colors ${order.status === 'received' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : (order.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200')}`}
                                                            >
                                                                {order.status === 'received' ? 'Received' : (order.status === 'confirmed' ? 'Confirmed' : (order.source === 'sap' ? 'Imported' : 'Ordered'))}
                                                            </button>
                                                        </h3>
                                                        <div className="flex flex-col gap-1 mt-1">
                                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                                <span className="truncate max-w-[200px]">{order.supplier || order.vendor || 'Unknown Supplier'}</span>
                                                                <span className="text-gray-300">|</span>
                                                                <span className="text-gray-600 dark:text-gray-400 font-bold">{order.sku || activeSku}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {order.status !== 'received' && (
                                                        <button onClick={() => handleReceiveClick(order)} className="p-2 text-gray-400 hover:text-emerald-600" title="Mark as Received"><CheckCircleIcon className="w-5 h-5" /></button>
                                                    )}
                                                    <button onClick={() => { startEdit(order); startMove(order.id); }} className="p-2 text-gray-400 hover:text-blue-600" title="Edit"><PencilSquareIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleDeleteClick(order.id)} className="p-2 text-gray-400 hover:text-red-600" title="Cancel"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 2. SUGGESTED LOADS (Dashed Boxes) */}
                        {monthlyInbound && Math.round(Number(monthlyInbound[date] || 0)) > orders.length && (
                            <div className="space-y-4 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                {Array.from({ length: Math.round(Number(monthlyInbound[date])) - orders.length }).map((_, i) => (
                                    <div key={`suggested-${i}`} className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 flex items-center justify-between opacity-75 grayscale hover:grayscale-0 hover:border-blue-300 transition-all cursor-help" title="Suggested by Auto-Replenishment">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-lg">
                                                <TruckIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-500 dark:text-gray-400 italic">Suggested Load #{orders.length + i + 1}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                                        <ClockIcon className="w-3 h-3 mr-1" />
                                                        Est. {getEstimatedTime(orders.length + i)}
                                                    </div>
                                                    <span className="text-xs text-gray-400">Awaiting PO</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 rounded-full uppercase tracking-widest text-[9px]">Auto-Plan</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {orders.length === 0 && (!monthlyInbound || Number(monthlyInbound[date] || 0) <= 0) && (
                            <div className="text-center py-10 text-gray-400 italic bg-gray-50 dark:bg-gray-800 rounded-lg">
                                No deliveries scheduled or suggested for this day.
                            </div>
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
