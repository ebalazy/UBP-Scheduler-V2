import React, { useState, useEffect } from 'react';
import { getLocalISOString, formatLocalDate } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';
import { useProcurement } from '../../context/ProcurementContext';
import ScheduleManagerModal from '../procurement/ScheduleManagerModal';

// Sub-components
import PlanningHeader from './planning/PlanningHeader';
import PlanningMobileCard from './planning/PlanningMobileCard';
import PlanningRowDemand from './planning/PlanningRowDemand';
import PlanningRowActual from './planning/PlanningRowActual';
import PlanningRowInbound from './planning/PlanningRowInbound';
import PlanningRowInventory from './planning/PlanningRowInventory';
import PlanningRowCoverage from './planning/PlanningRowCoverage';

export default function PlanningGrid({
    monthlyDemand,
    monthlyProductionActuals,
    monthlyInbound,
    // truckManifest, // Now from Context
    updateDateDemand,
    updateDateDemandBulk,
    updateDateActual,
    updateDateInbound, // For manual qty overrides
    // saveProcurementEntry, // Now from Context
    // deleteProcurementEntry, // Now from Context
    dailyLedger = [], // Renamed from ledger and defaulted
    specs,
    userProfile
}) {
    const { bottleSizes } = useSettings();
    const { poManifest, saveProcurementEntry, deleteProcurementEntry } = useProcurement();

    // Alias for internal use matches new component expectation
    const truckManifest = poManifest;
    const ledger = dailyLedger;

    // -- State --
    const [startDate, setStartDate] = useState(new Date());
    const [dates, setDates] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Modal State for PO Management
    const [managerDate, setManagerDate] = useState(null);

    // -- Effects --
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Generate 14 days from start date
        const d = [];
        for (let i = 0; i < 14; i++) {
            const next = new Date(startDate);
            next.setDate(startDate.getDate() + i);
            d.push(next);
        }
        setDates(d);
    }, [startDate]);

    // -- Handlers --
    const shiftDate = (days) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + days);
        setStartDate(newDate);
    };

    const resetDate = () => setStartDate(new Date());

    const openManager = (dateStr) => setManagerDate(dateStr);
    const closeManager = () => setManagerDate(null);

    // -- Render Props --
    const todayStr = formatLocalDate(new Date());
    const safetyTarget = (userProfile?.safety_stock_loads || 0) * (specs?.bottlesPerTruck || 20000);

    // -- Modal --
    const renderManagerModal = () => {
        if (!managerDate) return null;
        const currentManifest = truckManifest[managerDate] || []; // Array of items

        return (
            <ScheduleManagerModal
                isOpen={!!managerDate}
                onClose={closeManager}
                dateStr={managerDate}
                existingItems={currentManifest}
                onSave={async (item) => {
                    // Item: { po, qty, sku, supplier... }
                    // We need to save to DB via prop
                    await saveProcurementEntry(item);
                    // The hook will auto-refresh/optimistic update? 
                    // No, `saveProcurementEntry` in `useMRPActions` should trigger a refresh.
                }}
                onDelete={async (po) => {
                    await deleteProcurementEntry(po);
                }}
            />
        );
    };

    // -- Mobile View --
    if (isMobile) {
        return (
            <div className="flex flex-col gap-2 pb-24">
                <div className="flex justify-between items-center mb-2 px-1">
                    <button onClick={resetDate} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        Today
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => shiftDate(-1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                            ←
                        </button>
                        <button onClick={() => shiftDate(1)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                            →
                        </button>
                    </div>
                </div>

                {dates.map(date => {
                    const dateStr = formatLocalDate(date);
                    const manifestItems = truckManifest[dateStr] || [];
                    const ledgerItem = ledger.find(l => l.date === dateStr);

                    return (
                        <PlanningMobileCard
                            key={dateStr}
                            date={date}
                            todayStr={todayStr}
                            demandVal={monthlyDemand[dateStr]}
                            updateDateDemand={updateDateDemand}
                            actualVal={monthlyProductionActuals[dateStr]}
                            updateDateActual={updateDateActual}
                            manifestItems={manifestItems}
                            monthlyInboundVal={monthlyInbound[dateStr]}
                            updateDateInbound={updateDateInbound}
                            ledgerItem={ledgerItem}
                            openManager={openManager}
                        />
                    );
                })}

                {renderManagerModal()}
            </div>
        );
    }

    // -- Desktop View --
    // Transform ledger to map for O(1) loop access
    const ledgerMap = ledger.reduce((acc, item) => {
        acc[item.date] = item;
        return acc;
    }, {});

    return (
        <div className="overflow-x-auto pb-4 relative">
            {/* Header Controls */}
            <div className="sticky left-0 flex gap-2 mb-2 p-2 bg-white dark:bg-gray-900 z-20 w-fit">
                <button
                    onClick={() => shiftDate(-7)}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    &lt;&lt; Prev Week
                </button>
                <button
                    onClick={resetDate}
                    className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded"
                >
                    Today
                </button>
                <button
                    onClick={() => shiftDate(7)}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                    Next Week &gt;&gt;
                </button>
            </div>

            <table className="w-full border-collapse text-sm">
                <PlanningHeader dates={dates} todayStr={todayStr} />
                <tbody>
                    <PlanningRowDemand
                        dates={dates}
                        monthlyDemand={monthlyDemand}
                        updateDateDemand={updateDateDemand}
                        updateDateDemandBulk={updateDateDemandBulk}
                    />

                    <PlanningRowActual
                        dates={dates}
                        monthlyProductionActuals={monthlyProductionActuals}
                        updateDateActual={updateDateActual}
                    />

                    <PlanningRowInbound
                        dates={dates}
                        poManifest={truckManifest} // Pass the map
                        monthlyInbound={monthlyInbound}
                        updateDateInbound={updateDateInbound}
                        openManager={openManager}
                    />

                    {/* Spacer Row */}
                    <tr className="h-4 bg-gray-50 dark:bg-gray-800/50"><td colSpan={dates.length + 1}></td></tr>

                    <PlanningRowInventory
                        dates={dates}
                        ledgerMap={ledgerMap}
                        specs={specs}
                        safetyTarget={safetyTarget}
                    />

                    <PlanningRowCoverage
                        dates={dates}
                        ledgerMap={ledgerMap}
                        monthlyDemand={monthlyDemand}
                        specs={specs}
                    />
                </tbody>
            </table>

            {renderManagerModal()}
        </div>
    );
}
