import { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import {
    XMarkIcon,
    TrashIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    TableCellsIcon,
    PencilSquareIcon,
    PlusIcon
} from '@heroicons/react/24/outline';
import { useProcurement } from '../../context/ProcurementContext';
import { formatTime12h } from '../../utils/dateUtils';
import EditOrderModal from './EditOrderModal';

export default function ProcurementMasterList({ isOpen, onClose }) {
    const { poManifest, deleteOrdersBulk } = useProcurement();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Edit/Create State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);

    const handleEdit = (order) => {
        setEditingOrder(order);
        setIsEditOpen(true);
    };

    const handleCreate = () => {
        setEditingOrder(null);
        setIsEditOpen(true);
    };

    // Flatten Manifest
    const allOrders = useMemo(() => {
        const list = [];
        Object.entries(poManifest).forEach(([date, data]) => {
            if (data.items) {
                data.items.forEach(item => {
                    list.push({ ...item, date });
                });
            }
        });
        // Sort by Date Descending
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [poManifest]);

    // Filter
    const filteredOrders = useMemo(() => {
        if (!searchTerm) return allOrders;
        const lower = searchTerm.toLowerCase();
        return allOrders.filter(o =>
            (o.po || '').toLowerCase().includes(lower) ||
            (o.supplier || '').toLowerCase().includes(lower) ||
            (o.date || '').includes(lower)
        );
    }, [allOrders, searchTerm]);

    // Selection
    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
            setSelectedIds(new Set());
        } else {
            const next = new Set();
            filteredOrders.forEach(o => next.add(o.id));
            setSelectedIds(next);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedIds.size} orders ? `)) return;

        const ordersToDelete = allOrders.filter(o => selectedIds.has(o.id));
        deleteOrdersBulk(ordersToDelete);
        setSelectedIds(new Set());
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-5xl h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                                <TableCellsIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                                    Global Procurement Manager
                                </Dialog.Title>
                                <p className="text-sm text-gray-500">Manage all Inbound Orders across all dates.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg font-bold transition-colors shadow-sm"
                            >
                                <PlusIcon className="w-5 h-5" />
                                New Order
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="relative w-full max-w-md">
                            <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search PO, Supplier, or Date..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                                {selectedIds.size} selected
                            </span>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.size === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Delete Selected
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 w-12 border-b dark:border-gray-700">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">Date</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">Time</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">PO Number</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">SKU</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">Supplier</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">Trucks</th>
                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b dark:border-gray-700">Carrier</th>
                                    <th className="p-4 w-12 border-b dark:border-gray-700"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-10 text-center text-gray-400 italic">
                                            No orders found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map(order => (
                                        <tr key={order.id} className={`hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors ${selectedIds.has(order.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                            <td className="p-4">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedIds.has(order.id)}
                                                    onChange={() => toggleSelect(order.id)}
                                                />
                                            </td>
                                            <td className="p-4 text-sm font-medium text-gray-900 dark:text-white text-nowrap">
                                                {new Date(order.date + 'T00:00:00').toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                                                {formatTime12h(order.time) || '-'}
                                            </td>
                                            <td className="p-4 text-sm font-mono text-gray-600 dark:text-gray-300">
                                                {order.po}
                                            </td>
                                            <td className="p-4">
                                                {order.sku ? (
                                                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs font-bold">
                                                        {order.sku}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">Any</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                                {order.supplier}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-bold">
                                                    1 Truck
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                                {order.carrier || '-'}
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleEdit(order)}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Edit Order"
                                                >
                                                    <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <span>Showing {filteredOrders.length} of {allOrders.length} orders</span>
                        <span className="text-gray-400">Press Shift to select range (coming soon)</span>
                    </div>

                </Dialog.Panel>
            </div>

            <EditOrderModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                order={editingOrder}
            />
        </Dialog>
    );
}
