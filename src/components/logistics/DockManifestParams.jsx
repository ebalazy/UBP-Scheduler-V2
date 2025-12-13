import { useState } from 'react';
import { formatTime12h } from '../../utils/dateUtils';
import {
    TruckIcon,
    ClockIcon,
    QrCodeIcon,
    PencilSquareIcon,
    PlusCircleIcon,
    TrashIcon
} from '@heroicons/react/24/outline';

export default function DockManifestParams({ date, totalRequired, manifest, onUpdate }) {
    // manifest = Array of { id, po, carrier, time, status }
    // totalRequired = Number from AutoReplenish

    const [isEditing, setIsEditing] = useState(false);

    // If no manifest details exist but we have a requirement, we show "TBD" slots.
    // We merge the "Required Count" with the "Actual Manifest Details".

    // We want to ensure at least 'totalRequired' slots are visible.
    // If manifest.length > totalRequired, we show all manifest items.
    // If manifest.length < totalRequired, we show manifest + (totalRequired - manifest) placeholders.

    const existingItems = manifest || [];
    const needed = Math.max(existingItems.length, totalRequired);
    const placeholders = Math.max(0, needed - existingItems.length);

    // Editing State
    const [editList, setEditList] = useState(existingItems);

    const handleSave = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log("Handle Save Clicked", { date, editList });
        onUpdate(date, editList);
        setIsEditing(false);
    };

    const handleAdd = () => {
        setEditList([...editList, { id: crypto.randomUUID(), po: '', carrier: '', time: '', status: 'scheduled' }]);
    };

    const handleRemove = (index) => {
        const newList = [...editList];
        newList.splice(index, 1);
        setEditList(newList);
    };

    const handleChange = (index, field, val) => {
        const newList = [...editList];
        newList[index] = { ...newList[index], [field]: val };
        setEditList(newList);
    };

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-900 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                        <PencilSquareIcon className="w-5 h-5 mr-2 text-blue-500" />
                        Edit Manifest: {date}
                    </h3>
                    <div className="space-x-2">
                        <button type="button" onClick={() => setIsEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                        <button type="button" onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded shadow hover:bg-blue-500">
                            Save Changes
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    {editList.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex-1">
                                <label className="text-[10px] uppercase text-gray-400 font-bold">Carrier</label>
                                <input
                                    className="w-full text-sm font-bold bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none dark:text-white"
                                    placeholder="Carrier Name"
                                    value={item.carrier}
                                    onChange={e => handleChange(idx, 'carrier', e.target.value)}
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-[10px] uppercase text-gray-400 font-bold">PO #</label>
                                <input
                                    className="w-full text-sm font-mono bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none dark:text-white"
                                    placeholder="PO-123"
                                    value={item.po}
                                    onChange={e => handleChange(idx, 'po', e.target.value)}
                                />
                            </div>
                            <div className="w-20">
                                <label className="text-[10px] uppercase text-gray-400 font-bold">Time</label>
                                <select
                                    className="w-full text-sm bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none dark:text-gray-200 dark:bg-gray-800 rounded px-1"
                                    value={item.time}
                                    onChange={e => handleChange(idx, 'time', e.target.value)}
                                >
                                    <option value="" className="text-gray-500">TBD</option>
                                    {Array.from({ length: 24 }).map((_, i) => {
                                        const h = i;
                                        const m = 0;
                                        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                        const ampm = h >= 12 ? 'PM' : 'AM';
                                        const h12 = h % 12 || 12;
                                        const label = `${h12}:00 ${ampm}`;
                                        return <option key={timeStr} value={timeStr} className="dark:bg-gray-800">{label}</option>
                                    })}
                                </select>
                            </div>
                            <button type="button" onClick={() => handleRemove(idx)} className="text-red-400 hover:text-red-600 p-1">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    <button onClick={handleAdd} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center text-sm font-bold">
                        <PlusCircleIcon className="w-4 h-4 mr-1" /> Add Truck
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    {/* No header needed if context is clear */}
                </div>
                {/* Only show Edit button if there are trucks expected */}
                {(totalRequired > 0 || existingItems.length > 0) && (
                    <button
                        onClick={() => { setEditList(existingItems.length ? existingItems : Array(totalRequired).fill().map(() => ({ id: crypto.randomUUID(), po: '', carrier: '', time: '' }))); setIsEditing(true); }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-500 flex items-center bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                    >
                        <PencilSquareIcon className="w-3 h-3 mr-1" />
                        Edit Manifest
                    </button>
                )}
            </div>

            {/* Confirmed items */}
            {existingItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-l-4 border-green-500 shadow-sm rounded-r-md">
                    <div>
                        <div className="flex items-center space-x-2">
                            {/* Prefer Carrier if assigned, else Supplier, else generic */}
                            <span className="font-bold text-gray-900 dark:text-white text-lg">
                                {item.carrier || item.supplier || "Pending Assignment"}
                            </span>
                            {item.time && (
                                <span className="ml-2 text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded flex items-center shadow-sm">
                                    <ClockIcon className="w-4 h-4 mr-1" />
                                    {formatTime12h(item.time)}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col text-xs text-gray-500 mt-1">
                            {/* Explicitly show PO and Supplier if available */}
                            <div className="flex items-center">
                                <QrCodeIcon className="w-3 h-3 mr-1" />
                                <span className="font-mono text-gray-700 dark:text-gray-300 font-bold mr-2">
                                    PO: {item.po || "N/A"}
                                </span>
                                {item.supplier && item.carrier && (
                                    <span className="text-gray-400">({item.supplier})</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {/* Placeholders for Auto-Replenish slots that are NOT yet manifested */}
            {Array.from({ length: placeholders }).map((_, i) => (
                <div key={`p-${i}`} className="flex items-center justify-between p-3 bg-gray-50 border-l-4 border-gray-300 dark:border-gray-600 dark:bg-gray-800/50 rounded-r-md opacity-70 dashed-border">
                    <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <TruckIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-500 italic">Planned Delivery Slot #{existingItems.length + i + 1}</p>
                            <div className="flex items-center text-xs text-gray-400 mt-0.5">
                                <span>Awaiting Carrier Assignment</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {needed === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm italic bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    No Deliveries Needed
                </div>
            )}
        </div>
    );
}
