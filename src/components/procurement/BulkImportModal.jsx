import { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ArrowUpTrayIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { useSettings } from '../../context/SettingsContext';
import { calculateJITSchedule } from '../../utils/jitScheduler';

export default function BulkImportModal({ isOpen, onClose }) {
    const { addOrdersBulk } = useProcurement();
    const { bottleDefinitions, schedulerSettings } = useSettings();
    const [step, setStep] = useState(1); // 1: Paste, 2: Map, 3: Review
    const [rawText, setRawText] = useState('');
    const [parsedPreview, setParsedPreview] = useState([]);

    // Mapping State: Which index corresponds to which field?
    const [mapping, setMapping] = useState({
        po: -1,
        date: -1,
        qty: -1,
        supplier: -1,
        sku: -1
    });

    // 1. Parse Helper
    const parseRaw = (text) => {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length === 0) return [];
        // Detect delimiter (Tab vs Comma)
        const firstLine = lines[0];
        const isTab = firstLine.includes('\t');
        const delimiter = isTab ? '\t' : ',';

        return lines.map(line => line.split(delimiter).map(c => c.trim()));
    };

    const handleNext = () => {
        if (step === 1) {
            const data = parseRaw(rawText);
            setParsedPreview(data.slice(0, 5)); // Preview top 5
            setStep(2);
        } else if (step === 2) {
            handleImport();
        }
    };

    // Helper: Parse strange Excel dates like "12-Dec" or "Dec-12"
    const parseFlexibleDate = (input) => {
        if (!input) return null;
        const str = input.trim();

        // 1. Try standard YYYY-MM-DD
        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;

        // 2. Handle "12-Dec" (DD-MMM) or "Dec-12" (MMM-DD)
        const parts = str.split(/[\-\s\/]/);
        if (parts.length === 2 || parts.length === 3) {
            // Check for Month Name
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            let day, month, year = new Date().getFullYear();

            const p1 = parts[0].toLowerCase();
            const p2 = parts[1].toLowerCase();
            const p3 = parts[2] ? parts[2].toLowerCase() : null; // Year is rare in default excel 'dd-mmm'

            if (months[p2] !== undefined) {
                // "12-Dec" -> p1=12, p2=dec
                day = parseInt(p1);
                month = months[p2];
            } else if (months[p1] !== undefined) {
                // "Dec-12" -> p1=dec, p2=12
                month = months[p1];
                day = parseInt(p2);
            }

            if (day && month !== undefined) {
                // Return YYYY-MM-DD
                return new Date(year, month, day).toISOString().split('T')[0];
            }
        }

        // Fallback: Let Browser Try
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

        return null;
    };

    const cleanPO = (val) => {
        if (!val) return '';
        // Fix Scientific Notation "4.1E+09" -> "4100000000"
        if (val.match(/^\d+(\.\d+)?[eE]\+\d+$/)) {
            return Number(val).toLocaleString('fullwide', { useGrouping: false });
        }
        return val;
    };

    const cleanQty = (val) => {
        if (!val) return 0;
        // Remove currency symbols, commas, spaces
        const clean = String(val).replace(/[^0-9.\-]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    const handleImport = () => {
        const data = parseRaw(rawText);
        let successCount = 0;

        // Convert to Objects
        const orders = data.map(row => {
            const rawDate = row[mapping.date];
            const parsedDate = parseFlexibleDate(rawDate);

            // Skip invalid dates but dont fail entire batch
            if (!parsedDate) return null;

            return {
                id: crypto.randomUUID(),
                po: cleanPO(row[mapping.po]),
                date: parsedDate,
                qty: cleanQty(row[mapping.qty]),
                supplier: row[mapping.supplier] || 'Unknown',
                sku: row[mapping.sku] || mapping.defaultSku || '', // Optional SKU
                status: 'planned'
            };
        }).filter(o => {
            if (o && o.po && o.date) {
                successCount++;
                return true;
            }
            return false;
        });

        // Apply Smart Scheduling (JIT)
        const scheduledOrders = calculateJITSchedule(orders, {
            bottleDefinitions,
            schedulerSettings
        });

        addOrdersBulk(scheduledOrders);

        // Success Feedback
        alert(`Successfully imported ${successCount} orders! Check the Planning Grid for blue badges.`);

        onClose();
        // Reset
        setRawText('');
        setStep(1);
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                Copy your rows from Excel or SAP and paste them below.
                Make sure to include the <strong>PO Number</strong> and <strong>Delivery Date</strong>.
            </p>
            <textarea
                className="w-full h-64 p-3 border rounded-lg font-mono text-xs bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                placeholder={`Example:\n450001234\t2023-10-25\t44000\tSupplier A\n450001235\t2023-10-26\t22000\tSupplier B`}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
            />
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-lg">
                Identify the columns. We found <strong>{parseRaw(rawText).length} rows</strong>.
            </div>

            {/* PREVIEW TABLE */}
            <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase">
                        <tr>
                            {parsedPreview[0]?.map((_, idx) => (
                                <th key={idx} className="p-2 border-b dark:border-gray-700 min-w-[120px]">
                                    <div className="mb-2">Column {idx + 1}</div>
                                    <select
                                        className="w-full p-1 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                                        value={Object.keys(mapping).find(key => mapping[key] === idx) || ''}
                                        onChange={(e) => {
                                            const field = e.target.value;
                                            setMapping(prev => {
                                                const next = { ...prev };
                                                if (!field) {
                                                    const key = Object.keys(next).find(k => next[k] === idx);
                                                    if (key) next[key] = -1;
                                                    return next;
                                                }
                                                next[field] = idx;
                                                return next;
                                            });
                                        }}
                                    >
                                        <option value="">-- Ignore --</option>
                                        <option value="po">PO Number *</option>
                                        <option value="date">Date *</option>
                                        <option value="qty">Quantity</option>
                                        <option value="supplier">Supplier</option>
                                        <option value="sku">Material / SKU</option>
                                    </select>
                                </th>
                            ))}
                            {/* Preview Column */}
                            {mapping.qty !== -1 && (
                                <th className="p-2 border-b dark:border-gray-700 w-[100px] bg-blue-50 dark:bg-blue-900/10">
                                    <div className="mb-2 text-blue-600">Detected Qty</div>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {parsedPreview.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                {row.map((cell, cIdx) => (
                                    <td key={cIdx} className={`p-2 font-mono truncate max-w-[150px] ${Object.values(mapping).includes(cIdx) ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                                        {cell}
                                    </td>
                                ))}
                                {mapping.qty !== -1 && (
                                    <td className="p-2 font-mono font-bold text-blue-600 bg-blue-50/50">
                                        {row[mapping.qty] ? cleanQty(row[mapping.qty]).toLocaleString() : '-'}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-red-500">* Required Fields</p>
        </div>
    );

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50" >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <Dialog.Title className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <ArrowUpTrayIcon className="w-5 h-5 text-blue-600" />
                            Import Purchase Orders
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                        {step === 2 && (
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={rawText.trim().length === 0 || (step === 2 && (mapping.po === -1 || mapping.date === -1))}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {step === 1 ? 'Next: Map Columns' : `Import ${parseRaw(rawText).length} Orders`}
                        </button>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog >
    );
}
