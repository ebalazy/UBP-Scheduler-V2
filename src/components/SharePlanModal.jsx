import { useState, useMemo } from 'react';
import { XMarkIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function SharePlanModal({ isOpen, onClose, selectedSize, monthlyDemand, monthlyInbound, monthlyProductionActuals }) {
    const [copied, setCopied] = useState(false);

    const planText = useMemo(() => {
        if (!isOpen) return '';

        const today = new Date();
        const next4Weeks = [];

        // Loop 28 days
        for (let i = 0; i < 28; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay(); // 0=Sun

            // Logic: Only include days with activity
            const demand = monthlyDemand[dateStr] || 0;
            const actual = monthlyProductionActuals[dateStr]; // usually undefined for future
            const inbound = monthlyInbound[dateStr] || 0;

            if (demand > 0 || inbound > 0) {
                // Determine Week Number (relative to start)
                const weekNum = Math.floor(i / 7) + 1;

                // Add header if new week
                const weekLabel = `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                next4Weeks.push({
                    date: d,
                    dateStr,
                    dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    weekLabel,
                    weekIndex: Math.floor(i / 7),
                    demand,
                    inbound
                });
            }
        }

        // Format Text
        let text = `📅 PRODUCTION PLAN: ${selectedSize}\nGenerated: ${today.toLocaleDateString()}\n\n`;

        let currentWeek = -1;

        next4Weeks.forEach(day => {
            if (day.weekIndex !== currentWeek) {
                text += `\n[${day.weekLabel}]\n`;
                currentWeek = day.weekIndex;
            }

            const lines = [];
            if (day.demand > 0) lines.push(`  - Run: ${day.demand.toLocaleString()} cs`);
            if (day.inbound > 0) lines.push(`  - 🚛 INBOUND: ${day.inbound} Truck(s)`);

            text += `${day.dayName} ${day.date.getDate()}:\n${lines.join('\n')}\n`;
        });

        if (next4Weeks.length === 0) text += "No activity scheduled for the next 4 weeks.";

        return text;
    }, [isOpen, selectedSize, monthlyDemand, monthlyInbound, monthlyProductionActuals]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(planText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto w-full h-full bg-black bg-opacity-50 flex items-start justify-center pt-20">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 md:mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <span className="mr-2">📤</span>
                        Share Plan
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4">
                    <p className="text-sm text-gray-500 mb-2">
                        Copy this summary to email or text to your team.
                    </p>
                    <textarea
                        readOnly
                        className="w-full h-64 p-3 border rounded-md bg-gray-50 font-mono text-xs text-gray-800 focus:ring-blue-500 focus:border-blue-500"
                        value={planText}
                    />
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end">
                    <button
                        onClick={handleCopy}
                        className={`
                            flex items-center px-4 py-2 rounded-md font-bold text-white transition-all
                            ${copied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}
                        `}
                    >
                        {copied ? (
                            <>
                                <CheckIcon className="h-5 w-5 mr-1" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <ClipboardDocumentIcon className="h-5 w-5 mr-1" />
                                Copy to Clipboard
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
