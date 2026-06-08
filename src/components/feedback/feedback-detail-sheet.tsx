'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { IconX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const [lightboxOpen, setLightboxOpen] = React.useState(false)

  return (
    <>
    <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-fit p-0 overflow-auto bg-black/90 border-0 feedback-modal-exclude">
        <DialogTitle className="sr-only">Screenshot Vollansicht</DialogTitle>
        {feedback?.screenshot_url && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={feedback.screenshot_url}
              alt="Screenshot Vollansicht"
              className="block max-w-[90vw] max-h-[90vh] object-contain"
            />
            {feedback.annotations.map((a, i) => (
              <div
                key={i}
                className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
                style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }}
              />
            ))}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Schließen"
            >
              <IconX className="size-4" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[560px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className={feedback ? 'border-b px-6 py-4' : 'sr-only'}>
          <SheetTitle className="flex items-center gap-2">
            {feedback && (
              <Badge variant="outline" className={kategorieColors[feedback.kategorie]}>
                {feedback.kategorie}
              </Badge>
            )}
            Feedback-Detail
          </SheetTitle>
          {feedback && (
            <SheetDescription>
              {feedback.profiles?.name ?? 'Unbekannt'} · {format(new Date(feedback.created_at), 'dd. MMM yyyy HH:mm', { locale: de })}
              {feedback.seite_url && <> · <span className="font-mono text-xs">{feedback.seite_url}</span></>}
            </SheetDescription>
          )}
        </SheetHeader>
        {feedback && (
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <p className="text-sm whitespace-pre-wrap">{feedback.beschreibung}</p>
            {feedback.screenshot_url && (
              <button
                onClick={() => setLightboxOpen(true)}
                className="relative overflow-hidden rounded-lg border w-full cursor-zoom-in group"
                aria-label="Screenshot vergrößern"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={feedback.screenshot_url} alt="Screenshot" className="w-full" />
                {feedback.annotations.map((a, i) => (
                  <div
                    key={i}
                    className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
                    style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }}
                  />
                ))}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  )
}
