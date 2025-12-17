import React, { useState, useMemo } from 'react';
import { getLocalISOString, addDays } from '../../utils/dateUtils';
// import { useSettings } from '../../context/SettingsContext'; // Removed
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
    updateDateDemand,
    updateDateDemandBulk,
    updateDateActual,
    updateDateInbound,
    dailyLedger = [],
    specs,
    userProfile,
    startDate,
    readOnly = false,
    poManifest = {} // Accept Prop
}) {
    // 1. Context Hooks
    // Update: Destructure correct values from ProcurementContext
    const { updateDailyManifest, removeOrder } = useProcurement(); // Remove poManifest destructuring

    // 2. Local State
    const [managerState, setManagerState] = useState({ isOpen: false, date: null });
    const todayStr = getLocalISOString(new Date());

    // 3. Derived State: Dates (60 days)
    const dates = useMemo(() => {
        const d = [];
        const start = startDate ? new Date(startDate) : new Date();
        for (let i = 0; i < 60; i++) {
            d.push(addDays(start, i));
        }
        return d;
    }, [startDate]);

    // 4. Ledger Map for O(1) lookup
    const ledgerMap = useMemo(() => {
        return dailyLedger.reduce((acc, item) => {
            acc[item.date] = item;
            return acc;
        }, {});
    }, [dailyLedger]);

    // 5. Handlers
    const openManager = (dateStr) => {
        if (readOnly) return;
        setManagerState({ isOpen: true, date: dateStr });
    };

    const closeManager = () => {
        setManagerState({ isOpen: false, date: null });
    };

    const handleSaveProcurement = (items) => {
        if (managerState.date) {
            // Use updateDailyManifest instead of internal saveProcurementEntry
            updateDailyManifest(managerState.date, items);
        }
    };

    const handleDeleteProcurement = (id) => {
        // Use removeOrder from context
        if (managerState.date) {
            removeOrder(managerState.date, id);
        }
    };

    const renderManagerModal = () => (
        <ScheduleManagerModal
            isOpen={managerState.isOpen}
            onClose={closeManager}
            date={managerState.date || ''}
            // Use poManifest (map) instead of truckManifest
            // Pass correct props
            orders={managerState.date ? (poManifest[managerState.date]?.items || []) : []}
            monthlyInbound={monthlyInbound}
            updateDateInbound={updateDateInbound}
            onSave={handleSaveProcurement}
            onDelete={handleDeleteProcurement}
            specs={specs}
        />
    );

    // 7. Summary Statistics (Visible Horizon)
    const summaryStats = useMemo(() => {
        if (!specs || !specs.bottlesPerTruck || !specs.bottlesPerCase) return null;

        let totalCases = 0;
        let totalScheduled = 0;

        const casesPerTruck = specs.bottlesPerTruck / specs.bottlesPerCase;

        dates.forEach(date => {
            const dateStr = getLocalISOString(date);

            // Demand (Cases)
            const demandVal = monthlyDemand[dateStr];
            if (demandVal) totalCases += Number(demandVal);

            // Inbound (Trucks)
            // Use manifest if available, else standard count
            const manifest = poManifest[dateStr];
            const count = manifest?.items?.length > 0
                ? manifest.items.length
                : (monthlyInbound[dateStr] || 0);
            totalScheduled += Number(count);
        });

        const trucksRequired = Math.ceil(totalCases / casesPerTruck);
        const gap = totalScheduled - trucksRequired;

        return { totalCases, trucksRequired, totalScheduled, gap };
    }, [dates, monthlyDemand, monthlyInbound, poManifest, specs]);

    // 6. Responsive Rendering
    return (
        <div className="relative">
            {/* SUMMARY TOOLBAR (Net Net) */}
            {summaryStats && (
                <div className="hidden md:flex sticky left-0 right-0 mb-2 mx-1 p-1.5 bg-slate-900 text-white rounded-lg shadow-md items-center justify-between z-10 font-mono text-xs uppercase tracking-wider">
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-slate-400 text-[8px]">Total Plan</span>
                            <span className="font-bold text-sm text-blue-200">{summaryStats.totalCases.toLocaleString()} <span className="text-[8px] text-slate-500">cs</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-400 text-[8px]">Est. Trucks</span>
                            <span className="font-bold text-sm">{summaryStats.trucksRequired} <span className="text-[8px] text-slate-500">trks</span></span>
                        </div>
                    </div>

                    {/* GAP INDICATOR */}
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col text-right">
                            <span className="text-slate-400 text-[8px]">Scheduled</span>
                            <span className="font-bold text-sm text-emerald-400">{summaryStats.totalScheduled}</span>
                        </div>

                        <div className={`flex flex-col items-center justify-center px-3 py-0.5 rounded border ${summaryStats.gap < 0 ? 'bg-red-500/20 border-red-500 text-red-200' : 'bg-emerald-500/20 border-emerald-500 text-emerald-200'}`}>
                            <span className="text-[8px] opacity-75">Gap</span>
                            <span className="font-black text-lg leading-none">
                                {summaryStats.gap > 0 ? '+' : ''}{summaryStats.gap}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4 pb-20">
                {dates.slice(0, 30).map(date => {
                    const dateStr = getLocalISOString(date);
                    return (
                        <PlanningMobileCard
                            key={dateStr}
                            date={date}
                            todayStr={todayStr}
                            demandVal={monthlyDemand[dateStr]}
                            updateDateDemand={updateDateDemand}
                            actualVal={monthlyProductionActuals[dateStr]}
                            updateDateActual={updateDateActual}
                            // Pass items from poManifest
                            manifestItems={poManifest[dateStr]?.items || []}
                            monthlyInboundVal={monthlyInbound[dateStr]}
                            updateDateInbound={updateDateInbound}
                            ledgerItem={ledgerMap[dateStr]}
                            openManager={openManager}
                            readOnly={readOnly}
                        />
                    );
                })}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto pb-4 relative custom-scrollbar">
                <table className="w-full border-collapse text-sm">
                    <PlanningHeader dates={dates} todayStr={todayStr} />
                    <tbody>
                        <PlanningRowDemand
                            dates={dates}
                            monthlyDemand={monthlyDemand}
                            updateDateDemand={updateDateDemand}
                            updateDateDemandBulk={updateDateDemandBulk}
                            readOnly={readOnly}
                            todayStr={todayStr}
                        />

                        <PlanningRowActual
                            dates={dates}
                            monthlyProductionActuals={monthlyProductionActuals}
                            updateDateActual={updateDateActual}
                            readOnly={readOnly}
                            todayStr={todayStr}
                        />

                        <PlanningRowInbound
                            dates={dates}
                            poManifest={poManifest} // Pass the correct map
                            monthlyInbound={monthlyInbound}
                            updateDateInbound={updateDateInbound}
                            openManager={openManager}
                            readOnly={readOnly}
                            todayStr={todayStr}
                        />



                        <PlanningRowInventory
                            dates={dates}
                            ledgerMap={ledgerMap}
                            specs={specs}
                            safetyTarget={specs?.bottles_per_truck ? specs.bottles_per_truck * 2 : 0}
                            todayStr={todayStr}
                        />

                        <PlanningRowCoverage
                            dates={dates}
                            ledgerMap={ledgerMap}
                            monthlyDemand={monthlyDemand}
                            monthlyInbound={monthlyInbound}
                            poManifest={poManifest}
                            specs={specs}
                            todayStr={todayStr}
                        />
                    </tbody>
                </table>
            </div>

            {renderManagerModal()}
        </div>
    );
}
