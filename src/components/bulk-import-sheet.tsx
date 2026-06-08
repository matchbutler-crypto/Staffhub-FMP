'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { IconUpload, IconFile, IconX, IconLoader2 } from '@tabler/icons-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ERFAHRUNGSLEVEL } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Phase = 'upload' | 'extracting' | 'wizard'

export interface ExtractedItem {
  tempCvPfad: string
  skills: string[]
  originalFileName: string
}

export interface BulkImportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  isManagerOrAdmin: boolean
  agenturId: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024

// API-level arbeitsmodell values (different from UI constants)
const ARBEITSMODELL_API = ['Onshore', 'Nearshore', 'Offshore'] as const

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getFirstOfNextMonth(): string {
  const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
}

// ---------------------------------------------------------------------------
// UploadPhase
// ---------------------------------------------------------------------------

interface UploadPhaseProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  onStart: () => void
  maxFiles: number
}

function UploadPhase({ files, onFilesChange, onStart, maxFiles }: UploadPhaseProps) {
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      setValidationError(null)

      const combined = [...files, ...accepted]
      if (combined.length > maxFiles) {
        setValidationError(`Maximal ${maxFiles} Dateien erlaubt.`)
        return
      }

      onFilesChange(combined)
    },
    [files, maxFiles, onFilesChange]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    maxSize: MAX_FILE_SIZE,
  })

  const rejectionError = fileRejections[0]?.errors[0]?.code === 'file-too-large'
    ? 'Eine oder mehrere Dateien überschreiten 10 MB.'
    : fileRejections[0]?.errors[0]?.code === 'file-invalid-type'
    ? 'Nur PDF-Dateien erlaubt.'
    : undefined

  const handleRemove = (index: number) => {
    setValidationError(null)
    onFilesChange(files.filter((_, i) => i !== index))
  }

  const displayError = rejectionError ?? validationError
  const hasError = !!displayError

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : hasError
            ? 'border-destructive bg-destructive/5'
            : 'border-input hover:border-primary/50 hover:bg-muted/40'
        }`}
      >
        <input {...getInputProps()} />
        <IconUpload className="size-6 text-muted-foreground" />
        <div>
          <span className="font-medium">PDFs hier ablegen</span>
          <span className="text-muted-foreground"> oder klicken zum Auswählen</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Nur PDF, max. 10 MB pro Datei · max. {maxFiles} Dateien
        </p>
      </div>

      {/* Validation error */}
      {displayError && (
        <p className="text-xs text-destructive">{displayError}</p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm"
            >
              <IconFile className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${file.name} entfernen`}
              >
                <IconX className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Start button */}
      <Button
        type="button"
        className="w-full"
        disabled={files.length === 0}
        onClick={onStart}
      >
        {files.length > 0 ? `${files.length} PDF(s) importieren` : 'Importieren'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExtractionPhase
// ---------------------------------------------------------------------------

interface ExtractionPhaseProps {
  current: number
  total: number
}

function ExtractionPhase({ current, total }: ExtractionPhaseProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <IconLoader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm font-medium">
          PDF {current} von {total} wird analysiert…
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">{percentage} %</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WizardForm
// ---------------------------------------------------------------------------

const wizardSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  rolle: z.string().min(1, 'Rolle ist erforderlich').max(200),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  verfuegbar_ab: z.string().min(1, 'Datum ist erforderlich'),
  arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']),
  ek_tagesrate: z.string().optional(),
})
type WizardFormData = z.infer<typeof wizardSchema>

interface WizardFormProps {
  item: ExtractedItem
  index: number
  total: number
  agenturId: string | null
  isManagerOrAdmin: boolean
  onConfirm: (tempCvPfad: string) => void
  onSkip: (tempCvPfad: string) => void
}

