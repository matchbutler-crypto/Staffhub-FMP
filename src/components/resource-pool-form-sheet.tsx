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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const resourcePoolSchema = z.object({
  resourceName: z.string().min(1, 'Name ist erforderlich').max(200),
  availability: z.number().min(1, 'Verfügbarkeit muss mindestens 1 sein').max(168, 'Max 168 Stunden/Woche'),
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
}

export function ResourcePoolFormSheet({ open, onOpenChange, onSuccess }: ResourcePoolFormSheetProps) {
  const [pdfFile, setPdfFile] = React.useState<File | null>(null)
  const [pdfError, setPdfError] = React.useState<string | undefined>()
  const [isLoading, setIsLoading] = React.useState(false)
  const [extractedSkills, setExtractedSkills] = React.useState<string[]>([])
  const [profileId, setProfileId] = React.useState<string | null>(null)
  const [skillInput, setSkillInput] = React.useState('')
  const [savedName, setSavedName] = React.useState('')

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

    setPdfError(undefined)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('candidate_name', data.resourceName)
      formData.append('availability', data.availability.toString())
      formData.append('file', pdfFile)
      formData.append('for_pool', 'true')

      const response = await fetch('/api/profiles', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Fehler beim Hochladen')
        return
      }

      const result = await response.json()
      setProfileId(result.profile?.id)
      setSavedName(data.resourceName)
      const rawSkills = result.profile?.extracted_skills ?? []
      setExtractedSkills(
        rawSkills.map((s: { name: string } | string) =>
          typeof s === 'string' ? s : s.name
        )
      )
      toast.success('CV hochgeladen und Skills extrahiert!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!savedName) return
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
          verfuegbarkeit: 'Jetzt verfügbar',
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
          {!profileId ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

              <div className="space-y-2">
                <Label htmlFor="availability">Verfügbarkeit (Stunden/Woche) <span className="text-destructive">*</span></Label>
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
