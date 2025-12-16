import { useState, useEffect } from 'react';
// import { useSettings } from '../../context/SettingsContext'; // Removed
import { useProducts } from '../../context/ProductsContext'; // Added
import {
    ClipboardDocumentCheckIcon,
    TruckIcon,
    CubeIcon,
    ArrowRightIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline'; // Using Heroicons v2
import { getLocalISOString } from '../../utils/dateUtils';
import InventoryForm from './InventoryForm';

export default function MorningReconciliationModal({
    isOpen,
    onClose,
    state, // mrp.formState
    setters // mrp.setters
}) {
    const { productMap: bottleDefinitions } = useProducts();
    const sizes = Object.keys(bottleDefinitions);
    const specs = bottleDefinitions[state.selectedSize];
    const bottlesPerTruck = specs?.bottlesPerTruck || 20000;
    const bottlesPerPallet = (specs?.bottlesPerCase || 12) * (specs?.casesPerPallet || 100);
    const palletsPerTruck = bottlesPerTruck / bottlesPerPallet;

    const [step, setStep] = useState(1);

    // Temporary State for the Wizard
    const [floorCount, setFloorCount] = useState('');
    const [yardCount, setYardCount] = useState('');
    const [yardUnit, setYardUnit] = useState('loads'); // 'loads' or 'units'

    // Initialize Data when Modal Opens
    useEffect(() => {
        if (isOpen) {
            // Current Inventory
            setFloorCount(state.inventoryAnchor?.count || 0);

            // Yard
            setYardCount(state.yardInventory?.effectiveCount || 0);

            setStep(1);
        }
    }, [isOpen, state.inventoryAnchor, state.yardInventory]);

    const handleCommit = () => {
        // 1. (Removed) Production Actuals are now handled in Planner Workbench

        // 2. Save Inventory Anchor (Sets the "Now" baseline)
        // We set the date to TODAY (Local), so the ledger starts calculation from today.
        const todayStr = getLocalISOString();
        setters.setInventoryAnchor({
            date: todayStr,
            count: Number(floorCount)
        });

        // 3. Save Yard Inventory
        setters.updateYardInventory(Number(yardCount));

        // 4. Force a Re-Plan (Triggered automatically by the setters usually, 
        // but if we want to ensure specific sequencing we rely on the hooks)

        onClose();
    };



    // Old Step 2 Removed/Moved to Step 1
    const renderStep2 = () => ( // Confirmation Step (was Step 3)
        <div className="text-center py-6 space-y-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>

            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ready to Update {state.selectedSize}?</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
                    The system will reset the <strong>{state.selectedSize}</strong> inventory baseline to <strong>{floorCount} Pallets</strong> + <strong>{yardCount} Loads</strong>.
                </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 max-w-sm mx-auto text-left text-sm space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-500">New Floor Count:</span>
                    <span className="font-mono font-bold">{floorCount} plts</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">New Yard Count:</span>
                    <span className="font-mono font-bold">
                        {Number(yardCount).toFixed(1)} loads <span className="text-gray-400 text-xs">({Math.round(yardCount * palletsPerTruck)} plts)</span>
                    </span>
                </div>
            </div>
        </div>
    );

    // Was Step 3

    if (!isOpen) return null;

    return (
        <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            {/* Container for Centering */}
            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">

                    {/* Modal Panel */}
                    <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border dark:border-gray-700 p-6">

                        {/* Header */}
                        <div className="sm:flex sm:items-start mb-6">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                                <ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                    Morning True-Up
                                </h3>
                                <div className="mt-2 text-left">
                                    {/* Progress Checkpoints */}
                                    <div className="flex items-center space-x-2 text-xs font-medium text-gray-400">
                                        <span className={`${step === 1 ? 'text-blue-600 dark:text-blue-400' : ''}`}>1. Inventory</span>
                                        <span>&rarr;</span>
                                        <span className={`${step === 2 ? 'text-blue-600 dark:text-blue-400' : ''}`}>2. Confirm</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="mt-2">
                            {step === 1 && (
                                <InventoryForm
                                    selectedSize={state.selectedSize}
                                    setSelectedSize={setters.setSelectedSize}
                                    floorCount={floorCount}
                                    setFloorCount={setFloorCount}
                                    yardCount={yardCount}
                                    setYardCount={setYardCount}
                                    yardUnit={yardUnit}
                                    setYardUnit={setYardUnit}
                                    sizes={sizes}
                                    palletsPerTruck={palletsPerTruck}
                                />
                            )}
                            {step === 2 && renderStep2()}
                        </div>

                        {/* Footer / Controls */}
                        <div className="mt-8 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                            {step < 2 ? (
                                <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                                    onClick={() => setStep(s => s + 1)}
                                >
                                    Next Step
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                                    onClick={handleCommit}
                                >
                                    Update Plan
                                </button>
                            )}

                            {step > 1 ? (
                                <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-1 sm:mt-0 sm:text-sm"
                                    onClick={() => setStep(s => s - 1)}
                                >
                                    Back
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-1 sm:mt-0 sm:text-sm"
                                    onClick={onClose}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

