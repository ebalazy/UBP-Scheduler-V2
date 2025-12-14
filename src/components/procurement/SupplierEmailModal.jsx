import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, EnvelopeIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { formatLocalDate } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';

export default function SupplierEmailModal({ isOpen, onClose, mrpResults }) {
    const { poManifest } = useProcurement();
    const results = mrpResults || {};
    const { activeSku } = useSettings();
    const [selectedDateRange, setSelectedDateRange] = useState({ start: '', end: '' });
    const [emailTemplate, setEmailTemplate] = useState('new'); // new, add, cancel
    const ignoreAutoDetect = useRef(false);

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

    const futureOrders = useMemo(() => allOrders.filter(o => new Date(o.date) >= new Date().setHours(0, 0, 0, 0)), [allOrders]);

    // --- AUTO-SUGGEST CANCELLATION ---
    useEffect(() => {
        if (isOpen && results?.trucksToCancel > 0 && selectedIds.size === 0) {
            // Find candidates: Confirmed orders, furthest out first (LIFOish for supply chain)
            const candidates = futureOrders
                .filter(o => o.status === 'confirmed')
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending Date

            const toCancel = candidates.slice(0, results.trucksToCancel);

            if (toCancel.length > 0) {
                const keys = new Set(toCancel.map(o => o.po + o.date));
                ignoreAutoDetect.current = true; // Block auto-detect
                setSelectedIds(keys);
                setEmailTemplate('cancel');
                setTimeout(() => ignoreAutoDetect.current = false, 500);
            }
        }
    }, [isOpen, results?.trucksToCancel]); // Re-run when calculation completes
    const [selectedIds, setSelectedIds] = useState(new Set());

    // --- CLEANUP ON CLOSE ---
    useEffect(() => {
        if (!isOpen) {
            setSelectedIds(new Set());
            // Reset ignores
            ignoreAutoDetect.current = false;
        }
    }, [isOpen]);

    const toggleWrapper = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };




    // Generate Email Body
    const generateBody = () => {
        const selected = futureOrders.filter(o => selectedIds.has(o.po + o.date));
        if (selected.length === 0) return '';

        const lines = selected.map(o => {
            const prefix = o.status === 'cancelled' ? '[CANCEL] ' : '';
            // New Format: PO #123: 2025-01-01 (1 Truck) - Time: 08:00 AM
            const timeStr = o.time ? ` - Time: ${o.time}` : ' - Time: TBD';
            return `- ${prefix}PO #${o.po}: ${o.date} (1 Truck)${timeStr}`;
        }).join('\n');

        const template = emailTemplates[emailTemplate] || emailTemplates.new;
        return template.body(lines);
    };

    const toggleAll = () => {
        if (selectedIds.size === futureOrders.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(futureOrders.map(o => o.po + o.date))); // composite key fallback
    };

    // --- SMART TEMPLATES ---
    const emailTemplates = {
        new: {
            subject: (count, dateRange) => `New Orders for Approval - ${activeSku}`,
            body: (orders) => `Hello Team,

Please confirm the following NEW orders for ${activeSku}:

${orders}

Please configure delivery appointments for each.

Thanks,
Planner`
        },
        add: {
            subject: (count, dateRange) => `URGENT: ADD to Schedule (Week of ${dateRange.start}) - ${activeSku}`,
            body: (orders) => `Hello Team,

Please ADD the following loads to our existing schedule for ${activeSku}:

${orders}

This is an addition to the already confirmed plan.

Thanks,
Planner`
        },
        cancel: {
            subject: (count, dateRange) => `URGENT: CANCELLATION REQUEST - ${count} Orders - ${activeSku}`,
            body: (orders) => `Hello Team,

Please CANCEL the following purchase orders immediately:

${orders}

Please confirm cancellation.

Thanks,
Planner`
        }
    };

    // --- AUTO-DETECT TEMPLATE ---
    useEffect(() => {
        if (selectedIds.size === 0) return;
        if (ignoreAutoDetect.current) return;

        const selectedList = futureOrders.filter(o => selectedIds.has(o.po + o.date));

        // 1. Detection: Cancellation
        // If ANY selected order has status 'cancelled', assume cancellation mode.
        const hasCancelled = selectedList.some(o => o.status === 'cancelled');
        if (hasCancelled) {
            setEmailTemplate('cancel');
            return;
        }

        // 2. Detection: Add vs New
        // If there are already CONFIRMED orders in this same week that are NOT in the current selection,
        // then this is likely an ADDITION to an existing plan.
        const selectedDates = new Set(selectedList.map(o => o.date));
        // Find weeks involved... simplified to just check if "other confirmed" exist nearby.
        // Let's check if there are confirmed orders on the same dates that are NOT selected.
        const hasExistingConfirmedOnSameDates = allOrders.some(o =>
            selectedDates.has(o.date) &&
            !selectedIds.has(o.po + o.date) &&
            o.status === 'confirmed'
        );

        if (hasExistingConfirmedOnSameDates) {
            setEmailTemplate('add');
        } else {
            setEmailTemplate('new');
        }

    }, [selectedIds, futureOrders, allOrders]);
    const getSubject = () => {
        const selected = futureOrders.filter(o => selectedIds.has(o.po + o.date));
        const template = emailTemplates[emailTemplate] || emailTemplates.new;
        // Calculate dynamic range string... for now simplified
        return template.subject(selected.length, { start: selected[0]?.date || '...' });
    };

    const copyToClipboard = () => {
        const text = `Subject: ${getSubject()}\n\n${generateBody()}`;
        navigator.clipboard.writeText(text);
        // Show status could be added here
        alert("Email copied to clipboard!");
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

                    {/* Template Selector */}
                    <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4">
                        <span className="text-xs font-bold text-gray-500 uppercase">Email Type:</span>
                        <div className="flex gap-2">
                            {['new', 'add', 'cancel'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setEmailTemplate(t)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors ${emailTemplate === t
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {t === 'new' ? 'New Orders' : t === 'add' ? 'Add to Schedule' : 'Cancellation'}
                                </button>
                            ))}
                        </div>
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
