'use client'

import * as React from 'react'
import { DndContext, type DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedbackCard } from './feedback-card'
import { FeedbackDetailSheet } from './feedback-detail-sheet'
import type { Feedback } from './types'

type Status = 'backlog' | 'in_progress' | 'review' | 'done'

const COLUMNS: { id: Status; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
]

function KanbanColumn({ id, label, items, onCardClick }: {
  id: Status
  label: string
  items: Feedback[]
  onCardClick: (f: Feedback) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className="flex flex-col gap-2 min-h-[200px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 rounded-lg p-2 transition-colors ${isOver ? 'bg-muted/60' : 'bg-muted/30'}`}
      >
        {items.map((f) => (
          <FeedbackCard key={f.id} feedback={f} onClick={onCardClick} />
        ))}
      </div>
    </div>
  )
}

interface FeedbackKanbanProps {
  feedbacks: Feedback[]
  loading: boolean
  onStatusChange: (id: string, status: Status) => void
}

export function FeedbackKanban({ feedbacks, loading, onStatusChange }: FeedbackKanbanProps) {
  const [selected, setSelected] = React.useState<Feedback | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as Status
    const feedback = feedbacks.find((f) => f.id === active.id)
    if (!feedback || feedback.status === newStatus) return
    onStatusChange(feedback.id, newStatus)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-2 min-h-[200px]">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              items={feedbacks.filter((f) => f.status === col.id)}
              onCardClick={setSelected}
            />
          ))}
        </div>
      </DndContext>
      <FeedbackDetailSheet
        feedback={selected}
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
      />
    </>
  )
}
