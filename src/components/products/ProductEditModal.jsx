import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'; // Need to ensure imports exist

export default function ProductEditModal({ isOpen, onClose, product, onSave }) {
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
                    internal_sku: product.internal_sku || '',
                    customer_sku: product.customer_sku || '',
                    color_tag: product.color_tag || '#3B82F6',
                    bottles_per_case: product.bottles_per_case || 12,
                    bottles_per_truck: product.bottles_per_truck || 20000,
                    cases_per_pallet: product.cases_per_pallet || 100,
                    ti: product.ti || 0,
                    hi: product.hi || 0,
                    case_weight: product.case_weight || 0,
                    pallet_type: product.pallet_type || 'CHEP',
                    lines: product.production_settings?.length > 0
                        ? product.production_settings.map(s => ({ line_name: s.line_name, production_rate: s.production_rate }))
                        : [{ line_name: 'Line 1', production_rate: 2500 }]
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    internal_sku: '',
                    customer_sku: '',
                    color_tag: '#3B82F6', // Default Blue
                    bottles_per_case: 12,
                    bottles_per_truck: 20000,
                    cases_per_pallet: 100,
                    ti: 10,
                    hi: 10,
                    case_weight: 0,
                    pallet_type: 'CHEP',
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

    const handleTiHiChange = (field, value) => {
        const val = Number(value);
        const newState = { ...formData, [field]: val };

        // Auto-calc total cases if both are present
        if (field === 'ti' && newState.hi > 0) {
            newState.cases_per_pallet = val * newState.hi;
        } else if (field === 'hi' && newState.ti > 0) {
            newState.cases_per_pallet = newState.ti * val;
        }
        setFormData(newState);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;
        setIsSaving(true);
        setError(null);

        try {
            // 1. Upsert Product
            const productPayload = {
                name: formData.name,
                description: formData.description,
                internal_sku: formData.internal_sku,
                customer_sku: formData.customer_sku,
                color_tag: formData.color_tag,
                bottles_per_case: Number(formData.bottles_per_case),
                bottles_per_truck: Number(formData.bottles_per_truck),
                cases_per_pallet: Number(formData.cases_per_pallet),
                ti: Number(formData.ti),
                hi: Number(formData.hi),
                case_weight: Number(formData.case_weight),
                pallet_type: formData.pallet_type,
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
                        {product ? 'Edit Product Configuration' : 'Add New Product'}
                    </Dialog.Title>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Identification */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Product Identity</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">SKU Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        disabled={!!product} // Locking name for now to simplify lookups
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                        placeholder="e.g. 20oz Cola"
                                    />
                                </div>

                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Color Tag</label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="color"
                                            value={formData.color_tag}
                                            onChange={e => setFormData({ ...formData, color_tag: e.target.value })}
                                            className="h-9 w-12 rounded cursor-pointer border-0 p-0"
                                        />
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formData.color_tag}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Internal SKU</label>
                                    <input
                                        type="text"
                                        value={formData.internal_sku}
                                        onChange={e => setFormData({ ...formData, internal_sku: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        placeholder="e.g. UBP-001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Customer SKU</label>
                                    <input
                                        type="text"
                                        value={formData.customer_sku}
                                        onChange={e => setFormData({ ...formData, customer_sku: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        placeholder="e.g. CUST-555"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        placeholder="Product description..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dimensions */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl space-y-4">
                            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Logistics & Stack</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Bottles/Case</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.bottles_per_case}
                                        onChange={e => setFormData({ ...formData, bottles_per_case: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Bottles/Truck</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.bottles_per_truck}
                                        onChange={e => setFormData({ ...formData, bottles_per_truck: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Case Weight (lbs)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={formData.case_weight}
                                        onChange={e => setFormData({ ...formData, case_weight: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>

                                {/* Pallet Stack Row */}
                                <div className="col-span-3 grid grid-cols-4 gap-3 pt-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ti (Cs/Layer)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.ti}
                                            onChange={e => handleTiHiChange('ti', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hi (Layers)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.hi}
                                            onChange={e => handleTiHiChange('hi', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Total Cs/Plt</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.cases_per_pallet}
                                            onChange={e => setFormData({ ...formData, cases_per_pallet: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white text-sm font-bold shadow-inner"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Pallet Type</label>
                                        <select
                                            value={formData.pallet_type}
                                            onChange={e => setFormData({ ...formData, pallet_type: e.target.value })}
                                            className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        >
                                            <option value="CHEP">CHEP (Blue)</option>
                                            <option value="PECO">PECO (Red)</option>
                                            <option value="WHITE">White Wood</option>
                                            <option value="PLASTIC">Plastic</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Line Configuration */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider">Production Lines</h3>
                                <button type="button" onClick={handleAddLine} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                                    <PlusIcon className="w-3 h-3" /> Add Line
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.lines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={line.line_name}
                                            onChange={e => handleLineChange(idx, 'line_name', e.target.value)}
                                            placeholder="Line Name"
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm"
                                        />
                                        <input
                                            type="number"
                                            value={line.production_rate}
                                            onChange={e => handleLineChange(idx, 'production_rate', e.target.value)}
                                            placeholder="CPH"
                                            className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-right"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLine(idx)}
                                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                            title="Remove Line"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
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
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                            >
                                {isSaving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
