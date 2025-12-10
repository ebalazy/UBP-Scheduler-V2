import { useDroppable } from '@dnd-kit/core';

export default function DroppableColumn({ id, children, className = "", highlight = false }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    const style = {
        backgroundColor: isOver ? '#eff6ff' : (highlight ? '#f8fafc' : undefined),
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            // Add border indication when highlighted (dragging)
            className={`min-h-[150px] transition-all duration-200 rounded-xl ${className} ${highlight ? 'border-2 border-dashed border-blue-200' : 'border-2 border-transparent'}`}
        >
            {children}
        </div>
    );
}
