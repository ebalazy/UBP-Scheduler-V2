
import { useState } from 'react';
import { TrashIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { getUserProducts, deleteProduct } from '../../services/supabase/products';

export default function DuplicateCleaner() {
    const { user } = useAuth();
    const [isScanning, setIsScanning] = useState(false);
    const [duplicates, setDuplicates] = useState([]);
    const [scanResult, setScanResult] = useState(null);

    const scanForDuplicates = async () => {
        if (!user) return;
        setIsScanning(true);
        setDuplicates([]);
        setScanResult(null);

        try {
            const allProducts = await getUserProducts(user.id);

            // Group by Name
            const groups = allProducts.reduce((acc, p) => {
                const key = p.name.trim(); // Normalize
                if (!acc[key]) acc[key] = [];
                acc[key].push(p);
                return acc;
            }, {});

            const foundDuplicates = [];

            Object.entries(groups).forEach(([name, list]) => {
                if (list.length > 1) {
                    // Sort by Created At (Oldest First)
                    // If created_at is missing, we might have issues, but let's assume it exists or fallback
                    list.sort((a, b) => {
                        const d1 = new Date(a.created_at || 0);
                        const d2 = new Date(b.created_at || 0);
                        return d1 - d2;
                    });

                    // The "Keeper" is the first one (Oldest)
                    const keeper = list[0];
                    const toDelete = list.slice(1);

                    foundDuplicates.push({
                        name,
                        keeper,
                        toDelete
                    });
                }
            });

            setDuplicates(foundDuplicates);
            setScanResult(`Scan Complete. Found ${foundDuplicates.length} duplicate groups.`);

        } catch (err) {
            console.error(err);
            setScanResult("Error scanning database.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleClean = async (groupIndex) => {
        const group = duplicates[groupIndex];
        if (!confirm(`Permanently delete ${group.toDelete.length} duplicate(s) for "${group.name}"?\n\nThe oldest record (ID: ...${group.keeper.id.slice(-4)}) will be kept.\nNewer duplicates will be removed.`)) return;

        try {
            for (const p of group.toDelete) {
                await deleteProduct(p.id);
            }

            // Remove from local list
            const newDuplicates = [...duplicates];
            newDuplicates.splice(groupIndex, 1);
            setDuplicates(newDuplicates);
            alert("Cleaned successfully.");
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                        Database Health: Duplicate SKU Cleaner
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Find and remove "ghost" duplicates that cause loading errors.
                    </p>
                </div>
                <button
                    onClick={scanForDuplicates}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
                >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            {scanResult && (
                <div className="mb-4 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {scanResult}
                </div>
            )}

            {duplicates.length > 0 && (
                <div className="space-y-3">
                    {duplicates.map((group, idx) => (
                        <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-md">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-sm font-bold text-red-800 dark:text-red-300">{group.name}</div>
                                    <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                        Keeping: <span className="font-mono">{group.keeper.id}</span> (Created: {new Date(group.keeper.created_at).toLocaleDateString()})
                                    </div>
                                    <div className="text-xs text-red-500 dark:text-red-400/80">
                                        Deleting {group.toDelete.length} newer copies.
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleClean(idx)}
                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                    title="Fix this Duplicate"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {scanResult && duplicates.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                    <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-50" />
                    <p className="text-xs">Database is clean. No duplicates found.</p>
                </div>
            )}
        </div>
    );
}
