import { useState, useMemo } from 'react';
import { Dialog, Switch } from '@headlessui/react';
import { XMarkIcon, TableCellsIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { useSettings } from '../../context/SettingsContext';

export default function YMSExportModal({ isOpen, onClose }) {
    const { poManifest } = useProcurement();
    const { bottleSizes } = useSettings(); // maybe needed for weight/dims later?

    // Flatten Orders
    const allOrders = useMemo(() => {
        const list = [];
        Object.entries(poManifest).forEach(([date, data]) => {
            data.items.forEach(item => {
                list.push({ ...item, date });
            });
        });
        return list.sort((a, b) => a.date.localeCompare(b.date));
    }, [poManifest]);

    const futureOrders = allOrders.filter(o => new Date(o.date) >= new Date().setHours(0, 0, 0, 0));

    // Configuration State
    const [filename, setFilename] = useState(`YMS_Import_${new Date().toISOString().slice(0, 10)}`);
    const [includeHeaders, setIncludeHeaders] = useState(true);

    // Available Columns
    const availableColumns = [
        { id: 'date', label: 'Expected Arrival Date' },
        { id: 'po', label: 'PO Number' },
        { id: 'qty', label: 'Quantity' },
        { id: 'supplier', label: 'Supplier Name' },
        { id: 'status', label: 'Status' },
        { id: 'carrier', label: 'Carrier (Empty)' }, // Placeholder for future
        { id: 'trailer_type', label: 'Trailer Type (Dry Van)' } // Static placeholder
    ];

    // Selected Columns (Ordered)
    const [selectedColumns, setSelectedColumns] = useState(availableColumns.map(c => c.id));

    const toggleColumn = (id) => {
        if (selectedColumns.includes(id)) {
            setSelectedColumns(prev => prev.filter(c => c !== id));
        } else {
            setSelectedColumns(prev => [...prev, id]);
        }
    };

    const generateCSV = () => {
        const rows = [];

        // Header
        if (includeHeaders) {
            rows.push(selectedColumns.map(id => {
                const col = availableColumns.find(c => c.id === id);
                return col ? col.label : id;
            }).join(','));
        }

        // Data
        futureOrders.forEach(order => {
            const row = selectedColumns.map(id => {
                // Formatting Logic
                switch (id) {
                    case 'carrier': return '';
                    case 'trailer_type': return 'Dry Van';
                    case 'qty': return order.qty || 0;
                    default: return order[id] || '';
                }
            });
            rows.push(row.join(','));
        });

        return rows.join('\n');
    };

    const downloadCSV = () => {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden flex flex-col">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <Dialog.Title className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <ArrowDownTrayIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            Export for YMS
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Config: Filename */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filename</label>
                            <div className="flex items-center">
                                <input
                                    type="text"
                                    value={filename}
                                    onChange={e => setFilename(e.target.value)}
                                    className="w-full p-2 border rounded-l-lg dark:bg-gray-800 dark:border-gray-600"
                                />
                                <span className="bg-gray-100 dark:bg-gray-700 px-3 py-2 border border-l-0 rounded-r-lg text-gray-500 dark:border-gray-600">.csv</span>
                            </div>
                        </div>

                        {/* Config: Columns */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Include Columns</label>
                            <div className="grid grid-cols-2 gap-3">
                                {availableColumns.map(col => (
                                    <label key={col.id} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 border dark:border-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={selectedColumns.includes(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium dark:text-gray-200">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium dark:text-gray-300">Include Headers?</span>
                            <Switch
                                checked={includeHeaders}
                                onChange={setIncludeHeaders}
                                className={`${includeHeaders ? 'bg-blue-600' : 'bg-gray-200'
                                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${includeHeaders ? 'translate-x-6' : 'translate-x-1'}`} />
                            </Switch>
                        </div>

                        {/* Preview */}
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono text-gray-500 overflow-x-auto whitespace-pre">
                            {/* Simple Preview of Header */}
                            {includeHeaders && selectedColumns.map(id => availableColumns.find(c => c.id === id)?.label).join(',')}
                            {'\n'}
                            {/* Preview first row */}
                            {allOrders.length > 0 && selectedColumns.map(id => id === 'carrier' ? '""' : (allOrders[0][id] || '""')).join(',')}
                            {allOrders.length === 0 && "(No data to export)"}
                            ...
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                        <button
                            onClick={downloadCSV}
                            disabled={allOrders.length === 0}
                            className="px-6 py-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-bold rounded-lg shadow hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            Download CSV
                        </button>
                    </div>

                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
