
import { useState, useCallback } from 'react';
import CsvDropZone from './CsvDropZone';
import CalendarDemand from './CalendarDemand';
import ProductionInputs from './ProductionInputs';
import OrderActionLog from './OrderActionLog';
import SharePlanModal from '../SharePlanModal';
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
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
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
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 transition-colors">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Purchasing Advice</h3>
                        <OrderActionLog
                            plannedOrders={results.plannedOrders}
                            leadTimeDays={leadTimeDays}
                        />
                    </div>
                );
            case 'dropzone':
                return (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 transition-colors">
                        <CsvDropZone
                            onUpdateInventory={setters.setYardInventory}
                            currentSku={state.selectedSize}
                        />
                    </div>
                );
            case 'chart':
                return (
                    <div className="p-4 h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 transition-colors">
                        <BurnDownChart
                            currentInventoryBottles={results.netInventory + weeklyDemandBottles}
                            weeklyDemandBottles={weeklyDemandBottles}
                            safetyStockBottles={safetyTarget}
                        />
                    </div>
                );
            case 'kpis':
                // Helper for Colors
                const getDosColor = (dos) => {
                    if (dos <= (leadTimeDays || 2)) return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300';
                    if (dos <= 7) return 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/40 dark:border-yellow-800 dark:text-yellow-300';
                    return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300';
                };

                const daysOfSupply = results.daysOfSupply !== undefined ? results.daysOfSupply : 30;
                const dosFormatted = daysOfSupply >= 30 ? '30+' : daysOfSupply.toFixed(1);
                const dosColorClass = getDosColor(daysOfSupply);

                // Inventory in Pallets (Floor + Yard)
                const totalPallets = Math.round(results.calculatedPallets + results.yardInventory.effectiveCount * (specs.bottlesPerTruck / specs.casesPerPallet / specs.bottlesPerCase * specs.casesPerPallet));
                // Wait, calculatedPallets is Floor. Yard is Loads.
                // We need a clean "Total On Hand Pallets".
                // effectiveYardLoads * palletsPerTruck.
                const palletsPerTruck = (specs.bottlesPerTruck / specs.bottlesPerCase) / (specs.casesPerPallet || 1);
                const totalOnHandPallets = Math.round(results.calculatedPallets + (results.yardInventory.effectiveCount * palletsPerTruck));
                const targetPallets = Math.round(safetyTarget / specs.bottlesPerCase / (specs.casesPerPallet || 1));

                return (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-center">
                        {/* Card 1: Days of Supply (Coverage) */}
                        <div className={`p-6 rounded-lg border-2 flex flex-col justify-between h-32 ${dosColorClass}`}>
                            <div className="flex justify-between items-start">
                                <p className="text-xs uppercase font-bold opacity-80">Coverage</p>
                                <span className="text-2xl">⏳</span>
                            </div>
                            <div>
                                <p className="text-4xl font-mono font-bold">{dosFormatted}</p>
                                <p className="text-xs opacity-70 mt-1 font-medium">Days of Supply</p>
                            </div>
                        </div>

                        {/* Card 2: Current Inventory (Pallets) */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-32 transition-colors">
                            <div className="flex justify-between items-start">
                                <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">On Hand</p>
                                <span className="text-2xl">📦</span>
                            </div>
                            <div>
                                <div className="flex items-baseline space-x-2">
                                    <p className="text-4xl font-mono font-bold text-gray-700 dark:text-white">{fmt(totalOnHandPallets)}</p>
                                    <span className="text-sm text-gray-400">Pallets</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Target: {fmt(targetPallets)} Pallets</p>
                            </div>
                        </div>

                        {/* Card 3: Action (Direct Command) */}
                        <div className={`p-6 rounded-lg border-2 flex flex-col justify-between h-32 ${trucksToOrder > 0 ? 'bg-red-500 border-red-600 text-white shadow-lg transform scale-105 transition-transform' :
                            trucksToCancel > 0 ? 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:border-orange-800 dark:text-orange-200' :
                                'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                            }`}>
                            <div className="flex justify-between items-start">
                                <p className="text-xs uppercase font-bold opacity-90">Recommendation</p>
                                {trucksToOrder > 0 && <span className="text-2xl animate-pulse">🚨</span>}
                            </div>

                            <div>
                                {trucksToOrder > 0 ? (
                                    <>
                                        <p className="text-3xl font-black uppercase leading-none">ORDER {trucksToOrder}</p>
                                        <p className="text-sm font-bold opacity-90 mt-1">Trucks Required</p>
                                    </>
                                ) : trucksToCancel > 0 ? (
                                    <>
                                        <p className="text-3xl font-black uppercase leading-none">PUSH {trucksToCancel}</p>
                                        <p className="text-xs font-bold opacity-80 mt-1">Trucks Surplus</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-3xl font-bold uppercase leading-none">On Track</p>
                                        <p className="text-xs opacity-60 mt-1">No actions needed</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'inventory':
            case 'inputs': // Legacy Fallback
                return (
                    <div className="p-6 h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 transition-colors">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 border-b pb-2 flex justify-between items-center bg-transparent">
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
                                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 transition-colors">
                                        <div>
                                            <span className="text-xl font-bold text-gray-900 dark:text-gray-100 block leading-none">
                                                {Math.round(results.calculatedPallets || 0)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Calculated</span>
                                        </div>
                                        <button
                                            onClick={() => setIsEditingYard('floor')}
                                            className="ml-2 text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 shadow-sm px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
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
                    <div className="p-6 h-full border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Manual Supply (Legacy)</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inbound (Trucks)</label>
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
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-2 transition-colors">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Production & Inventory Planner</h1>
                    <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-500">Manage demand, inventory, and truck schedules.</p>
                    </div>
                </div>

                <div className="flex items-center mt-4 md:mt-0 space-x-4">
                    {/* Share Button (New) */}
                    <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="flex items-center text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg font-medium transition-colors no-print"
                        title="Share Plan"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 md:mr-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        <span className="hidden md:inline">Share</span>
                    </button>

                    <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Plan For:</span>
                    <div className="relative">
                        <select
                            value={state.selectedSize}
                            onChange={(e) => setters.setSelectedSize(e.target.value)}
                            className="appearance-none bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold pl-5 pr-12 py-3 rounded-lg shadow-lg border-2 border-blue-400 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all transform hover:-translate-y-0.5 print:bg-white print:text-black print:border-none print:shadow-none"
                        >
                            {bottleSizes.map(size => (
                                <option key={size} value={size} className="text-gray-900 bg-white">{size}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-blue-100 no-print">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <SharePlanModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                selectedSize={state.selectedSize}
                monthlyDemand={state.monthlyDemand}
                monthlyInbound={state.monthlyInbound}
                monthlyProductionActuals={state.monthlyProductionActuals}
            />

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
