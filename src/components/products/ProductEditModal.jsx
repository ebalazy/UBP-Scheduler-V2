import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'; // Need to ensure imports exist

export default function ProductEditModal({ isOpen, onClose, product, onSave, readOnly = false }) {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        bottles_per_case: 12,
        bottles_per_truck: 20000,
        cases_per_pallet: 100,
        lines: [] // Array of { line_name: 'Line 1', production_rate: 2500 }
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (product) {
                setFormData({
                    name: product.name,
                    description: product.description || '',
                    color_tag: product.color_tag || '#3B82F6',
                    bottles_per_case: product.bottles_per_case || 24,
                    cases_per_pallet: product.cases_per_pallet || 100, // FG Pallet
                    bottles_per_truck: product.bottles_per_truck || 100000, // Raw Material Count
                    lines: product.production_settings?.length > 0
                        ? product.production_settings.map(s => ({ line_name: s.line_name, production_rate: s.production_rate }))
                        : [{ line_name: 'Line 1', production_rate: 2500 }]
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    color_tag: '#3B82F6', // Default Blue
                    bottles_per_case: 24,
                    cases_per_pallet: 100,
                    bottles_per_truck: 100000,
                    lines: [{ line_name: 'Line 1', production_rate: 2500 }]
                });
            }
            setError(null);
        }
    }, [isOpen, product]);

    const handleAddLine = () => {
        setFormData(prev => ({
            ...prev,
            lines: [...prev.lines, { line_name: `Line ${prev.lines.length + 1}`, production_rate: 2500 }]
        }));
    };

    const handleRemoveLine = (index) => {
        setFormData(prev => ({
            ...prev,
            lines: prev.lines.filter((_, i) => i !== index)
        }));
    };

    const handleLineChange = (index, field, value) => {
        const newLines = [...formData.lines];
        newLines[index][field] = value;
        setFormData({ ...formData, lines: newLines });
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || readOnly) return;
        setIsSaving(true);
        setError(null);

        try {
            // 1. Upsert Product
            const productPayload = {
                name: formData.name,
                description: formData.description,
                color_tag: formData.color_tag,
                bottles_per_case: Number(formData.bottles_per_case),
                bottles_per_truck: Number(formData.bottles_per_truck),
                cases_per_pallet: Number(formData.cases_per_pallet),
                user_id: user.id
            };

            if (product?.id) {
                productPayload.id = product.id;
            }

            const { data: savedProduct, error: prodError } = await supabase
                .from('products')
                .upsert(productPayload, { onConflict: 'name' })
                .select()
                .single();

            if (prodError) throw prodError;

            // 2. Upsert Production Settings (Batch)
            // Note: We are not deleting removed lines yet (complexity trade-off), just upserting valid ones.
            const settingsPayload = formData.lines.map(line => ({
                product_id: savedProduct.id,
                user_id: user.id,
                line_name: line.line_name || 'Line 1',
                production_rate: Number(line.production_rate)
            }));

            const { error: settingsError } = await supabase
                .from('production_settings')
                .upsert(settingsPayload, { onConflict: 'product_id, line_name' });

            if (settingsError) throw settingsError;

            onSave();
            onClose();
        } catch (err) {
            console.error("Save Error:", err);
            setError(err.message || "Failed to save product");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                    <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        {readOnly ? 'View Product Configuration' : (product ? 'Edit Product Configuration' : 'Add New Product')}
                    </Dialog.Title>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 1. Identification */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Identification</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">SKU Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        disabled={!!product || readOnly}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                        placeholder="e.g. 20oz Cola"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Display Color</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="color"
                                            value={formData.color_tag}
                                            onChange={e => setFormData({ ...formData, color_tag: e.target.value })}
                                            disabled={readOnly}
                                            className="h-9 w-12 rounded cursor-pointer border-0 p-0 disabled:opacity-50"
                                        />
                                        <span className="text-xs text-gray-400">Calendar Tag</span>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Description (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        disabled={readOnly}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                                        placeholder="e.g. Standard 24pk Tray"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Finished Goods Spec */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">📦 Finished Product Spec</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Pack Size</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.bottles_per_case}
                                            onChange={e => setFormData({ ...formData, bottles_per_case: e.target.value })}
                                            disabled={readOnly}
                                            className="w-full px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 text-sm font-bold disabled:opacity-50"
                                        />
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400">units/case</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Pallet Count</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.cases_per_pallet}
                                            onChange={e => setFormData({ ...formData, cases_per_pallet: e.target.value })}
                                            disabled={readOnly}
                                            className="w-full px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 text-sm font-bold disabled:opacity-50"
                                        />
                                        <span className="text-xs text-emerald-600 dark:text-emerald-400">cases/plt</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Raw Material Truck Spec */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">🚛 Raw Material Truck Spec</h3>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Inbound Truck Quantity</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="100"
                                        value={formData.bottles_per_truck}
                                        onChange={e => setFormData({ ...formData, bottles_per_truck: e.target.value })}
                                        disabled={readOnly}
                                        className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 text-lg font-black tracking-tight disabled:opacity-50"
                                    />
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">units / truck</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Total quantity of empty bottles/cans on a single full truckload.</p>
                            </div>
                        </div>

                        {/* Line Configuration */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider">Production Lines</h3>
                                {!readOnly && (
                                    <button type="button" onClick={handleAddLine} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                        <PlusIcon className="w-3 h-3" /> Add Line
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {formData.lines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={line.line_name}
                                            onChange={e => handleLineChange(idx, 'line_name', e.target.value)}
                                            placeholder="Line Name"
                                            disabled={readOnly}
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm disabled:opacity-50"
                                        />
                                        <input
                                            type="number"
                                            value={line.production_rate}
                                            onChange={e => handleLineChange(idx, 'production_rate', e.target.value)}
                                            placeholder="CPH"
                                            disabled={readOnly}
                                            className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-right disabled:opacity-50"
                                        />
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLine(idx)}
                                                className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                title="Remove Line"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {formData.lines.length === 0 && (
                                    <p className="text-xs text-center text-gray-400 py-2">No active production lines.</p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                {readOnly ? 'Close' : 'Cancel'}
                            </button>
                            {!readOnly && (
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                                >
                                    {isSaving ? 'Saving...' : 'Save Configuration'}
                                </button>
                            )}
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
