'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { BRANCHEN, ERFAHRUNGSLEVEL, ARBEITSMODELL, VAKANZ_STATUS } from '@/lib/constants'
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

export interface VakanzForForm {
  id: string
  branche: string
  kunde?: string | null
  rolle: string
  beschreibung: string
  skills: string[]
  skills_nice_have?: string[]
  erfahrungslevel: string
  startdatum: string
  enddatum?: string | null
  teamgroesse?: number | null
  fte_anzahl: number
  auslastung: number
  arbeitsmodell: string
  onsite_anteil?: number | null
  ansprechpartner?: string | null
  status: string
  standort?: string | null
  budget_intern?: number | null
  weitere_kommentare?: string | null
}

// ── Schema ─────────────────────────────────────────────────────────────────────

export const vakanzSchema = z.object({
  branche: z.string().min(1, 'Branche ist erforderlich'),
  kunde: z.string().optional(),
  rolle: z.string().min(1, 'Benötigte Rolle ist erforderlich'),
  beschreibung: z.string().min(1, 'Projektkontext ist erforderlich'),
  skills: z.array(z.string()).min(1, 'Mindestens ein Must-Have Skill erforderlich'),
  skills_nice_have: z.array(z.string()).optional().default([]),
  erfahrungslevel: z.enum(ERFAHRUNGSLEVEL, { required_error: 'Erfahrungslevel ist erforderlich' }),
  startdatum: z.string().min(1, 'Geplanter Projektstart ist erforderlich'),
  enddatum: z.string().min(1, 'Projektende ist erforderlich'),
  teamgroesse: z.number().int().min(1).nullable().optional(),
  fte_anzahl: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).min(0.1, 'Mindestens 0.1 FTE'),
  auslastung: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).min(1).max(100).optional().default(100),
  arbeitsmodell: z.enum(ARBEITSMODELL, { required_error: 'Arbeitsmodell ist erforderlich' }),
  onsite_anteil: z.number().int().min(0).max(100).nullable().optional(),
  ansprechpartner: z.string().optional(),
  status: z.enum(VAKANZ_STATUS).optional(),
  standort: z.string().optional(),
  budget_intern: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).positive('EK Tagesrate ist erforderlich'),
  weitere_kommentare: z.string().optional(),
})

export type VakanzFormData = z.infer<typeof vakanzSchema>

// ── Component ──────────────────────────────────────────────────────────────────

interface VakanzFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  vakanz?: VakanzForForm | null
  showBudget: boolean
  onSuccess: () => void
}