function WizardForm({
  item,
  index,
  total,
  agenturId,
  isManagerOrAdmin,
  onConfirm,
  onSkip,
}: WizardFormProps) {
  const [skills, setSkills] = React.useState<string[]>(item.skills)
  const [skillInput, setSkillInput] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: '',
      rolle: '',
      erfahrungslevel: 'Mid',
      verfuegbar_ab: getFirstOfNextMonth(),
      arbeitsmodell: 'Onshore',
      ek_tagesrate: '',
    },
  })

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed])
    }
    setSkillInput('')
  }

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  const onSubmit = async (data: WizardFormData) => {
    if (skills.length === 0) {
      toast.error('Mindestens ein Skill ist erforderlich.')
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: data.name,
        rolle: data.rolle,
        erfahrungslevel: data.erfahrungslevel,
        skills,
        verfuegbarkeit: 'Verfügbar ab',
        verfuegbar_ab: data.verfuegbar_ab,
        arbeitsmodell: data.arbeitsmodell,
        tempCvPfad: item.tempCvPfad,
        ...(data.ek_tagesrate ? { ek_tagesrate: parseFloat(data.ek_tagesrate) } : {}),
        ...(isManagerOrAdmin && agenturId ? { agentur_id: agenturId } : {}),
      }

      const res = await fetch('/api/ressourcen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? 'Fehler beim Anlegen der Ressource')
        return
      }

      onConfirm(item.tempCvPfad)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Truncate filename for display
  const shortName =
    item.originalFileName.length > 40
      ? `${item.originalFileName.slice(0, 37)}…`
      : item.originalFileName

  const progressPct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Ressource {index + 1} von {total}
          </span>
          <span className="max-w-[180px] truncate text-right" title={item.originalFileName}>
            {shortName}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="wiz-name">Name *</Label>
        <Input id="wiz-name" {...register('name')} placeholder="Vor- und Nachname" />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Rolle */}
      <div className="space-y-1.5">
        <Label htmlFor="wiz-rolle">Rolle *</Label>
        <Input id="wiz-rolle" {...register('rolle')} placeholder="z.B. Senior Developer" />
        {errors.rolle && (
          <p className="text-xs text-destructive">{errors.rolle.message}</p>
        )}
      </div>

      {/* Erfahrungslevel */}
      <div className="space-y-1.5">
        <Label>Erfahrungslevel *</Label>
        <Controller
          control={control}
          name="erfahrungslevel"
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Level wählen" />
              </SelectTrigger>
              <SelectContent>
                {ERFAHRUNGSLEVEL.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.erfahrungslevel && (
          <p className="text-xs text-destructive">{errors.erfahrungslevel.message}</p>
        )}
      </div>

      {/* Skills */}
      <div className="space-y-1.5">
        <Label>Skills *</Label>
        <div className="flex gap-2">
          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            placeholder="Skill eingeben"
          />
          <Button type="button" variant="outline" onClick={addSkill}>
            +
          </Button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                  aria-label={`${skill} entfernen`}
                >
                  <IconX className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Verfügbar ab */}
      <div className="space-y-1.5">
        <Label htmlFor="wiz-verfuegbar-ab">Verfügbar ab *</Label>
        <input
          id="wiz-verfuegbar-ab"
          type="date"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          {...register('verfuegbar_ab')}
        />
        {errors.verfuegbar_ab && (
          <p className="text-xs text-destructive">{errors.verfuegbar_ab.message}</p>
        )}
      </div>

      {/* Arbeitsmodell */}
      <div className="space-y-1.5">
        <Label>Arbeitsmodell</Label>
        <Controller
          control={control}
          name="arbeitsmodell"
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Modell wählen" />
              </SelectTrigger>
              <SelectContent>
                {ARBEITSMODELL_API.map((modell) => (
                  <SelectItem key={modell} value={modell}>
                    {modell}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* EK-Tagesrate */}
      <div className="space-y-1.5">
        <Label htmlFor="wiz-ek">EK-Tagesrate (optional)</Label>
        <Input
          id="wiz-ek"
          type="number"
          min={0}
          step="0.01"
          placeholder="z.B. 650"
          {...register('ek_tagesrate')}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isSubmitting}
          onClick={() => onSkip(item.tempCvPfad)}
        >
          Überspringen
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <IconLoader2 className="mr-2 size-4 animate-spin" />}
          Ressource anlegen &amp; weiter
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// BulkImportSheet (main exported component)
// ---------------------------------------------------------------------------

