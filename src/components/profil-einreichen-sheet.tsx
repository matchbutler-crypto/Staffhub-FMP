'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { IconAlertTriangle, IconFile, IconUpload, IconX } from '@tabler/icons-react'

import { TagInput } from '@/components/tag-input'
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KandidatenProfil {
  id: string
  vakanz_id: string
  vakanz_titel?: string
  agentur_id: string
  kandidatenname: string
  verfuegbarkeit_stunden: number
  verfuegbar_ab: string
  verkaufspreis: number
  skills: string[]
  erfahrungslevel: 'Junior' | 'Mid' | 'Senior' | 'Expert'
  profiltext: string
  cv_pfad: string | null
  kommentar_agentur: string | null
  status: ProfilStatus
  ki_score: number | null
  created_at: string
  updated_at: string
}

export type ProfilStatus =
  | 'Eingereicht'
  | 'In Prüfung'
  | 'Präsentiert'
  | 'Interview'
  | 'Beauftragt'
  | 'Abgelehnt'
  | 'Archiviert'

// ── Schema ─────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const profilSchema = z.object({
  kandidatenname: z.string().min(1, 'Name ist erforderlich').max(200),
  verfuegbarkeit_stunden: z
    .number({ invalid_type_error: 'Muss eine Zahl sein' })
    .int()
    .min(1, 'Mindestens 1 Stunde')
    .max(168, 'Maximal 168 Stunden/Woche'),
  verfuegbar_ab: z.string().min(1, 'Datum ist erforderlich'),
  verkaufspreis: z
    .number({ invalid_type_error: 'Muss eine Zahl sein' })
    .min(1, 'Preis ist erforderlich'),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich'),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert'], {
    required_error: 'Erfahrungslevel ist erforderlich',
  }),
  profiltext: z.string().min(1, 'Profiltext ist erforderlich').max(5000),
  kommentar_agentur: z.string().max(2000).optional(),
})

type ProfilFormData = z.infer<typeof profilSchema>

// ── CV Dropzone ────────────────────────────────────────────────────────────────

function CvDropzone({
  value,
  onChange,
  error,
}: {
  value: File | null
  onChange: (f: File | null) => void
  error?: string
}) {
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
    <div>
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
        <p className="mt-1 text-xs text-destructive">{error ?? rejectionError}</p>
      )}
    </div>
  )
}

// ── Duplikat-Warnung ───────────────────────────────────────────────────────────

