'use client'

import * as React from 'react'
import { toPng } from 'html-to-image'
import { IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AnnotationCanvas, type Annotation } from './annotation-canvas'

type Step = 'screenshot' | 'annotate' | 'form' | 'sending'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [step, setStep] = React.useState<Step>('screenshot')
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<string | null>(null)
  const [annotations, setAnnotations] = React.useState<Annotation[]>([])
  const [beschreibung, setBeschreibung] = React.useState('')
  const [kategorie, setKategorie] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setStep('screenshot')
    setScreenshotDataUrl(null)
    setAnnotations([])
    setBeschreibung('')
    setKategorie('')
    setError(null)

    // Take screenshot after a short delay to allow modal to not be in the capture
    const timer = setTimeout(async () => {
      try {
        const dataUrl = await toPng(document.body, {
          pixelRatio: 1,
          filter: (node) => !node.classList?.contains('feedback-modal-exclude'),
        })
        // Scale down to max 1920px
        const scaled = await scaleImage(dataUrl, 1920)
        setScreenshotDataUrl(scaled)
      } catch {
        setScreenshotDataUrl(null)
      } finally {
        setStep('annotate')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [open])

  async function handleSubmit() {
    if (!beschreibung.trim() || !kategorie) {
      setError('Bitte Beschreibung und Kategorie ausfüllen.')
      return
    }
    setStep('sending')
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschreibung: beschreibung.trim(),
          kategorie,
          annotations,
          seite_url: window.location.pathname,
          screenshot_base64: screenshotDataUrl ?? undefined,
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Senden')
      toast.success('Feedback gesendet — danke!')
      onOpenChange(false)
    } catch {
      setError('Feedback konnte nicht gesendet werden. Bitte erneut versuchen.')
      setStep('form')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="feedback-modal-exclude max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {step === 'screenshot' && 'Screenshot wird erstellt…'}
            {step === 'annotate' && 'Markierungen einzeichnen'}
            {step === 'form' && 'Feedback beschreiben'}
            {step === 'sending' && 'Wird gesendet…'}
          </DialogTitle>
        </DialogHeader>

        {step === 'screenshot' && (
          <div className="flex h-48 items-center justify-center">
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        )}

        {step === 'annotate' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Klicke und ziehe um Bereiche zu markieren. Klicke auf eine Markierung um sie zu entfernen.
            </p>
            <div className="relative overflow-hidden rounded-lg border bg-muted">
              {screenshotDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshotDataUrl} alt="Screenshot" className="w-full" draggable={false} />
                  <AnnotationCanvas annotations={annotations} onChange={setAnnotations} />
                </>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Kein Screenshot verfügbar
                </div>
              )}
            </div>
            {annotations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => setAnnotations([])}
              >
                <IconTrash className="mr-1 size-4" />
                Alle Markierungen entfernen
              </Button>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={() => setStep('form')}>Weiter</Button>
            </div>
          </div>
        )}

        {(step === 'form' || step === 'sending') && (
          <div className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-kategorie">Kategorie *</Label>
              <Select value={kategorie} onValueChange={setKategorie} disabled={step === 'sending'}>
                <SelectTrigger id="fb-kategorie"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug</SelectItem>
                  <SelectItem value="Idee">Idee</SelectItem>
                  <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fb-beschreibung">Beschreibung *</Label>
              <textarea
                id="fb-beschreibung"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="Was ist passiert? Was hast du erwartet?"
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                disabled={step === 'sending'}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('annotate')} disabled={step === 'sending'}>
                Zurück
              </Button>
              <Button onClick={handleSubmit} disabled={step === 'sending'}>
                {step === 'sending' ? 'Wird gesendet…' : 'Feedback senden'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

async function scaleImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(dataUrl); return }
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = Math.round((img.height / img.width) * maxWidth)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = dataUrl
  })
}
