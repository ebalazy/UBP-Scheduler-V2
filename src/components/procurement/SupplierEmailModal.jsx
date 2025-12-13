import { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, EnvelopeIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { formatLocalDate } from '../../utils/dateUtils';

export default function SupplierEmailModal({ isOpen, onClose }) {
    const { poManifest } = useProcurement();
    const [selectedDateRange, setSelectedDateRange] = useState({ start: '', end: '' });
    const [emailTemplate, setEmailTemplate] = useState('standard'); // standard, urgent

    // Default to 'Next Week'
    useMemo(() => {
        if (!isOpen) return;
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        // setSelectedDateRange... (actually let's just show all future POs by default or simple filter)
    }, [isOpen]);

    // Flatten Manifest to List
    const allOrders = useMemo(() => {
        const list = [];
        Object.entries(poManifest).sort().forEach(([date, data]) => {
            data.items.forEach(item => {
                list.push({ ...item, date });
            });
        });
        return list;
    }, [poManifest]);

    const futureOrders = allOrders.filter(o => new Date(o.date) >= new Date().setHours(0, 0, 0, 0));

    // Selection State
    const [selectedIds, setSelectedIds] = useState(new Set());

    const toggleWrapper = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === futureOrders.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(futureOrders.map(o => o.po + o.date))); // composite key fallback
    };

    // Generate Email Body
    const generateBody = () => {
        const selected = futureOrders.filter(o => selectedIds.has(o.po + o.date));
        if (selected.length === 0) return '';

        const lines = selected.map(o => {
            return `- PO #${o.po}: Deliver on ${o.date} (${o.qty} units)`;
        }).join('\n');

        return `Hello Team,

Please confirm the following orders:

${lines}

Please confirm delivery times for each.

Thanks,
Planner`;
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generateBody());
        // Show toast?
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <Dialog.Title className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <EnvelopeIcon className="w-5 h-5 text-indigo-600" />
                            Email Supplier
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* 1. SELECTION LIST (Left) */}
                        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <h3 className="text-xs font-bold uppercase text-gray-500">Available Orders</h3>
                                <button onClick={toggleAll} className="text-xs text-blue-600 font-bold hover:underline">
                                    {selectedIds.size === futureOrders.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="overflow-y-auto p-2 space-y-2 flex-1">
                                {futureOrders.length === 0 && <p className="text-center text-sm text-gray-400 mt-10">No future orders found.</p>}
                                {futureOrders.map((order, idx) => {
                                    const key = order.po + order.date;
                                    const isSelected = selectedIds.has(key);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => toggleWrapper(key)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${isSelected
                                                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-700'
                                                : 'bg-white border-gray-100 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700'}`}
                                        >
                                            <div>
                                                <div className="font-bold text-sm text-gray-800 dark:text-gray-200">PO #{order.po}</div>
                                                <div className="text-xs text-gray-500">{order.date} • {order.qty ? order.qty.toLocaleString() : '-'} units</div>
                                            </div>
                                            {isSelected && <div className="w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 2. PREVIEW (Right) */}
                        <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900/50">
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-xs font-bold uppercase text-gray-500">Email Preview</h3>
                            </div>
                            <div className="flex-1 p-4">
                                <textarea
                                    className="w-full h-full p-4 text-sm font-mono border rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                                    value={generateBody()}
                                    readOnly
                                />
                            </div>
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                                <button
                                    onClick={copyToClipboard}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all active:scale-95"
                                >
                                    <ClipboardDocumentIcon className="w-4 h-4" />
                                    Copy to Clipboard
                                </button>
                            </div>
                        </div>
                    </div>

                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
