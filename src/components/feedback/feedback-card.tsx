'use client'

import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { Feedback } from './types'

const kategorieColors: Record<string, string> = {
  Bug: 'bg-red-100 text-red-700 border-red-200',
  Idee: 'bg-blue-100 text-blue-700 border-blue-200',
  Sonstiges: 'bg-gray-100 text-gray-600 border-gray-200',
}

interface FeedbackCardProps {
  feedback: Feedback
  onClick: (feedback: Feedback) => void
}

export function FeedbackCard({ feedback, onClick }: FeedbackCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feedback.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing flex flex-col gap-2"
      onClick={() => onClick(feedback)}
      {...listeners}
      {...attributes}
    >
      {feedback.screenshot_url && (
        <div className="overflow-hidden rounded border bg-muted h-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={feedback.screenshot_url} alt="Screenshot" className="w-full h-full object-cover object-top" />
        </div>
      )}
      <p className="text-sm line-clamp-2">{feedback.beschreibung}</p>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={`text-xs ${kategorieColors[feedback.kategorie]}`}>
          {feedback.kategorie}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(feedback.created_at), 'dd.MM.yy', { locale: de })}
        </span>
      </div>
      {feedback.profiles?.name && (
        <p className="text-xs text-muted-foreground truncate">{feedback.profiles.name}</p>
      )}
    </div>
  )
}
