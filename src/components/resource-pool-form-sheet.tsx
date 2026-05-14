'use client'

import * as React from 'react'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { IconAlertTriangle, IconFile, IconUpload, IconX, IconLoader2 } from '@tabler/icons-react'
import { useDropzone } from 'react-dropzone'

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function ExtractionLoadingState({ step }: { step: 'analyzing' | 'extracting' }) {
  return (
    <div className="space-y-6">
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes progress-flow {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>

      <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-8">
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20"
            style={{ animation: 'pulse-subtle 2s ease-in-out infinite' }}
          >
            <IconFile className="h-8 w-8 text-primary" />
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {step === 'analyzing' ? 'Analysiere Lebenslauf...' : 'Erkenne Skills...'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'analyzing'
                ? 'Der Lebenslauf wird verarbeitet'
                : 'Professionelle Skills werden extrahiert'}
            </p>
          </div>

          <div className="w-full max-w-xs mt-4">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
                style={{ animation: 'progress-flow 2s ease-in-out infinite' }}
              />
            </div>
          </div>

          <div className="flex gap-1 mt-2">
            {['analyzing', 'extracting'].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  step === s ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

const resourcePoolSchema = z.object({
  resourceName: z.string().min(1, 'Name ist erforderlich').max(200),
  availability: z.number().min(1, 'Verfügbarkeit muss mindestens 1 sein').max(168, 'Max 168 Stunden/Woche'),
  verfuegbar_ab: z.string().optional(),
  ek_tagesrate: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).positive().optional(),
})

type ResourcePoolFormData = z.infer<typeof resourcePoolSchema>

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
          <span className="text-xs text-muted-foreground">{(value.size / 1024 / 1024).toFixed(1)} MB</span>
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

interface ResourcePoolFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  isManagerOrAdmin?: boolean
  agenturen?: { id: string; name: string }[]
}

export function ResourcePoolFormSheet({ open, onOpenChange, onSuccess, isManagerOrAdmin, agenturen = [] }: ResourcePoolFormSheetProps) {
  const [pdfFile, setPdfFile] = React.useState<File | null>(null)
  const [pdfError, setPdfError] = React.useState<string | undefined>()
  const [isLoading, setIsLoading] = React.useState(false)
  const [extractedSkills, setExtractedSkills] = React.useState<string[]>([])
  const [profileId, setProfileId] = React.useState<string | null>(null)
  const [skillInput, setSkillInput] = React.useState('')
  const [savedName, setSavedName] = React.useState('')
  const [savedVerfuegbarAb, setSavedVerfuegbarAb] = React.useState<string | null>(null)
  const [savedEkTagesrate, setSavedEkTagesrate] = React.useState<number | null>(null)
  const [selectedAgenturId, setSelectedAgenturId] = React.useState('')
  const [extractionStep, setExtractionStep] = React.useState<'analyzing' | 'extracting' | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResourcePoolFormData>({
    resolver: zodResolver(resourcePoolSchema),
    defaultValues: {
      resourceName: '',
      availability: 40,
    },
  })

  const handleResetForm = () => {
    reset()
    setPdfFile(null)
    setPdfError(undefined)
    setExtractedSkills([])
    setProfileId(null)
    setSkillInput('')
    setSavedName('')
    setSavedVerfuegbarAb(null)
    setSavedEkTagesrate(null)
    setSelectedAgenturId('')
    setExtractionStep(null)
  }

  const handleAddSkill = () => {
    if (skillInput.trim() && !extractedSkills.includes(skillInput.trim())) {
      setExtractedSkills([...extractedSkills, skillInput.trim()])
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setExtractedSkills(extractedSkills.filter((s) => s !== skill))
  }

  async function onSubmit(data: ResourcePoolFormData) {
    if (!pdfFile) {
      setPdfError('Lebenslauf (PDF) ist erforderlich')
      return
    }
    if (isManagerOrAdmin && !selectedAgenturId) {
      toast.error('Bitte wählen Sie eine Agentur aus')
      return
    }

    setPdfError(undefined)
    setIsLoading(true)
    setExtractionStep('analyzing')

    try {
      const formData = new FormData()
      formData.append('candidate_name', data.resourceName)
      formData.append('availability', data.availability.toString())
      formData.append('file', pdfFile)
      formData.append('for_pool', 'true')
      if (isManagerOrAdmin && selectedAgenturId) {
        formData.append('agentur_id', selectedAgenturId)
      }

      // Switch to "extracting" step after a brief delay for visual feedback
      setTimeout(() => setExtractionStep('extracting'), 1000)

      const response = await fetch('/api/profiles', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Fehler beim Hochladen')
        setExtractionStep(null)
        return
      }

      const result = await response.json()
      setProfileId(result.profile?.id)
      setSavedName(data.resourceName)
      setSavedVerfuegbarAb(data.verfuegbar_ab ?? null)
      setSavedEkTagesrate(data.ek_tagesrate ?? null)
      const rawSkills = result.profile?.extracted_skills ?? []
      setExtractedSkills(
        rawSkills.map((s: { name: string } | string) =>
          typeof s === 'string' ? s : s.name
        )
      )
      setExtractionStep(null)
      toast.success('CV hochgeladen und Skills extrahiert!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler')
      setExtractionStep(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!savedName) return
    if (extractedSkills.length === 0) {
      toast.error('Mindestens ein Skill ist erforderlich – bitte manuell hinzufügen')
      return
    }
    setIsLoading(true)
    try {
      // Create ressource with extracted skills
      const res = await fetch('/api/ressourcen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: savedName,
          skills: extractedSkills,
          erfahrungslevel: 'Mid',
          verfuegbarkeit: savedVerfuegbarAb ? 'Verfügbar ab' : 'Jetzt verfügbar',
          verfuegbar_ab: savedVerfuegbarAb ?? null,
          ek_tagesrate: savedEkTagesrate ?? null,
          ...(isManagerOrAdmin && selectedAgenturId ? { agentur_id: selectedAgenturId } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Fehler beim Anlegen der Ressource')
      }
      const { ressource } = await res.json()

      // Upload CV to the new ressource
      if (pdfFile && ressource?.id) {
        const form = new FormData()
        form.append('cv', pdfFile)
        await fetch(`/api/ressourcen/${ressource.id}/cv`, {
          method: 'POST',
          body: form,
        })
      }

      toast.success('Ressource erfolgreich angelegt!')
      onOpenChange(false)
      handleResetForm()
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[500px] flex-col gap-0 overflow-hidden p-0 sm:w-[560px]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Ressource anlegen</SheetTitle>
          <SheetDescription>
            {!profileId ? 'Füllen Sie die Basisinformationen aus' : 'Überprüfen und editieren Sie die Skills'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {extractionStep ? (
            <ExtractionLoadingState step={extractionStep} />
          ) : !profileId ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {isManagerOrAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="agentur-select">Agentur <span className="text-destructive">*</span></Label>
                  <Select value={selectedAgenturId} onValueChange={setSelectedAgenturId} disabled={isLoading}>
                    <SelectTrigger id="agentur-select">
                      <SelectValue placeholder="Agentur auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agenturen.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="resource-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="resource-name"
                  placeholder="z.B. Max Mustermann"
                  {...register('resourceName')}
                  disabled={isLoading}
                />
                {errors.resourceName && <p className="text-xs text-destructive">{errors.resourceName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="availability">Kapazität (Std/Woche) <span className="text-destructive">*</span></Label>
                  <Input
                    id="availability"
                    type="number"
                    min="1"
                    max="168"
                    placeholder="z.B. 40"
                    {...register('availability', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                  {errors.availability && <p className="text-xs text-destructive">{errors.availability.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verfuegbar_ab">Verfügbar ab</Label>
                  <Input
                    id="verfuegbar_ab"
                    type="date"
                    {...register('verfuegbar_ab')}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ek_tagesrate">EK Tagesrate (€/Tag)</Label>
                <Input
                  id="ek_tagesrate"
                  type="number"
                  min="1"
                  placeholder="z.B. 600"
                  {...register('ek_tagesrate', { valueAsNumber: true })}
                  disabled={isLoading}
                />
                {errors.ek_tagesrate && <p className="text-xs text-destructive">{errors.ek_tagesrate.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-upload">Lebenslauf (PDF) <span className="text-destructive">*</span></Label>
                <FileDropzone value={pdfFile} onChange={setPdfFile} error={pdfError} />
                <p className="text-xs text-muted-foreground">Der Lebenslauf wird zur automatischen Skill-Erkennung verwendet.</p>
              </div>

              <div className="flex gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Automatische Skill-Erkennung</p>
                  <p className="text-xs">Die extrahierten Skills können Sie anschließend noch editieren.</p>
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  Wird hochgeladen...
                </> : 'Hochladen & Skills extrahieren'}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              {extractedSkills.length === 0 && (
                <div className="flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>Keine Skills erkannt. Bitte fügen Sie mindestens einen Skill manuell hinzu.</p>
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Extrahierte Skills</CardTitle>
                  <CardDescription>Überprüfen und bearbeiten Sie die erkannten Skills</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {extractedSkills.map((skill) => (
                      <div key={skill} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm">
                        <span>{skill}</span>
                        <button type="button" onClick={() => handleRemoveSkill(skill)} className="text-muted-foreground hover:text-foreground">
                          <IconX className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="skill-input">Skill hinzufügen</Label>
                    <div className="flex gap-2">
                      <Input
                        id="skill-input"
                        placeholder="z.B. React, TypeScript"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                      />
                      <Button type="button" variant="outline" onClick={handleAddSkill} disabled={!skillInput.trim()}>
                        Hinzufügen
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>Abbrechen</Button>
          </SheetClose>
          {profileId && (
            <Button type="button" disabled={isLoading} onClick={handleSaveProfile}>
              {isLoading ? <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Speichern...
              </> : 'Ressource speichern'}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
