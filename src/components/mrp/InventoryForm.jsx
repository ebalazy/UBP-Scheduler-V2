import { CubeIcon, TruckIcon } from '@heroicons/react/24/outline';

export default function InventoryForm({
    selectedSize,
    setSelectedSize,
    floorCount,
    setFloorCount,
    yardCount,
    setYardCount,
    yardUnit,
    setYardUnit,
    sizes,
    palletsPerTruck
}) {
    return (
        <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-1">Morning Inventory Count</h3>
                <p className="text-sm text-purple-700 dark:text-purple-400">
                    What is physically on the floor and in the yard <strong>right now</strong>?
                </p>
            </div>

            {/* SKU Selector */}
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Select Product</label>
                <div className="flex flex-wrap gap-2">
                    {sizes.map(size => (
                        <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${selectedSize === size
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Floor Count (Pallets)
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CubeIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="number"
                            autoFocus
                            value={floorCount}
                            onChange={(e) => setFloorCount(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 text-xl font-bold border rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Count all finished goods on the floor.</p>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Yard Count
                        </label>
                        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-md p-0.5">
                            <button
                                onClick={() => setYardUnit('loads')}
                                className={`px-2 py-0.5 text-xs font-bold rounded-sm ${yardUnit === 'loads' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                Loads
                            </button>
                            <button
                                onClick={() => setYardUnit('pallets')}
                                className={`px-2 py-0.5 text-xs font-bold rounded-sm ${yardUnit === 'pallets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                Pallets
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <TruckIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="number"
                            value={yardUnit === 'loads' ? yardCount : (yardCount === '' ? '' : Math.round(yardCount * palletsPerTruck))}
                            onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                if (yardUnit === 'loads') setYardCount(val);
                                else setYardCount(val === '' ? '' : val / palletsPerTruck);
                            }}
                            className="w-full pl-10 pr-4 py-3 text-xl font-bold border rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {yardUnit === 'loads' ? 'Number of fully loaded trailers.' : `Total pallets (~${Math.round(palletsPerTruck)} per load).`}
                    </p>
                </div>
            </div>
        </div>
    );
}
