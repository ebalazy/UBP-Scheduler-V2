import React, { memo } from 'react';
import { formatLocalDate } from '../../../utils/dateUtils';

const PlanningRowCoverage = memo(({ dates, ledgerMap, monthlyDemand, monthlyInbound, poManifest, specs, todayStr, leadTimeDays = 2 }) => {
    // Helper to get daily inbound trucks
    const getDailyTrucks = (dateStr) => {
        if (poManifest && poManifest[dateStr]?.items?.length > 0) {
            return poManifest[dateStr].items.length;
        }
        return Number(monthlyInbound[dateStr]) || 0;
    };

    return (
        <tr className="border-t border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800">
            <th className="sticky left-0 min-w-[140px] w-[140px] h-8 bg-slate-300 dark:bg-slate-800 border-r border-slate-400 dark:border-slate-600 pl-2 pr-2 text-left text-xs font-bold text-slate-500 uppercase z-10 shadow-md">
                <div className="w-full h-full flex items-center">
                    Coverage (DOS)
                </div>
            </th>
            {dates.map((date) => {
                const dateStr = formatLocalDate(date);
                const ledgerItem = ledgerMap[dateStr];
                const specsScrap = 1 + ((specs?.scrapPercentage || 0) / 100);
                const isToday = dateStr === todayStr;

                // FIXED: Use PREVIOUS day's ending balance as THIS day's starting balance
                // Find previous date
                const prevDate = new Date(date);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevDateStr = formatLocalDate(prevDate);
                const prevLedgerItem = ledgerMap[prevDateStr];

                // Starting balance = previous day's ending balance (or current if first day)
                const startingBalance = prevLedgerItem ? prevLedgerItem.balance : (ledgerItem?.balance || 0);

                // Add today's inbound to starting balance
                const todayInbound = getDailyTrucks(dateStr);
                const todayInboundBottles = todayInbound * (specs?.bottlesPerTruck || 20000);

                let coverage = 0;
                let remaining = startingBalance + todayInboundBottles;
                let isInfinite = false;

                // Look ahead up to 30 days (starting from THIS day)
                for (let i = 0; i <= 30; i++) {
                    const nextDate = new Date(date);
                    nextDate.setDate(nextDate.getDate() + i);
                    const nextDateStr = formatLocalDate(nextDate);

                    const demand = (monthlyDemand[nextDateStr] || 0) * specs.bottlesPerCase * specsScrap;

                    if (demand === 0) {
                        coverage += 1;
                        if (i === 30) isInfinite = true;
                        continue;
                    }

                    if (remaining >= demand) {
                        remaining -= demand;
                        coverage += 1;
                    } else {
                        coverage += remaining / demand;
                        remaining = 0;
                        break;
                    }
                }

                const val = coverage.toFixed(1);
                const numericVal = parseFloat(val);

                // UPDATED: Lead time-aware color thresholds
                const criticalThreshold = leadTimeDays; // Red if coverage <= lead time
                const warningThreshold = leadTimeDays + 2; // Yellow if coverage <= lead time + 2

                let colorClass = 'text-slate-400';
                if (startingBalance + todayInboundBottles > 0) {
                    if (numericVal <= criticalThreshold) {
                        colorClass = 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold';
                    } else if (numericVal <= warningThreshold) {
                        colorClass = 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 font-bold';
                    } else {
                        colorClass = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold';
                    }
                }

                // Override for Today Highlight (Overlay style)
                if (isToday) {
                    colorClass += ' bg-blue-50/50 dark:bg-blue-900/10 border-x-2 border-x-blue-300';
                }

                return (
                    <td key={dateStr} className={`min-w-[100px] w-[100px] h-8 p-0 text-center text-xs border-r border-slate-300 dark:border-slate-600 ${colorClass}`} title={`Coverage: ${val} days | Lead Time: ${leadTimeDays} days`}>
                        <div className="w-full h-full flex items-center justify-center">
                            {isInfinite ? '∞' : val}
                        </div>
                    </td>
                );
            })}
        </tr>
    );
});

export default PlanningRowCoverage;
