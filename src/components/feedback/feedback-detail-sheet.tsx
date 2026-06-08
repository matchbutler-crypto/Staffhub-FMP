'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import type { Feedback } from './types'

const kategorieColors: Record<string, string> = {
  Bug: 'bg-red-100 text-red-700 border-red-200',
  Idee: 'bg-blue-100 text-blue-700 border-blue-200',
  Sonstiges: 'bg-gray-100 text-gray-600 border-gray-200',
}

interface FeedbackDetailSheetProps {
  feedback: Feedback | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDetailSheet({ feedback, open, onOpenChange }: FeedbackDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[560px] flex-col gap-0 overflow-hidden p-0">
        {feedback && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle className="flex items-center gap-2">
                <Badge variant="outline" className={kategorieColors[feedback.kategorie]}>
                  {feedback.kategorie}
                </Badge>
                Feedback-Detail
              </SheetTitle>
              <SheetDescription>
                {feedback.profiles?.name ?? 'Unbekannt'} · {format(new Date(feedback.created_at), 'dd. MMM yyyy HH:mm', { locale: de })}
                {feedback.seite_url && <> · <span className="font-mono text-xs">{feedback.seite_url}</span></>}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              <p className="text-sm whitespace-pre-wrap">{feedback.beschreibung}</p>
              {feedback.screenshot_url && (
                <div className="relative overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={feedback.screenshot_url} alt="Screenshot" className="w-full" />
                  {feedback.annotations.map((a, i) => (
                    <div
                      key={i}
                      className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
                      style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