export function VakanzFormSheet({ open, onOpenChange, mode, vakanz, showBudget, onSuccess }: VakanzFormSheetProps) {
  const [saving, setSaving] = React.useState(false)
  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<VakanzFormData>({
    resolver: zodResolver(vakanzSchema),
    defaultValues: {
      branche: '', kunde: '', rolle: '', beschreibung: '', skills: [], skills_nice_have: [],
      erfahrungslevel: undefined, startdatum: '', enddatum: '', teamgroesse: null,
      fte_anzahl: 1, auslastung: 100, arbeitsmodell: undefined, onsite_anteil: null,
      ansprechpartner: '', status: 'Offen', standort: '', budget_intern: undefined, weitere_kommentare: '',
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && vakanz) {
      reset({
        branche: vakanz.branche, kunde: vakanz.kunde ?? '', rolle: vakanz.rolle,
        beschreibung: vakanz.beschreibung, skills: vakanz.skills,
        skills_nice_have: vakanz.skills_nice_have ?? [], erfahrungslevel: vakanz.erfahrungslevel as typeof ERFAHRUNGSLEVEL[number],
        startdatum: vakanz.startdatum, enddatum: vakanz.enddatum ?? '',
        teamgroesse: vakanz.teamgroesse ?? null, fte_anzahl: vakanz.fte_anzahl,
        auslastung: vakanz.auslastung, arbeitsmodell: vakanz.arbeitsmodell as typeof ARBEITSMODELL[number],
        onsite_anteil: vakanz.onsite_anteil ?? null, ansprechpartner: vakanz.ansprechpartner ?? '',
        status: (vakanz.status as typeof VAKANZ_STATUS[number]) ?? 'Offen', standort: vakanz.standort ?? '',
        budget_intern: vakanz.budget_intern ?? undefined, weitere_kommentare: vakanz.weitere_kommentare ?? '',
      })
    } else {
      reset({
        branche: '', kunde: '', rolle: '', beschreibung: '', skills: [], skills_nice_have: [],
        erfahrungslevel: undefined, startdatum: '', enddatum: '', teamgroesse: null,
        fte_anzahl: 1, auslastung: 100, arbeitsmodell: undefined, onsite_anteil: null,
        ansprechpartner: '', status: 'Offen', standort: '', budget_intern: undefined, weitere_kommentare: '',
      })
    }
  }, [open, mode, vakanz, reset])

  async function onSubmit(data: VakanzFormData) {
    setSaving(true)
    try {
      const url = mode === 'create' ? '/api/vakanzen' : `/api/vakanzen/${vakanz!.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const body: Record<string, unknown> = {
        branche: data.branche, kunde: data.kunde || null, rolle: data.rolle,
        beschreibung: data.beschreibung, skills: data.skills,
        skills_nice_have: data.skills_nice_have ?? [], erfahrungslevel: data.erfahrungslevel,
        startdatum: data.startdatum, enddatum: data.enddatum,
        teamgroesse: data.teamgroesse ?? null, fte_anzahl: data.fte_anzahl,
        auslastung: data.auslastung ?? 100, arbeitsmodell: data.arbeitsmodell,
        onsite_anteil: data.arbeitsmodell === 'Hybrid' ? (data.onsite_anteil ?? null) : null,
        ansprechpartner: data.ansprechpartner || null, standort: data.standort || null,
        budget_intern: data.budget_intern, weitere_kommentare: data.weitere_kommentare || null,
      }
      if (mode === 'edit') body.status = data.status
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Unbekannter Fehler')
      }
      toast.success(mode === 'create' ? 'Vakanz erstellt' : 'Vakanz aktualisiert')
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(`Fehler beim Speichern.${err instanceof Error ? ` (${err.message})` : ''}`)
    } finally {
      setSaving(false)
    }
  }

  const watchedArbeitsmodell = watch('arbeitsmodell')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[500px] flex-col gap-0 overflow-hidden p-0 sm:w-[560px]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{mode === 'create' ? 'Neue Vakanz erstellen' : 'Vakanz bearbeiten'}</SheetTitle>
          <SheetDescription>{mode === 'create' ? 'Füllen Sie alle Pflichtfelder aus.' : 'Bearbeiten Sie die Vakanz-Details.'}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-rolle">Benötigte Rolle <span className="text-destructive">*</span></Label>
                <Input id="v-rolle" placeholder="z.B. Senior Frontend Engineer" {...register('rolle')} className={errors.rolle ? 'border-destructive' : ''} />
                {errors.rolle && <p className="text-xs text-destructive">{errors.rolle.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-beschreibung">Projektkontext <span className="text-destructive">*</span></Label>
                <Textarea id="v-beschreibung" placeholder="Kontext, Aufgaben, Anforderungen..." className={`min-h-[90px] ${errors.beschreibung ? 'border-destructive' : ''}`} {...register('beschreibung')} />
                {errors.beschreibung && <p className="text-xs text-destructive">{errors.beschreibung.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-branche">Branche <span className="text-destructive">*</span></Label>
                  <Controller control={control} name="branche" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="v-branche" className={errors.branche ? 'border-destructive' : ''}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>{BRANCHEN.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                  {errors.branche && <p className="text-xs text-destructive">{errors.branche.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-kunde">Kunde</Label>
                  <Input id="v-kunde" placeholder="optional" {...register('kunde')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-start">Geplanter Projektstart <span className="text-destructive">*</span></Label>
                  <Input id="v-start" type="date" {...register('startdatum')} className={errors.startdatum ? 'border-destructive' : ''} />
                  {errors.startdatum && <p className="text-xs text-destructive">{errors.startdatum.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-enddatum">Projektende <span className="text-destructive">*</span></Label>
                  <Input id="v-enddatum" type="date" {...register('enddatum')} className={errors.enddatum ? 'border-destructive' : ''} />
                  {errors.enddatum && <p className="text-xs text-destructive">{errors.enddatum.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-team">Teamgröße</Label>
                  <Input id="v-team" type="number" min={1} placeholder="optional" {...register('teamgroesse', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-fte">Erf. FTE Anzahl <span className="text-destructive">*</span></Label>
                  <Input id="v-fte" type="number" min={0.1} step={0.1} placeholder="z.B. 1" {...register('fte_anzahl', { valueAsNumber: true })} className={errors.fte_anzahl ? 'border-destructive' : ''} />
                  {errors.fte_anzahl && <p className="text-xs text-destructive">{errors.fte_anzahl.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-level">Erfahrungslevel <span className="text-destructive">*</span></Label>
                  <Controller control={control} name="erfahrungslevel" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="v-level" className={errors.erfahrungslevel ? 'border-destructive' : ''}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Junior">Junior</SelectItem>
                        <SelectItem value="Mid">Mid</SelectItem>
                        <SelectItem value="Senior">Senior</SelectItem>
                        <SelectItem value="Expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.erfahrungslevel && <p className="text-xs text-destructive">{errors.erfahrungslevel.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-modell">Arbeitsmodell <span className="text-destructive">*</span></Label>
                  <Controller control={control} name="arbeitsmodell" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="v-modell" className={errors.arbeitsmodell ? 'border-destructive' : ''}><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Remote">Remote</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                        <SelectItem value="Onsite">Onsite</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.arbeitsmodell && <p className="text-xs text-destructive">{errors.arbeitsmodell.message}</p>}
                </div>
              </div>
              {watchedArbeitsmodell === 'Hybrid' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-onsite">Onsite-Anteil (%)</Label>
                  <Input id="v-onsite" type="number" min={0} max={100} step={5} placeholder="z.B. 40" {...register('onsite_anteil', { valueAsNumber: true })} className={errors.onsite_anteil ? 'border-destructive' : ''} />
                  {errors.onsite_anteil && <p className="text-xs text-destructive">{errors.onsite_anteil.message}</p>}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Skills (Must Have) <span className="text-destructive">*</span></Label>
                <Controller control={control} name="skills" render={({ field }) => (
                  <TagInput value={field.value} onChange={field.onChange} error={errors.skills?.message} />
                )} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Skills (Nice Have)</Label>
                <Controller control={control} name="skills_nice_have" render={({ field }) => (
                  <TagInput value={field.value ?? []} onChange={field.onChange} />
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {showBudget && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="v-budget">EK Tagesrate (€/Tag) <span className="text-destructive">*</span></Label>
                    <Input id="v-budget" type="number" min={1} placeholder="z.B. 800" {...register('budget_intern', { valueAsNumber: true })} className={errors.budget_intern ? 'border-destructive' : ''} />
                    {errors.budget_intern && <p className="text-xs text-destructive">{errors.budget_intern.message}</p>}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-standort">Sourcing Region</Label>
                  <Input id="v-standort" placeholder="z.B. Deutschland" {...register('standort')} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-ansprech">Ansprechpartner</Label>
                <Input id="v-ansprech" placeholder="optional" {...register('ansprechpartner')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-kommentare">Weitere Kommentare</Label>
                <Textarea id="v-kommentare" placeholder="optional" className="min-h-[70px]" {...register('weitere_kommentare')} />
              </div>
              {mode === 'edit' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-status">Status</Label>
                  <Controller control={control} name="status" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="v-status"><SelectValue placeholder="Status wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Offen">Offen</SelectItem>
                        <SelectItem value="In Auswahl">In Auswahl</SelectItem>
                        <SelectItem value="Besetzt">Besetzt</SelectItem>
                        <SelectItem value="Pausiert">Pausiert</SelectItem>
                        <SelectItem value="Geschlossen">Geschlossen</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              )}
            </div>
          </div>
          <SheetFooter className="border-t px-6 py-4">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={saving}>Abbrechen</Button>
            </SheetClose>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern…' : mode === 'create' ? 'Vakanz erstellen' : 'Änderungen speichern'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
