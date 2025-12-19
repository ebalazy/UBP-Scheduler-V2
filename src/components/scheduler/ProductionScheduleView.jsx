import React, { useState, useEffect } from 'react';
import TimelineBoard from './TimelineBoard';
import RunEditorModal from './RunEditorModal';
import { generateMockRuns, PRODUCTION_LINES } from '../../utils/schedulerLogic';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function ProductionScheduleView({ readOnly = false }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [runs, setRuns] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRun, setEditingRun] = useState(null);

    // Load Data Effect
    useEffect(() => {
        // In real V2, convert this to Supabase fetch
        const mockData = generateMockRuns(selectedDate.toISOString());
        setRuns(mockData);
    }, [selectedDate]);

    const handleDateShift = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const handleRunClick = (run) => {
        if (readOnly) return;
        setEditingRun(run);
        setIsModalOpen(true);
    };

    const handleAddRun = () => {
        setEditingRun(null);
        setIsModalOpen(true);
    };

    const handleSaveRun = (run) => {
        setRuns(prev => {
            const exists = prev.find(r => r.id === run.id);
            if (exists) {
                return prev.map(r => r.id === run.id ? run : r);
            } else {
                return [...prev, run];
            }
        });
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <RunEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveRun}
                initialRun={editingRun}
                selectedDate={selectedDate}
            />

            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">

                {/* Visual Title */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-md">
                        <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-none">Production Schedule</h2>
                        <p className="text-xs text-gray-500 mt-1">Manage Work Orders & Line Capacity</p>
                    </div>
                </div>

                {/* Center: Date Nav */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                    <button onClick={() => handleDateShift(-1)} className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-md shadow-sm transition-all">
                        <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div className="px-4 font-bold text-gray-700 dark:text-gray-200 w-32 text-center">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <button onClick={() => handleDateShift(1)} className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-md shadow-sm transition-all">
                        <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                </div>

                {/* Right: Actions */}
                {!readOnly && (
                    <button
                        onClick={handleAddRun}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-all"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>New Run</span>
                    </button>
                )}
            </div>

            {/* Timeline */}
            <TimelineBoard
                runs={runs}
                lines={PRODUCTION_LINES}
                onRunClick={handleRunClick}
            />

            {/* Shift Summary (Placeholder) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Shift 1 (07:00 - 15:00)', 'Shift 2 (15:00 - 23:00)', 'Shift 3 (23:00 - 07:00)'].map((shift, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">{shift}</h4>
                        <div className="text-2xl font-bold text-gray-800 dark:text-white">-- Cases</div>
                        <div className="text-sm text-green-600 font-medium pb-1">On Track</div>
                    </div>
                ))}
            </div>

        </div>
    );
}
