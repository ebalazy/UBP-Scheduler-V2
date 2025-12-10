import { useDroppable } from '@dnd-kit/core';

export default function DroppableColumn({ id, children, className = "" }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    // changing style when item is dragged over to give visual feedback
    const style = {
        backgroundColor: isOver ? '#f9fafb' : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`min-h-[300px] transition-colors rounded-xl ${className}`}
        >
            {children}
        </div>
    );
}
