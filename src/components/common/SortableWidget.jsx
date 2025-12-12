import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars2Icon } from '@heroicons/react/24/outline'; // Grab handle icon

export default function SortableWidget({ id, children }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        // Ensure z-index is high when dragging
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative'
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 group relative transition-colors duration-200">
            {/* Drag Handle - Only visible on hover or active */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 z-10 box-content"
                title="Drag to Move"
            >
                <Bars2Icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="h-full">
                {children}
            </div>
        </div>
    );
}
