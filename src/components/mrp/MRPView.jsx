import { useState, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import CsvDropZone from './CsvDropZone';
import BurnDownChart from './BurnDownChart';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

// DnD Kit Imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableWidget from '../common/SortableWidget';
import DroppableColumn from '../common/DroppableColumn';

export default function MRPView({ state, setters, results }) {
    const { bottleSizes, dashboardLayout, setDashboardLayout } = useSettings();
    const [isEditingYard, setIsEditingYard] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!results) return <div>Loading...</div>;

    const { netInventory, safetyTarget, trucksToOrder, specs, yardInventory } = results;
    const weeklyDemandBottles = state.totalScheduledCases * specs.bottlesPerCase;
    const fmt = (n) => n ? n.toLocaleString() : '0';

    // --- Component Definitions based on ID ---
    const renderWidget = (id) => {
        switch (id) {
            case 'chart':
                return (
                    <div className="p-4 h-full">
                        <BurnDownChart
                            currentInventoryBottles={results.netInventory + weeklyDemandBottles}
                            weeklyDemandBottles={weeklyDemandBottles}
                            safetyStockBottles={safetyTarget}
                        />
                    </div>
                );
            case 'kpis':
                return (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                        <div className="bg-gray-800 text-white p-6 rounded-lg shadow-inner flex flex-col justify-between">
                            <div>
                                <p className="text-gray-400 text-xs uppercase font-bold">Projected End-of-Week</p>
                                <p className={`text-3xl font-mono font-bold mt-1 ${netInventory < safetyTarget ? 'text-red-400' : 'text-green-400'}`}>
                                    {fmt(netInventory)}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">Bottles Net</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold">Safety Target</p>
                                <p className="text-3xl font-mono font-bold mt-1 text-gray-700">{fmt(safetyTarget)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">Bottles ({state.selectedSize})</p>
                            </div>
                        </div>

                        <div className={`p-6 rounded-lg border-2 flex flex-col justify-between ${trucksToOrder > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                            <div>
                                <p className={`${trucksToOrder > 0 ? 'text-red-600' : 'text-green-600'} text-xs uppercase font-bold`}>Action</p>
                                <div className="text-3xl font-extrabold mt-1">
                                    {trucksToOrder > 0 ? (
                                        <span className="text-red-600">{trucksToOrder} TRUCKS</span>
                                    ) : (
                                        <span className="text-green-600">✅ OK</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'inputs':
                return (
                    <div className="p-6 h-full">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">🎛️ Inventory Controls</h2>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Active SKU</label>
                                <select
                                    value={state.selectedSize}
                                    onChange={(e) => setters.setSelectedSize(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg py-2"
                                >
                                    {bottleSizes.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Floor (Pallets)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={state.currentInventoryPallets === 0 ? '' : state.currentInventoryPallets}
                                        onChange={(e) => setters.setCurrentInventoryPallets(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Inbound (Trucks)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={state.incomingTrucks === 0 ? '' : state.incomingTrucks}
                                        onChange={(e) => setters.setIncomingTrucks(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Yard Inventory Section */}
                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 relative">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-blue-900">Yard Inventory</label>
                                    {state.yardInventory.timestamp && !isEditingYard && (
                                        <span className="text-xs text-blue-600">
                                            Last sync: {new Date(state.yardInventory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>

                                {isEditingYard ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            autoFocus
                                            value={state.manualYardOverride ?? state.yardInventory.count}
                                            onChange={(e) => setters.setManualYardOverride(e.target.value)}
                                            className="block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg"
                                        />
                                        <button
                                            onClick={() => setIsEditingYard(false)}
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-baseline space-x-2">
                                            <span className="text-2xl font-bold text-blue-800">
                                                {yardInventory.effectiveCount}
                                            </span>
                                            <span className="text-sm text-blue-600">Full Loads</span>
                                            {yardInventory.isOverridden && (
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200">Manual</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setIsEditingYard(true)}
                                            className="flex items-center text-xs text-blue-500 hover:text-blue-700 underline"
                                        >
                                            <PencilSquareIcon className="h-3 w-3 mr-1" />
                                            Override
                                        </button>
                                    </div>
                                )}
                                {!isEditingYard && state.yardInventory.fileName && (
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                        Source: {state.yardInventory.fileName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'demand':
                return (
                    <div className="p-6 h-full">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">📅 Demand Schedule</h2>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                                <div key={day} className="text-center">
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">{day.charAt(0)}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={state.weeklyDemand[day] === 0 ? '' : state.weeklyDemand[day]}
                                        onChange={(e) => setters.updateDailyDemand(day, e.target.value)}
                                        className="block w-full text-center rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1 px-0"
                                        placeholder="-"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200 mt-4">
                            <span className="text-sm font-medium text-gray-600">Total Wk Demand:</span>
                            <span className="text-lg font-bold text-gray-900">{fmt(state.totalScheduledCases)} <span className="text-xs font-normal text-gray-500">cs</span></span>
                        </div>
                    </div>
                );
            default:
                return <div>Unknown Widget</div>;
        }
    };

    // --- DnD Handlers ---
    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;

        if (!over) return;

        // Find which column the items belong to
        const findContainer = (id) => {
            if (id === 'col1' || id === 'col2') return id;
            if (dashboardLayout.col1.includes(id)) return 'col1';
            if (dashboardLayout.col2.includes(id)) return 'col2';
            return null;
        };

        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(over.id);

        if (!activeContainer || !overContainer) return;

        // Clone layout to mutate
        const newLayout = {
            col1: [...dashboardLayout.col1],
            col2: [...dashboardLayout.col2]
        };

        // Moving within same container
        if (activeContainer === overContainer) {
            const oldIndex = newLayout[activeContainer].indexOf(active.id);
            const newIndex = newLayout[activeContainer].indexOf(over.id);
            if (oldIndex !== newIndex) {
                newLayout[activeContainer] = arrayMove(newLayout[activeContainer], oldIndex, newIndex);
                setDashboardLayout(newLayout);
            }
        }
        // Moving between containers
        else {
            // Remove from old
            newLayout[activeContainer] = newLayout[activeContainer].filter(id => id !== active.id);
            // Add to new
            // If dropping directly over a container (empty space), append to end
            if (over.id === 'col1' || over.id === 'col2') {
                newLayout[overContainer].push(active.id);
            } else {
                // Dropping over another item, insert before it
                const index = newLayout[overContainer].indexOf(over.id);
                newLayout[overContainer].splice(index, 0, active.id);
            }
            setDashboardLayout(newLayout);
        }

    }, [dashboardLayout, setDashboardLayout]);


    return (
        <div className="space-y-6">
            {/* Top Zone: Integration Check & Drop Status */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
                <CsvDropZone
                    onUpdateInventory={setters.setYardInventory}
                    currentSku={state.selectedSize}
                />
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Zone A (Col 1) */}
                    {/* Zone A (Col 1) */}
                    <div className="xl:col-span-2">
                        <DroppableColumn id="col1">
                            <SortableContext
                                items={dashboardLayout.col1}
                                strategy={verticalListSortingStrategy}
                            >
                                {dashboardLayout.col1.map(id => (
                                    <SortableWidget key={id} id={id}>
                                        {renderWidget(id)}
                                    </SortableWidget>
                                ))}
                            </SortableContext>
                        </DroppableColumn>
                    </div>

                    {/* Zone B (Col 2) */}
                    {/* Zone B (Col 2) */}
                    <div>
                        <DroppableColumn id="col2">
                            <SortableContext
                                items={dashboardLayout.col2}
                                strategy={verticalListSortingStrategy}
                            >
                                {dashboardLayout.col2.map(id => (
                                    <SortableWidget key={id} id={id}>
                                        {renderWidget(id)}
                                    </SortableWidget>
                                ))}
                            </SortableContext>
                        </DroppableColumn>
                    </div>
                </div>
            </DndContext>
        </div>
    );
}
