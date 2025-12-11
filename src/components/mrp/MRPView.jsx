
import { useState, useCallback } from 'react';
import CsvDropZone from './CsvDropZone';
import CalendarDemand from './CalendarDemand';
import ProductionInputs from './ProductionInputs';
import OrderActionLog from './OrderActionLog';
import { useSettings } from '../../context/SettingsContext';
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
    const { bottleSizes, dashboardLayout, setDashboardLayout, leadTimeDays } = useSettings();
    const [isEditingYard, setIsEditingYard] = useState(false);
    const [activeDragId, setActiveDragId] = useState(null);

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

    const { netInventory, safetyTarget, trucksToOrder, trucksToCancel, specs, yardInventory } = results;
    const weeklyDemandBottles = state.totalScheduledCases * specs.bottlesPerCase;
    const fmt = (n) => n ? n.toLocaleString() : '0';

    // --- Component Definitions based on ID ---
    const renderWidget = (id) => {
        switch (id) {
            case 'actions':
            case 'purchasing':
                return (
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Purchasing Advice</h3>
                        <OrderActionLog
                            plannedOrders={results.plannedOrders}
                            leadTimeDays={leadTimeDays}
                        />
                    </div>
                );
            case 'dropzone':
                return (
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <CsvDropZone
                            onUpdateInventory={setters.setYardInventory}
                            currentSku={state.selectedSize}
                        />
                    </div>
                );
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
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-center">
                        <div className="bg-gray-800 text-white p-6 rounded-lg shadow-inner flex flex-col justify-between h-32 relative group">
                            {/* SKU Icon */}
                            <div className="absolute top-3 right-3 text-gray-600">
                                <span className="text-2xl">📦</span>
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs uppercase font-bold">Projected Inventory</p>
                                <p className={`text-4xl font-mono font-bold mt-2 ${netInventory < safetyTarget ? 'text-red-400' : 'text-green-400'}`}>
                                    {fmt(netInventory)}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Bottles (Net)</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-between h-32">
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold">Target Inventory</p>
                                <p className="text-4xl font-mono font-bold mt-2 text-gray-700">{fmt(safetyTarget)}</p>
                                <p className="text-xs text-gray-400 mt-1">Bottles (Safety)</p>
                            </div>
                        </div>

                        <div className={`p-6 rounded-lg border-2 flex flex-col justify-between h-32 ${results.firstStockoutDate || trucksToOrder > 0 ? 'bg-red-50 border-red-200' :
                            results.firstOverflowDate || trucksToCancel > 0 ? 'bg-orange-50 border-orange-200' :
                                'bg-green-50 border-green-200'
                            }`}>
                            <div>
                                <p className={`${results.firstStockoutDate || trucksToOrder > 0 ? 'text-red-600' :
                                    results.firstOverflowDate || trucksToCancel > 0 ? 'text-orange-600' :
                                        'text-green-600'
                                    } text-xs uppercase font-bold`}>Action</p>
                                <div className="text-4xl font-extrabold mt-2">
                                    {results.firstStockoutDate ? (
                                        <div className="flex flex-col">
                                            <span className="text-red-600 text-3xl">STOCKOUT {new Date(results.firstStockoutDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                                            <span className="text-red-400 text-xs font-normal mt-1">Order Trucks Beforehand</span>
                                        </div>
                                    ) : trucksToOrder > 0 ? (
                                        <span className="text-red-600">{trucksToOrder} TRUCKS</span>
                                    ) : results.firstOverflowDate ? (
                                        <div className="flex flex-col">
                                            <span className="text-orange-600 text-3xl">PUSH OUT {new Date(results.firstOverflowDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span>
                                            <span className="text-orange-400 text-xs font-normal mt-1">Overflow Predicted</span>
                                        </div>
                                    ) : trucksToCancel > 0 ? (
                                        <div className="flex flex-col">
                                            <span className="text-orange-600 text-3xl">PUSH OUT {trucksToCancel}</span>
                                            <span className="text-orange-400 text-xs font-normal mt-1">Projected &gt; Target (Surplus)</span>
                                        </div>
                                    ) : (
                                        <span className="text-green-600">✅ OK</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'inventory':
            case 'inputs': // Legacy Fallback
                return (
                    <div className="p-6 h-full">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex justify-between items-center">
                            <span>🎛️ Inventory Controls</span>
                            <label className="flex items-center cursor-pointer">
                                <span className="text-xs mr-2 font-medium text-purple-600">
                                    {state.isAutoReplenish ? '✨ Auto-Plan' : 'Manual'}
                                </span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={state.isAutoReplenish || false}
                                        onChange={(e) => setters.setIsAutoReplenish(e.target.checked)}
                                    />
                                    <div className={`block w-10 h-6 rounded-full transition-colors ${state.isAutoReplenish ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${state.isAutoReplenish ? 'transform translate-x-4' : ''}`}></div>
                                </div>
                            </label>
                        </h2>
                        <div className="space-y-5">
                            {/* Floor Inventory */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Floor (Pallets)</label>
                                {isEditingYard === 'floor' ? (
                                    <div className="flex items-center space-x-1">
                                        <input
                                            type="number"
                                            autoFocus
                                            placeholder="Count"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setters.setInventoryAnchor({
                                                        date: new Date().toISOString().split('T')[0],
                                                        count: Number(e.target.value)
                                                    });
                                                    setIsEditingYard(false);
                                                }
                                            }}
                                            className="block w-20 rounded-md border-purple-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-lg"
                                        />
                                        <button
                                            onClick={() => setIsEditingYard(false)}
                                            className="text-xs text-gray-400 border border-gray-200 rounded p-1"
                                        >Cancel</button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                                        <div>
                                            <span className="text-xl font-bold text-gray-900 block leading-none">
                                                {Math.round(results.calculatedPallets || 0)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 uppercase">Calculated</span>
                                        </div>
                                        <button
                                            onClick={() => setIsEditingYard('floor')}
                                            className="ml-2 text-xs bg-white border border-gray-300 shadow-sm px-2 py-1 rounded hover:bg-gray-50 text-gray-700"
                                        >
                                            Update
                                        </button>
                                    </div>
                                )}
                                {state.inventoryAnchor && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Last Count: {state.inventoryAnchor.count} on {state.inventoryAnchor.date}
                                    </p>
                                )}
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

                                {isEditingYard === true ? (
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
            case 'supply':
                return (
                    <div className="p-6 h-full border border-dashed border-gray-300 rounded-lg">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Manual Supply (Legacy)</h3>
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
                            <p className="text-[10px] text-gray-400 mt-1">
                                Use this only for trucks NOT in the calendar.
                            </p>
                        </div>
                    </div>
                );
            case 'demand':
                return (
                    <CalendarDemand
                        monthlyDemand={state.monthlyDemand || {}}
                        updateDateDemand={setters.updateDateDemand}
                        monthlyInbound={state.monthlyInbound || {}}
                        updateDateInbound={setters.updateDateInbound}
                        monthlyProductionActuals={state.monthlyProductionActuals || {}}
                        updateDateActual={setters.updateDateActual}
                        specs={results?.specs}
                        trucksToCancel={results?.trucksToCancel}
                        dailyLedger={results?.dailyLedger}
                        safetyTarget={results?.safetyTarget}
                    />
                );
            case 'production':
                return (
                    <ProductionInputs
                        productionRate={state.productionRate}
                        setProductionRate={setters.setProductionRate}
                        downtimeHours={state.downtimeHours}
                        setDowntimeHours={setters.setDowntimeHours}
                        lostProductionCases={results.lostProductionCases}
                    />
                );
            default:
                return null;
        }
    };

    // --- DnD Handlers ---
    const handleDragStart = (event) => {
        setActiveDragId(event.active.id);
    };

    const handleDragEnd = useCallback((event) => {
        setActiveDragId(null);
        const { active, over } = event;

        if (!over) return;

        // Find which column the items belong to
        const findContainer = (id) => {
            if (id === 'top' || id === 'col1' || id === 'col2') return id;
            if (dashboardLayout.top?.includes(id)) return 'top';
            if (dashboardLayout.col1.includes(id)) return 'col1';
            if (dashboardLayout.col2.includes(id)) return 'col2';
            return null;
        };

        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(over.id);

        if (!activeContainer || !overContainer) return;

        // Clone layout to mutate
        const newLayout = {
            top: [...(dashboardLayout.top || [])],
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
            if (over.id === 'top' || over.id === 'col1' || over.id === 'col2') {
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
            {/* Header with Title and SKU Selector */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Production & Inventory Planner</h1>
                    <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-500">Manage demand, inventory, and truck schedules.</p>
                    </div>
                </div>

                <div className="flex items-center mt-4 md:mt-0 space-x-4">
                    <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Plan For:</span>
                    <div className="relative">
                        <select
                            value={state.selectedSize}
                            onChange={(e) => setters.setSelectedSize(e.target.value)}
                            className="appearance-none bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold pl-5 pr-12 py-3 rounded-lg shadow-lg border-2 border-blue-400 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all transform hover:-translate-y-0.5"
                        >
                            {bottleSizes.map(size => (
                                <option key={size} value={size} className="text-gray-900 bg-white">{size}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-blue-100">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* Full Width Top Zone */}
                {dashboardLayout.top && (
                    <div className="w-full">
                        <DroppableColumn id="top" className="min-h-[100px]" highlight={!!activeDragId}>
                            <SortableContext
                                items={dashboardLayout.top}
                                strategy={verticalListSortingStrategy}
                            >
                                {dashboardLayout.top.map(id => (
                                    <SortableWidget key={id} id={id}>
                                        {renderWidget(id)}
                                    </SortableWidget>
                                ))}
                            </SortableContext>
                        </DroppableColumn>
                    </div>
                )}


                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Zone A (Col 1) */}
                    <div className="xl:col-span-2">
                        <DroppableColumn id="col1" highlight={!!activeDragId}>
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
                    <div>
                        <DroppableColumn id="col2" highlight={!!activeDragId}>
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