function DuplikatWarnung({ name, vakanzId }: { name: string; vakanzId: string }) {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    if (!name.trim() || !vakanzId) {
      setShow(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/duplicate-check?vakanz_id=${encodeURIComponent(vakanzId)}&kandidatenname=${encodeURIComponent(name.trim())}`
        )
        if (res.ok) {
          const data = await res.json()
          setShow(data.exists === true)
        }
      } catch {
        // ignore — Warnung nur best-effort
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [name, vakanzId])

  if (!show) return null

  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong>Mögliches Duplikat:</strong> Ein Profil mit diesem Namen wurde von Ihrer
        Agentur bereits zu dieser Vakanz eingereicht. Sie können trotzdem fortfahren.
      </span>
    </div>
  )
}

// ── ProfilEinreichenSheet ──────────────────────────────────────────────────────

interface ProfilEinreichenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vakanzId: string
  vakanzTitel: string
  editProfil?: KandidatenProfil | null
  onSuccess: (newProfilId?: string) => void
}

export function ProfilEinreichenSheet({
  open,
  onOpenChange,
  vakanzId,
  vakanzTitel,
  editProfil,
  onSuccess,
}: ProfilEinreichenSheetProps) {
  const isEdit = !!editProfil
  const [cvFile, setCvFile] = React.useState<File | null>(null)
  const [cvError, setCvError] = React.useState<string | undefined>()
  const [submitting, setSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProfilFormData>({
    resolver: zodResolver(profilSchema),
    defaultValues: {
      kandidatenname: '',
      verfuegbarkeit_stunden: undefined,
      verfuegbar_ab: '',
      verkaufspreis: undefined,
      skills: [],
      erfahrungslevel: 'Senior',
      profiltext: '',
      kommentar_agentur: '',
    },
  })

  const kandidatenname = watch('kandidatenname')

  // Formular befüllen bei Edit
  React.useEffect(() => {
    if (open && editProfil) {
      reset({
        kandidatenname: editProfil.kandidatenname,
        verfuegbarkeit_stunden: editProfil.verfuegbarkeit_stunden,
        verfuegbar_ab: editProfil.verfuegbar_ab,
        verkaufspreis: editProfil.verkaufspreis,
        skills: editProfil.skills,
        erfahrungslevel: editProfil.erfahrungslevel,
        profiltext: editProfil.profiltext,
        kommentar_agentur: editProfil.kommentar_agentur ?? '',
      })
    } else if (open && !editProfil) {
      reset({
        kandidatenname: '',
        verfuegbarkeit_stunden: undefined,
        verfuegbar_ab: '',
        verkaufspreis: undefined,
        skills: [],
        erfahrungslevel: 'Senior',
        profiltext: '',
        kommentar_agentur: '',
      })
      setCvFile(null)
    }
  }, [open, editProfil, reset])

  async function onSubmit(data: ProfilFormData) {
    // CV Pflicht bei Neueinreichung
    if (!isEdit && !cvFile) {
      setCvError('Lebenslauf (PDF) ist erforderlich')
      return
    }
    setCvError(undefined)
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('vakanz_id', vakanzId)
      formData.append('kandidatenname', data.kandidatenname)
      formData.append('verfuegbarkeit_stunden', String(data.verfuegbarkeit_stunden))
      formData.append('verfuegbar_ab', data.verfuegbar_ab)
      formData.append('verkaufspreis', String(data.verkaufspreis))
      formData.append('skills', JSON.stringify(data.skills))
      formData.append('erfahrungslevel', data.erfahrungslevel)
      formData.append('profiltext', data.profiltext)
      if (data.kommentar_agentur) {
        formData.append('kommentar_agentur', data.kommentar_agentur)
      }
      if (cvFile) {
        formData.append('cv', cvFile)
      }

      const url = isEdit ? `/api/profile/${editProfil!.id}` : '/api/profile'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, { method, body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 409) {
          toast.error('Diese Vakanz ist nicht mehr offen.')
        } else if (res.status === 403) {
          toast.error(body.error ?? 'Kein Zugriff.')
        } else {
          toast.error(body.error ?? 'Fehler beim Einreichen.')
        }
        return
      }

      toast.success(isEdit ? 'Profil aktualisiert.' : 'Profil eingereicht.')
      onOpenChange(false)
      const body = await res.json().catch(() => ({}))
      onSuccess(!isEdit ? body.profil?.id : undefined)
    } catch {
      toast.error('Verbindungsfehler — bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? 'Profil bearbeiten' : 'Profil einreichen'}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? 'Änderungen sind nur möglich solange Status „Eingereicht" ist.' : `Vakanz: ${vakanzTitel}`}
          </SheetDescription>
        </SheetHeader>

        <form
          id="profil-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-4 py-4"
        >
          {/* Duplikat-Warnung */}
          {!isEdit && (
            <DuplikatWarnung name={kandidatenname} vakanzId={vakanzId} />
          )}

          {/* Kandidatenname */}
          <div className="space-y-1.5">
            <Label htmlFor="kandidatenname">Kandidatenname *</Label>
            <Input
              id="kandidatenname"
              placeholder="z. B. M. Hoffmann oder Pseudonym"
              {...register('kandidatenname')}
            />
            {errors.kandidatenname && (
              <p className="text-xs text-destructive">{errors.kandidatenname.message}</p>
            )}
          </div>

          {/* Verfügbarkeit + Verfügbar ab */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="verfuegbarkeit_stunden">Verfügbarkeit (Std/Woche) *</Label>
              <Input
                id="verfuegbarkeit_stunden"
                type="number"
                min={1}
                max={168}
                placeholder="40"
                {...register('verfuegbarkeit_stunden', { valueAsNumber: true })}
              />
              {errors.verfuegbarkeit_stunden && (
                <p className="text-xs text-destructive">
                  {errors.verfuegbarkeit_stunden.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="verfuegbar_ab">Verfügbar ab *</Label>
              <Input
                id="verfuegbar_ab"
                type="date"
                {...register('verfuegbar_ab')}
              />
              {errors.verfuegbar_ab && (
                <p className="text-xs text-destructive">{errors.verfuegbar_ab.message}</p>
              )}
            </div>
          </div>

          {/* Verkaufspreis + Erfahrungslevel */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="verkaufspreis">Tagessatz (€/Tag) *</Label>
              <Input
                id="verkaufspreis"
                type="number"
                min={1}
                placeholder="800"
                {...register('verkaufspreis', { valueAsNumber: true })}
              />
              {errors.verkaufspreis && (
                <p className="text-xs text-destructive">{errors.verkaufspreis.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Erfahrungslevel *</Label>
              <Controller
                name="erfahrungslevel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Level wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Junior">Junior</SelectItem>
                      <SelectItem value="Mid">Mid</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.erfahrungslevel && (
                <p className="text-xs text-destructive">
                  {errors.erfahrungslevel.message}
                </p>
              )}
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-1.5">
            <Label>Skills / Technologien *</Label>
            <Controller
              name="skills"
              control={control}
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.skills?.message}
                  placeholder="Skill eingeben, Enter drücken"
                />
              )}
            />
          </div>

          {/* Profiltext */}
          <div className="space-y-1.5">
            <Label htmlFor="profiltext">Kurzbeschreibung / Profiltext *</Label>
            <Textarea
              id="profiltext"
              rows={4}
              placeholder="Erfahrungen, Kernkompetenzen, bisherige Projekte…"
              {...register('profiltext')}
            />
            {errors.profiltext && (
              <p className="text-xs text-destructive">{errors.profiltext.message}</p>
            )}
          </div>

          {/* CV Upload */}
          <div className="space-y-1.5">
            <Label>Lebenslauf (PDF){!isEdit && ' *'}</Label>
            {isEdit && !cvFile && editProfil?.cv_pfad && (
              <p className="text-xs text-muted-foreground">
                Bestehende Datei bleibt erhalten. Neues PDF hochladen um zu ersetzen.
              </p>
            )}
            <CvDropzone value={cvFile} onChange={setCvFile} error={cvError} />
          </div>

          {/* Kommentar */}
          <div className="space-y-1.5">
            <Label htmlFor="kommentar_agentur">Kommentar (optional)</Label>
            <Textarea
              id="kommentar_agentur"
              rows={2}
              placeholder="Hinweise zum Kandidaten oder zur Einreichung…"
              {...register('kommentar_agentur')}
            />
          </div>
        </form>

        <SheetFooter className="border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline" disabled={submitting}>
              Abbrechen
            </Button>
          </SheetClose>
          <Button type="submit" form="profil-form" disabled={submitting}>
            {submitting
              ? isEdit
                ? 'Speichern…'
                : 'Einreichen…'
              : isEdit
              ? 'Speichern'
              : 'Profil einreichen'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
