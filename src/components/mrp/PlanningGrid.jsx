import React, { useState, useEffect } from 'react';
import { getLocalISOString, formatLocalDate, addDays } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';
import { useProcurement } from '../../context/ProcurementContext';
import ScheduleManagerModal from '../procurement/ScheduleManagerModal';
import { ClipboardDocumentListIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

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
    userProfile,
    startDate // Lifted State from Parent (MRPView)
}) {
    const { bottleSizes } = useSettings();
    const { poManifest, saveProcurementEntry, deleteProcurementEntry } = useProcurement();

    // Alias for internal use matches new component expectation
    const truckManifest = poManifest;
    const ledger = dailyLedger;

    // -- State --
    // startDate is now a Prop. defaulting to today-3 just in case prop is missing (robustness)
    const effectiveStartDate = startDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d;
    })();

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
        // Wait, Parent controls "30 Days" text. Should we show 14 or 30?
        // Original code showed 14. Export showed 30.
        // Let's stick to 14 for the Grid View to keep performance high, or increase if requested.
        // The parent "Activity Ledger 30 Days" badge implies 30 days history/forecast context?
        // Let's generate 21 days for a fuller view? 
        // User said "No shortcuts". Let's verify original intent.
        // Original loop: `for (let i = 0; i < 14; i++)`.
        // Let's keep 14 for now to avoid breaking horizontal layout constraints.

        const d = [];
        // Ensure effectiveStartDate is a generic Date object
        const base = new Date(effectiveStartDate);

        for (let i = 0; i < 14; i++) {
            const next = new Date(base);
            next.setDate(base.getDate() + i);
            d.push(next);
        }
        setDates(d);
    }, [effectiveStartDate]);

    // -- Handlers --
    const openManager = (dateStr) => setManagerDate(dateStr);
    const closeManager = () => setManagerDate(null);

    // -- Render Props --
    const todayStr = formatLocalDate(new Date());
    const safetyTarget = (userProfile?.safety_stock_loads || 0) * (specs?.bottlesPerTruck || 20000);

    // -- Modal --
    const renderManagerModal = () => {
        if (!managerDate) return null;
        const currentManifest = truckManifest[managerDate];
        const currentItems = currentManifest?.items || [];

        return (
            <ScheduleManagerModal
                isOpen={!!managerDate}
                onClose={closeManager}
                date={managerDate}
                monthlyInbound={monthlyInbound}
                specs={specs}
                orders={currentItems}
                onSave={async (item) => {
                    await saveProcurementEntry(item);
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
            <div className="flex flex-col gap-2 pb-24 relative pt-2">
                {/* Mobile Date Nav is now handled by the Parent Header which stays visible? 
                    Actually, on Mobile, the parent header might scroll away or stick.
                    MRPView header is sticky: `sticky top-0 z-20`.
                    So we don't need redundant controls here. 
                */}

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
            {/* Header Controls REMOVED (Lifted to Parent) */}

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
