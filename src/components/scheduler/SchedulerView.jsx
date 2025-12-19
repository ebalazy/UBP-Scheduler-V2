import React from 'react';
import ProductionScheduleView from './ProductionScheduleView';

export default function SchedulerView({ state, setters, results, readOnly = false }) {
    // Phase 8: Production Scheduler 2.0
    // This wrapper now delegates to the new ProductionScheduleView
    // In the future, we can hoist state management up here or directly into ProductionScheduleView

    return (
        <div className="max-w-full mx-auto">
            <ProductionScheduleView readOnly={readOnly} />
        </div>
    );
}
