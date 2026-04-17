// Wave 1 Story C — Reusable, accessible sortable list built on @dnd-kit.
// Generic over any item with `id` + `order`. Consumer supplies a renderItem
// function and decides which element(s) inside the row act as the drag handle
// by spreading `dragHandleProps` onto them. The whole row is intentionally
// NOT draggable — that lets rows remain clickable/focusable for other actions.
//
// onReorder is called with a compact list of `{ id, order }` pairs where
// `order` is re-indexed to contiguous 0-based values after the move. That way
// the server only needs to persist the new order field per row.
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SortableItem {
  id: string
  order: number
}

export interface SortableListProps<T extends SortableItem> {
  items: T[]
  onReorder: (next: Array<{ id: string; order: number }>) => void
  renderItem: (
    item: T,
    dragHandleProps: Record<string, unknown>,
    isDragging: boolean,
  ) => ReactNode
  disabled?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// prefers-reduced-motion detection — evaluated once at module load.
// Guarded for SSR / non-DOM environments.
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------------------------------------------------------------------
// SortableRow — one child of the sortable context. Uses useSortable to wire
// transform/transition and exposes a handle-only API through renderItem.
// ---------------------------------------------------------------------------

interface SortableRowProps<T extends SortableItem> {
  item: T
  disabled: boolean
  renderItem: SortableListProps<T>['renderItem']
  reduceMotion: boolean
}

function SortableRow<T extends SortableItem>({
  item,
  disabled,
  renderItem,
  reduceMotion,
}: SortableRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
    // Disable layout animations entirely when the user has requested reduced
    // motion. Otherwise keep @dnd-kit's default (animated reorder).
    animateLayoutChanges: reduceMotion ? () => false : undefined,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reduceMotion ? undefined : transition,
  }

  // Only surface the drag listeners/attributes when enabled. A disabled list
  // must not trap keyboard focus on the handle or accept pointer drag.
  const dragHandleProps: Record<string, unknown> = disabled
    ? {}
    : { ...attributes, ...listeners }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-sortable-id={item.id}
      className={cn(
        'list-none',
        isDragging && 'relative z-10 opacity-80',
      )}
    >
      {renderItem(item, dragHandleProps, isDragging)}
    </li>
  )
}

// ---------------------------------------------------------------------------
// SortableList — main export
// ---------------------------------------------------------------------------

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: SortableListProps<T>) {
  const reduceMotion = useMemo(() => prefersReducedMotion(), [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small movement before starting a drag so that clicks on
      // buttons inside rows still register as clicks, not drags.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const ids = useMemo(() => items.map((item) => item.id), [items])

  function handleDragEnd(event: DragEndEvent) {
    if (disabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    // Re-index to contiguous 0-based order values.
    const next = reordered.map((item, index) => ({
      id: item.id,
      order: index,
    }))
    onReorder(next)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          className={cn('flex flex-col gap-2 p-0 m-0', className)}
          aria-disabled={disabled || undefined}
        >
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              disabled={disabled}
              renderItem={renderItem}
              reduceMotion={reduceMotion}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
