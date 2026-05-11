'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { IconAlertTriangle, IconFile, IconUpload, IconX, IconCheck } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Vacancy {
  id: string
  titel: string
  rolle: string
}

interface SkillUploadFormProps {
  vacancies: Vacancy[]
  onSuccess?: (profileId: string) => void
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const skillUploadSchema = z.object({
  candidateName: z.string().min(1, 'Name ist erforderlich').max(200),
  availability: z.number().min(1, 'Verfügbarkeit muss mindestens 1 sein').max(168, 'Max 168 Stunden/Woche'),
  vacancyId: z.string().uuid('Bitte wählen Sie eine Vakanz').optional(),
})

type SkillUploadFormData = z.infer<typeof skillUploadSchema>

// ── File Dropzone Component ────────────────────────────────────────────────────

interface FileDropzoneProps {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
}

function FileDropzone({ value, onChange, error }: FileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onChange(accepted[0])
    },
    [onChange]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
  })

  const rejectionError =
    fileRejections[0]?.errors[0]?.code === 'file-too-large'
      ? 'Datei darf maximal 10 MB groß sein'
      : fileRejections[0]?.errors[0]?.code === 'file-invalid-type'
      ? 'Nur PDF-Dateien erlaubt'
      : undefined

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
          <IconFile className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{value.name}</span>
          <span className="text-xs text-muted-foreground">
            {(value.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <IconX className="size-4" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : error || rejectionError
              ? 'border-destructive bg-destructive/5'
              : 'border-input hover:border-primary/50 hover:bg-muted/40'
          }`}
        >
          <input {...getInputProps()} />
          <IconUpload className="size-6 text-muted-foreground" />
          <div>
            <span className="font-medium">PDF hier ablegen</span>
            <span className="text-muted-foreground"> oder klicken zum Auswählen</span>
          </div>
          <p className="text-xs text-muted-foreground">Nur PDF, maximal 10 MB</p>
        </div>
      )}
      {(error || rejectionError) && (
        <p className="text-xs text-destructive">{error ?? rejectionError}</p>
      )}
    </div>
  )
}

// ── Success State Component ────────────────────────────────────────────────────

interface SuccessStateProps {
  candidateName: string
  onNewSubmission: () => void
  onViewProfile: () => void
}

function SuccessState({ candidateName, onNewSubmission, onViewProfile }: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
        <IconCheck className="size-6 text-green-600 dark:text-green-400" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold">Profil erfolgreich eingereicht!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Das Profil von <strong>{candidateName}</strong> wurde hochgeladen und wird nun bewertet.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onNewSubmission}>
          Weiteres Profil einreichen
        </Button>
        <Button onClick={onViewProfile}>
          Zum Profil
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SkillUploadForm({ vacancies, onSuccess }: SkillUploadFormProps) {
  const router = useRouter()
  const [pdfFile, setPdfFile] = React.useState<File | null>(null)
  const [pdfError, setPdfError] = React.useState<string | undefined>()
  const [isLoading, setIsLoading] = React.useState(false)
  const [successProfileId, setSuccessProfileId] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<SkillUploadFormData>({
    resolver: zodResolver(skillUploadSchema),
    defaultValues: {
      candidateName: '',
      vacancyId: '',
    },
  })

  const selectedVacancyId = watch('vacancyId')
  const selectedVacancy = vacancies.find((v) => v.id === selectedVacancyId)

  // Reset form on successful submission
  const handleResetForm = () => {
    reset()
    setPdfFile(null)
    setPdfError(undefined)
    setSuccessProfileId(null)
  }

  // Navigate to profile edit page
  const handleNavigateToProfile = () => {
    if (successProfileId) {
      router.push(`/profiles/${successProfileId}/edit-skills`)
    }
  }

  async function onSubmit(data: SkillUploadFormData) {
    // Validate PDF file
    if (!pdfFile) {
      setPdfError('Lebenslauf (PDF) ist erforderlich')
      return
    }

    setPdfError(undefined)
    setIsLoading(true)

    try {
      // Get current user's agency from session or auth token
      // This will be called from the API endpoint
      const formData = new FormData()
      formData.append('vacancy_id', data.vacancyId)
      formData.append('candidate_name', data.candidateName)
      formData.append('file', pdfFile)

      const response = await fetch('/api/profiles', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle specific error cases
        if (response.status === 413) {
          setPdfError('Datei darf maximal 10 MB groß sein')
          toast.error('Datei zu groß')
        } else if (response.status === 400 && errorData.error?.includes('PDF')) {
          setPdfError('Nur PDF-Dateien erlaubt')
          toast.error('Ungültige Dateityp')
        } else if (response.status === 409) {
          toast.error('Diese Vakanz ist nicht mehr offen')
        } else if (response.status === 401) {
          toast.error('Sie sind nicht angemeldet')
        } else if (response.status === 403) {
          toast.error('Sie haben keine Berechtigung, Profile für diese Vakanz einzureichen')
        } else {
          toast.error(errorData.error || 'Fehler beim Hochladen des Profils')
        }
        return
      }

      const result = await response.json()
      const profileId = result.profile?.id

      if (profileId) {
        setSuccessProfileId(profileId)
        toast.success('Profil erfolgreich eingereicht!')

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(profileId)
        }
      } else {
        toast.error('Fehler: Profil-ID nicht erhalten')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler'
      console.error('Form submission error:', error)
      toast.error(`Fehler beim Hochladen: ${errorMsg}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Show success state
  if (successProfileId) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Profil eingereicht</CardTitle>
        </CardHeader>
        <CardContent>
          <SuccessState
            candidateName={watch('candidateName')}
            onNewSubmission={handleResetForm}
            onViewProfile={handleNavigateToProfile}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Profil einreichen</CardTitle>
        <CardDescription>
          Füllen Sie das Formular aus und laden Sie einen Lebenslauf hoch.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Candidate Name Field */}
          <div className="space-y-2">
            <Label htmlFor="candidate-name">
              Kandidatenname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="candidate-name"
              placeholder="z.B. Max Mustermann"
              {...register('candidateName')}
              className={errors.candidateName ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {errors.candidateName && (
              <p className="text-xs text-destructive">{errors.candidateName.message}</p>
            )}
          </div>

          {/* Vacancy Selection */}
          <div className="space-y-2">
            <Label htmlFor="vacancy-select">
              Vakanz <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="vacancyId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                  <SelectTrigger
                    id="vacancy-select"
                    className={errors.vacancyId ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder="Vakanz auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Keine Vakanzen verfügbar
                      </div>
                    ) : (
                      vacancies.map((vacancy) => (
                        <SelectItem key={vacancy.id} value={vacancy.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{vacancy.titel}</span>
                            <span className="text-xs text-muted-foreground">{vacancy.rolle}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.vacancyId && (
              <p className="text-xs text-destructive">{errors.vacancyId.message}</p>
            )}
            {selectedVacancy && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <strong>{selectedVacancy.titel}</strong> · {selectedVacancy.rolle}
              </div>
            )}
          </div>

          {/* PDF Upload */}
          <div className="space-y-2">
            <Label htmlFor="pdf-upload">
              Lebenslauf (PDF) <span className="text-destructive">*</span>
            </Label>
            <FileDropzone
              value={pdfFile}
              onChange={setPdfFile}
              error={pdfError}
            />
            <p className="text-xs text-muted-foreground">
              Der Lebenslauf wird zur Skill-Erkennung und KI-Bewertung verwendet.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={isLoading || vacancies.length === 0}
              className="flex-1"
            >
              {isLoading ? 'Wird hochgeladen...' : 'Profil einreichen'}
            </Button>
          </div>

          {/* Info Message */}
          <div className="flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Automatische Skill-Erkennung</p>
              <p className="text-xs">Der hochgeladene Lebenslauf wird analysiert, um Skills automatisch zu erkennen.</p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
