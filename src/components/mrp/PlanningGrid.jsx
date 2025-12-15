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
    startDate, // Lifted State from Parent (MRPView)
    readOnly = false
}) {
    const { bottleSizes } = useSettings();
    // ...
    // ...
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
            readOnly={readOnly}
        />
    );
})}

{ renderManagerModal() }
            </div >
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
                    readOnly={readOnly}
                />

                <PlanningRowActual
                    dates={dates}
                    monthlyProductionActuals={monthlyProductionActuals}
                    updateDateActual={updateDateActual}
                    readOnly={readOnly}
                />

                <PlanningRowInbound
                    dates={dates}
                    poManifest={truckManifest} // Pass the map
                    monthlyInbound={monthlyInbound}
                    updateDateInbound={updateDateInbound}
                    openManager={openManager}
                    readOnly={readOnly}
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