export function BulkImportSheet({
  open,
  onOpenChange,
  onSuccess,
  isManagerOrAdmin,
  agenturId,
}: BulkImportSheetProps) {
  const [phase, setPhase] = React.useState<Phase>('upload')
  const [files, setFiles] = React.useState<File[]>([])
  const [extractedItems, setExtractedItems] = React.useState<ExtractedItem[]>([])
  const [extractionProgress, setExtractionProgress] = React.useState(0)
  const [wizardIndex, setWizardIndex] = React.useState(0)
  const [confirmedCount, setConfirmedCount] = React.useState(0)
  const [skippedPaths, setSkippedPaths] = React.useState<string[]>([])
  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false)

  const maxFiles = isManagerOrAdmin ? 30 : 10

  const resetState = () => {
    setPhase('upload')
    setFiles([])
    setExtractedItems([])
    setExtractionProgress(0)
    setWizardIndex(0)
    setConfirmedCount(0)
    setSkippedPaths([])
    setCloseConfirmOpen(false)
  }

  const cleanupPaths = (paths: string[]) => {
    if (paths.length === 0) return
    fetch('/api/ressourcen/bulk-extract', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    }).catch(() => {
      // fire-and-forget — ignore errors
    })
  }

  const finishWizard = (finalConfirmedCount: number, finalSkippedPaths: string[]) => {
    cleanupPaths(finalSkippedPaths)
    const skipped = extractedItems.length - finalConfirmedCount
    toast.success(
      `${finalConfirmedCount} Ressource${finalConfirmedCount !== 1 ? 'n' : ''} importiert${
        skipped > 0 ? `, ${skipped} übersprungen` : ''
      }.`
    )
    onSuccess()
    resetState()
    onOpenChange(false)
  }

  const handleStartExtraction = async () => {
    setPhase('extracting')
    setExtractionProgress(0)

    const results: ExtractedItem[] = []

    for (let i = 0; i < files.length; i++) {
      setExtractionProgress(i + 1)
      const fd = new FormData()
      fd.append('file', files[i])
      fd.append('index', String(i))
      try {
        const res = await fetch('/api/ressourcen/bulk-extract', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          results.push({
            tempCvPfad: data.tempCvPfad,
            skills: data.skills ?? [],
            originalFileName: files[i].name,
          })
        } else {
          toast.error(`Fehler bei ${files[i].name} — wird übersprungen`)
        }
      } catch {
        toast.error(`Fehler bei ${files[i].name} — wird übersprungen`)
      }
    }

    if (results.length === 0) {
      toast.error('Keine CVs konnten verarbeitet werden.')
      resetState()
      return
    }

    setExtractedItems(results)
    setWizardIndex(0)
    setPhase('wizard')
  }

  const handleConfirm = (tempCvPfad: string) => {
    void tempCvPfad
    const newConfirmedCount = confirmedCount + 1
    setConfirmedCount(newConfirmedCount)
    const nextIndex = wizardIndex + 1
    if (nextIndex >= extractedItems.length) {
      finishWizard(newConfirmedCount, skippedPaths)
    } else {
      setWizardIndex(nextIndex)
    }
  }

  const handleSkip = (tempCvPfad: string) => {
    const newSkipped = [...skippedPaths, tempCvPfad]
    setSkippedPaths(newSkipped)
    const nextIndex = wizardIndex + 1
    if (nextIndex >= extractedItems.length) {
      finishWizard(confirmedCount, newSkipped)
    } else {
      setWizardIndex(nextIndex)
    }
  }

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && phase === 'wizard') {
      setCloseConfirmOpen(true)
      return
    }
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  const handleForceClose = () => {
    const remainingPaths = extractedItems.slice(wizardIndex).map((i) => i.tempCvPfad)
    cleanupPaths([...remainingPaths, ...skippedPaths])
    if (confirmedCount > 0) {
      toast.success(
        `${confirmedCount} Ressource${confirmedCount !== 1 ? 'n' : ''} wurden bereits angelegt.`
      )
      onSuccess()
    }
    setCloseConfirmOpen(false)
    resetState()
    onOpenChange(false)
  }

  const currentItem = extractedItems[wizardIndex]

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bulk Import</SheetTitle>
            <SheetDescription>
              Importiere mehrere Ressourcen auf einmal aus CV-PDFs.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {phase === 'upload' && (
              <UploadPhase
                files={files}
                onFilesChange={setFiles}
                onStart={handleStartExtraction}
                maxFiles={maxFiles}
              />
            )}
            {phase === 'extracting' && (
              <ExtractionPhase current={extractionProgress} total={files.length} />
            )}
            {phase === 'wizard' && currentItem && (
              <WizardForm
                item={currentItem}
                index={wizardIndex}
                total={extractedItems.length}
                agenturId={agenturId}
                isManagerOrAdmin={isManagerOrAdmin}
                onConfirm={handleConfirm}
                onSkip={handleSkip}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import abbrechen?</DialogTitle>
            <DialogDescription>
              {confirmedCount > 0
                ? `${confirmedCount} Ressource${confirmedCount !== 1 ? 'n' : ''} wurden bereits angelegt. Verbleibende werden verworfen.`
                : 'Keine Ressource wurde bisher angelegt. Alle temp Dateien werden gelöscht.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>
              Weitermachen
            </Button>
            <Button variant="destructive" onClick={handleForceClose}>
              Schließen &amp; verwerfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Exports for use in other files
// ---------------------------------------------------------------------------

export { UploadPhase, ExtractionPhase }
