'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { IconUpload, IconFile, IconX, IconLoader2 } from '@tabler/icons-react'
import { useDropzone } from 'react-dropzone'

import { Button } from '@/components/ui/button'

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

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getFirstOfNextMonth(): string {
  const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  return next.toISOString().split('T')[0]
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

      const oversized = accepted.some((f) => f.size > MAX_FILE_SIZE)
      if (oversized) {
        setValidationError('Eine oder mehrere Dateien überschreiten die maximale Größe von 10 MB.')
        return
      }

      const combined = [...files, ...accepted]
      if (combined.length > maxFiles) {
        setValidationError(`Maximal ${maxFiles} Dateien erlaubt.`)
        return
      }

      onFilesChange(combined)
    },
    [files, maxFiles, onFilesChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    noClick: false,
  })

  const handleRemove = (index: number) => {
    setValidationError(null)
    onFilesChange(files.filter((_, i) => i !== index))
  }

  const hasError = !!validationError

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
      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
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
// Exports for use in Task 5
// ---------------------------------------------------------------------------

export { UploadPhase, ExtractionPhase }
