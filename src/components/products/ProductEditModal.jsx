import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function ProductEditModal({ isOpen, onClose, product, onSave }) {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        bottles_per_case: 12,
        bottles_per_truck: 20000,
        cases_per_pallet: 100,
        production_rate: 2500
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (product) {
                setFormData({
                    name: product.name,
                    bottles_per_case: product.bottles_per_case || 12,
                    bottles_per_truck: product.bottles_per_truck || 20000,
                    cases_per_pallet: product.cases_per_pallet || 100,
                    production_rate: product.production_settings?.[0]?.production_rate || 2500
                });
            } else {
                // Default new product state
                setFormData({
                    name: '',
                    bottles_per_case: 12,
                    bottles_per_truck: 20000,
                    cases_per_pallet: 100,
                    production_rate: 2500
                });
            }
            setError(null);
        }
    }, [isOpen, product]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;
        setIsSaving(true);
        setError(null);

        try {
            // 1. Upsert Product
            const productPayload = {
                name: formData.name,
                bottles_per_case: Number(formData.bottles_per_case),
                bottles_per_truck: Number(formData.bottles_per_truck),
                cases_per_pallet: Number(formData.cases_per_pallet),
                user_id: user.id
            };

            // If editing, use ID to ensure update. If creating, rely on name/user_id constraint or ID if we had it (but name is key for user-facing uniqueness usually)
            // Ideally we'd have the ID for editing.
            if (product?.id) {
                productPayload.id = product.id;
            }

            const { data: savedProduct, error: prodError } = await supabase
                .from('products')
                .upsert(productPayload, { onConflict: 'name' }) // Assuming name unique constraint, or ID
                .select()
                .single();

            if (prodError) throw prodError;

            // 2. Upsert Production Settings (Run Rate)
            const { error: settingsError } = await supabase
                .from('production_settings')
                .upsert({
                    product_id: savedProduct.id,
                    user_id: user.id,
                    production_rate: Number(formData.production_rate)
                }, { onConflict: 'product_id' });

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
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700">
                    <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        {product ? 'Edit Product' : 'Add New Product'}
                    </Dialog.Title>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">SKU Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                disabled={!!product} // Disable name edit to prevent duplicate confusion for now
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                placeholder="e.g. 20oz"
                            />
                            {product && <p className="text-[10px] text-gray-400 mt-1">Product name cannot be changed once created.</p>}
                        </div>

                        {/* Dimensions Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Bottles / Case</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.bottles_per_case}
                                    onChange={e => setFormData({ ...formData, bottles_per_case: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Cases / Pallet</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.cases_per_pallet}
                                    onChange={e => setFormData({ ...formData, cases_per_pallet: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Logistics Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Bottles / Truck</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.bottles_per_truck}
                                    onChange={e => setFormData({ ...formData, bottles_per_truck: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Run Rate (CPH)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.production_rate}
                                    onChange={e => setFormData({ ...formData, production_rate: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
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
                                {isSaving ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
