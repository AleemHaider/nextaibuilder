import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
// ---------------------------------------------------------------------------
// prefers-reduced-motion detection — evaluated once at module load.
// Guarded for SSR / non-DOM environments.
// ---------------------------------------------------------------------------
function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function SortableRow({ item, disabled, renderItem, reduceMotion, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, } = useSortable({
        id: item.id,
        disabled,
        // Disable layout animations entirely when the user has requested reduced
        // motion. Otherwise keep @dnd-kit's default (animated reorder).
        animateLayoutChanges: reduceMotion ? () => false : undefined,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition: reduceMotion ? undefined : transition,
    };
    // Only surface the drag listeners/attributes when enabled. A disabled list
    // must not trap keyboard focus on the handle or accept pointer drag.
    const dragHandleProps = disabled
        ? {}
        : { ...attributes, ...listeners };
    return (_jsx("li", { ref: setNodeRef, style: style, "data-sortable-id": item.id, className: cn('list-none', isDragging && 'relative z-10 opacity-80'), children: renderItem(item, dragHandleProps, isDragging) }));
}
// ---------------------------------------------------------------------------
// SortableList — main export
// ---------------------------------------------------------------------------
export function SortableList({ items, onReorder, renderItem, disabled = false, className, }) {
    const reduceMotion = useMemo(() => prefersReducedMotion(), []);
    const sensors = useSensors(useSensor(PointerSensor, {
        // Require a small movement before starting a drag so that clicks on
        // buttons inside rows still register as clicks, not drags.
        activationConstraint: { distance: 4 },
    }), useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    }));
    const ids = useMemo(() => items.map((item) => item.id), [items]);
    function handleDragEnd(event) {
        if (disabled)
            return;
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0)
            return;
        const reordered = arrayMove(items, oldIndex, newIndex);
        // Re-index to contiguous 0-based order values.
        const next = reordered.map((item, index) => ({
            id: item.id,
            order: index,
        }));
        onReorder(next);
    }
    return (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: ids, strategy: verticalListSortingStrategy, children: _jsx("ul", { className: cn('flex flex-col gap-2 p-0 m-0', className), "aria-disabled": disabled || undefined, children: items.map((item) => (_jsx(SortableRow, { item: item, disabled: disabled, renderItem: renderItem, reduceMotion: reduceMotion }, item.id))) }) }) }));
}
