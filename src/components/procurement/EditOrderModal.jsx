import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, CalendarIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';

export default function EditOrderModal({ isOpen, onClose, order, date }) {
    // If order is provided, we are Editing. If null, we are Creating.
    // If Creating, 'date' might be a default, or today.

    const { addOrdersBulk, updateOrder, moveOrder } = useProcurement();

    // Form State
    const [formData, setFormData] = useState({
        po: '',
        date: '',
        qty: '',
        supplier: '',
        carrier: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (order) {
                // Edit Mode
                setFormData({
                    po: order.po,
                    date: date || order.date, // 'date' prop overrides order.date? Usually they match.
                    qty: order.qty,
                    supplier: order.supplier,
                    carrier: order.carrier || ''
                });
            } else {
                // Create Mode
                setFormData({
                    po: '',
                    date: date || new Date().toISOString().split('T')[0],
                    qty: '',
                    supplier: '',
                    carrier: ''
                });
            }
        }
    }, [isOpen, order, date]);

    const handleSave = () => {
        // Validation
        if (!formData.po || !formData.date || !formData.qty) {
            alert("PO, Date, and Quantity are required.");
            return;
        }

        const newOrder = {
            id: order?.id || crypto.randomUUID(), // Preserve ID if editing
            po: formData.po,
            date: formData.date,
            qty: Number(formData.qty),
            supplier: formData.supplier || 'Unknown',
            carrier: formData.carrier
        };

        if (order) {
            // EDIT MODE
            if (formData.date !== order.date) {
                // Date Changed -> Move
                moveOrder(order.date, formData.date, newOrder);
            } else {
                // Same Date -> Update In Place
                updateOrder(formData.date, newOrder);
            }
        } else {
            // CREATE MODE
            addOrdersBulk([newOrder]);
        }

        onClose();
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                            {order ? 'Edit Order' : 'New Purchase Order'}
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* PO Number */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PO Number</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={formData.po}
                                onChange={e => setFormData({ ...formData, po: e.target.value })}
                                autoFocus
                            />
                        </div>

                        {/* Date (Reschedule) */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Delivery Date</label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full pl-8 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={formData.qty}
                                onChange={e => setFormData({ ...formData, qty: e.target.value })}
                            />
                        </div>

                        {/* Supplier */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supplier</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={formData.supplier}
                                onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                            />
                        </div>

                        {/* Carrier */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Carrier (Optional)</label>
                            <div className="relative">
                                <TruckIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full pl-8 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.carrier}
                                    onChange={e => setFormData({ ...formData, carrier: e.target.value })}
                                />
                            </div>
                        </div>

                    </div>

                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-500"
                        >
                            Save Order
                        </button>
                    </div>

                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
