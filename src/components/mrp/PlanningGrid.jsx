import React, { useState, useMemo } from 'react';
import { getLocalISOString, addDays } from '../../utils/dateUtils';
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
    updateDateDemand,
    updateDateDemandBulk,
    updateDateActual,
    updateDateInbound,
    dailyLedger = [],
    specs,
    userProfile,
    startDate,
    readOnly = false
}) {
    // 1. Context Hooks
    // Update: Destructure correct values from ProcurementContext
    const { poManifest, updateDailyManifest, removeOrder } = useProcurement();

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

    // 6. Responsive Rendering
    return (
        <div className="relative">
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
