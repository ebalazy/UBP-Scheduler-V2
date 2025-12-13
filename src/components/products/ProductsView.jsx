import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { PlusIcon, TruckIcon, BoltIcon } from '@heroicons/react/24/outline';
import { Package } from 'lucide-react';
import ProductEditModal from './ProductEditModal';

export default function ProductsView() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const fetchProducts = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // Fetch Products + Joined Production Settings
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    production_settings (
                        id,
                        line_name,
                        production_rate
                    )
                `)
                .order('name', { ascending: true });

            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            console.error("Error fetching products:", err);
            // alert("Failed to load products");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleEdit = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        fetchProducts(); // Refresh list after save
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-blue-600" />
                        Product Master Data
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage SKUs, dimensions, and run rates.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
                >
                    <PlusIcon className="w-5 h-5" />
                    Add Product
                </button>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => handleEdit(product)}
                            className="group bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-xs font-mono text-gray-400">ID: {product.id.slice(0, 4)}...</span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{product.name}</h3>
                            {product.description && (
                                <p className="text-xs text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                            )}

                            <div className="space-y-3 text-sm mt-4">
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                                    <span className="text-gray-500 flex items-center gap-2">
                                        <TruckIcon className="w-4 h-4" />
                                        Bottles/Truck
                                    </span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-200">{product.bottles_per_truck?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                                    <span className="text-gray-500">Bottles/Case</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{product.bottles_per_case}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                                    <span className="text-gray-500">Cases/Pallet</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{product.cases_per_pallet}</span>
                                </div>

                                <div className="pt-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                                        <BoltIcon className="w-3 h-3 text-amber-500" />
                                        Run Rates (CPH)
                                    </span>
                                    <div className="space-y-1">
                                        {product.production_settings?.length > 0 ? (
                                            product.production_settings.map((setting) => (
                                                <div key={setting.id || setting.line_name} className="flex justify-between text-xs bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded">
                                                    <span className="text-gray-600 dark:text-gray-300 font-medium">{setting.line_name}</span>
                                                    <span className="font-bold text-gray-900 dark:text-white">{setting.production_rate?.toLocaleString()}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-gray-400 italic">No rates configured</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {products.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                            <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No products found. Add your first SKU!</p>
                        </div>
                    )}
                </div>
            )}

            <ProductEditModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                product={editingProduct}
                onSave={handleSave}
            />
        </div>
    );
}
