'use client'

import * as React from 'react'
import { IconBug, IconCamera, IconSend } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useUser } from '@/context/user-context'
import { AnnotationCanvas } from '@/components/bug-report-annotation-canvas'

type Step = 'form' | 'annotate'

export function BugReportWidget() {
  const { user } = useUser()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>('form')
  const [beschreibung, setBeschreibung] = React.useState('')
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<string | null>(null)
  const [annotatedDataUrl, setAnnotatedDataUrl] = React.useState<string | null>(null)
  const [capturing, setCapturing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  if (!user) return null

  async function handleCaptureScreenshot() {
    setCapturing(true)
    setOpen(false)
    // kurze Pause damit Modal ausblendet
    await new Promise((r) => setTimeout(r, 150))

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio,
    })
    const dataUrl = canvas.toDataURL('image/png')
    setScreenshotDataUrl(dataUrl)
    setAnnotatedDataUrl(dataUrl)
    setOpen(true)
    setStep('annotate')
    setCapturing(false)
  }

  async function handleSubmit(screenshotUrl?: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beschreibung,
          screenshot_url: screenshotUrl ?? undefined,
          seite_url: window.location.href,
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Senden')
      toast.success('Bug gemeldet, danke!')
      handleClose()
    } catch {
      toast.error('Fehler beim Senden des Bugs')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitWithScreenshot() {
    if (!annotatedDataUrl) {
      await handleSubmit()
      return
    }

    // Base64 → Blob → Upload zu Supabase Storage (Browser-Client)
    const { supabase } = await import('@/lib/supabase')
    const blob = await (await fetch(annotatedDataUrl)).blob()
    const path = `${user!.id}/${crypto.randomUUID()}.png`
    const { data: uploadData, error } = await supabase.storage
      .from('bug-screenshots')
      .upload(path, blob, { contentType: 'image/png' })

    if (error || !uploadData) {
      toast.error('Screenshot-Upload fehlgeschlagen')
      await handleSubmit()
      return
    }

    const { data: urlData } = supabase.storage
      .from('bug-screenshots')
      .getPublicUrl(uploadData.path)

    await handleSubmit(urlData?.publicUrl)
  }

  function handleClose() {
    setOpen(false)
    setStep('form')
    setBeschreibung('')
    setScreenshotDataUrl(null)
    setAnnotatedDataUrl(null)
  }

  const beschreibungValid = beschreibung.trim().length >= 10

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
        aria-label="Bug melden"
        title="Bug melden"
      >
        <IconBug size={22} />
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBug size={18} />
              Bug melden
            </DialogTitle>
          </DialogHeader>

          {step === 'form' && (
            <div className="flex flex-col gap-4">
              <Textarea
                placeholder="Was ist passiert? (mindestens 10 Zeichen)"
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                rows={4}
                className="resize-none"
              />

              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={handleCaptureScreenshot}
                  disabled={!beschreibungValid || capturing}
                  className="gap-2"
                >
                  <IconCamera size={16} />
                  {capturing ? 'Aufnehmen…' : 'Screenshot aufnehmen'}
                </Button>

                <Button
                  onClick={() => handleSubmit()}
                  disabled={!beschreibungValid || submitting}
                  variant="secondary"
                  className="gap-2"
                >
                  <IconSend size={16} />
                  Ohne Screenshot senden
                </Button>
              </div>
            </div>
          )}

          {step === 'annotate' && screenshotDataUrl && (
            <AnnotationCanvas
              screenshotDataUrl={screenshotDataUrl}
              onDone={(dataUrl) => {
                setAnnotatedDataUrl(dataUrl)
              }}
              onSubmit={handleSubmitWithScreenshot}
              onRetake={() => {
                setStep('form')
                setScreenshotDataUrl(null)
              }}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
