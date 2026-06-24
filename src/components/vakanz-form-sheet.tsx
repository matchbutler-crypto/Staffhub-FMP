'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Sparkles, X, Loader2, CheckCircle2 } from 'lucide-react'

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ParsedVakanz } from '@/lib/openai'

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

// ── KI Sub-components ──────────────────────────────────────────────────────────

type KiState = 'idle' | 'open' | 'loading' | 'done'

function KiIdleButton({ onClick }: { onClick: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="ki-idle-btn group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-lg border border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50/70 px-3.5 py-2 text-xs font-semibold text-amber-700 shadow-sm transition-all hover:border-amber-400/70 hover:shadow-md hover:shadow-amber-100/80 active:scale-[0.97]"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:rotate-12" />
        Mit KI ausfüllen
      </button>
      <style>{`
        @keyframes ki-idle-shimmer {
          0% { transform: translateX(-120%) skewX(-15deg); }
          100% { transform: translateX(400%) skewX(-15deg); }
        }
        .ki-idle-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 25%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: ki-idle-shimmer 3.5s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>
    </>
  )
}

function KiDoneBadge({ count, onReset }: { count: number; onReset: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        {count} Felder ausgefüllt
      </div>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700"
      >
        Erneut versuchen
      </button>
    </div>
  )
}

function KiExpandedPanel({
  text, setText, isLoading, onSubmit, onClose,
}: {
  text: string
  setText: (v: string) => void
  isLoading: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="ki-panel relative mt-4 overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950 shadow-2xl shadow-black/30">
      <div className="ki-top-glow absolute inset-x-0 top-0 h-[1.5px]" />

      <div className="px-4 pt-4 pb-3.5">
        {/* Panel header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 ring-1 ring-amber-500/25">
              {isLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                : <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              }
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400/80">
              KI-Assistent
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800/80 hover:text-zinc-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body: loading scan or textarea */}
        {isLoading ? (
          <div className="flex h-[96px] items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900/60">
            <div className="flex flex-col items-center gap-3">
              <div className="ki-scan-track h-[2px] w-40 overflow-hidden rounded-full bg-zinc-800">
                <div className="ki-scan-fill h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              </div>
              <p className="text-[11px] font-medium tracking-wide text-zinc-500">
                Vakanz wird analysiert…
              </p>
            </div>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Stellenbeschreibung, Ausschreibungstext oder Anforderungsdetails hier einfügen…"
            className="w-full resize-none rounded-lg border border-zinc-700/60 bg-zinc-900 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
            rows={4}
            autoFocus
          />
        )}

        {/* Footer */}
        {!isLoading && (
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] tabular-nums text-zinc-600">
              {text.length.toLocaleString()} Zeichen · GPT-4o mini
            </span>
            <button
              type="button"
              onClick={onSubmit}
              disabled={text.trim().length < 20}
              className="ki-submit-btn flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white transition-all disabled:pointer-events-none disabled:opacity-30"
            >
              <Sparkles className="h-3 w-3" />
              Formular ausfüllen
            </button>
          </div>
        )}
      </div>

      <style>{`
        .ki-top-glow {
          background: linear-gradient(90deg, transparent 0%, #d97706 20%, #fbbf24 50%, #d97706 80%, transparent 100%);
          background-size: 200% 100%;
          animation: ki-sweep 2s linear infinite;
        }
        @keyframes ki-sweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .ki-submit-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
          box-shadow: 0 0 14px rgba(245,158,11,0.35), 0 1px 4px rgba(0,0,0,0.4);
        }
        .ki-submit-btn:hover:not(:disabled) {
          box-shadow: 0 0 22px rgba(245,158,11,0.55), 0 2px 8px rgba(0,0,0,0.4);
          transform: translateY(-1px);
        }
        .ki-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .ki-scan-fill {
          width: 55%;
          animation: ki-scan 1.4s ease-in-out infinite;
        }
        @keyframes ki-scan {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

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
  const [kiState, setKiState] = React.useState<KiState>('idle')
  const [kiText, setKiText] = React.useState('')
  const [kiFilledCount, setKiFilledCount] = React.useState(0)

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<VakanzFormData>({
    resolver: zodResolver(vakanzSchema),
    defaultValues: {
      branche: '', kunde: '', rolle: '', beschreibung: '', skills: [], skills_nice_have: [],
      erfahrungslevel: undefined, startdatum: '', enddatum: '', teamgroesse: null,
      fte_anzahl: 1, auslastung: 100, arbeitsmodell: undefined, onsite_anteil: null,
      ansprechpartner: '', status: 'Offen', standort: '', budget_intern: undefined, weitere_kommentare: '',
    },
  })

  React.useEffect(() => {
    if (!open) {
      setKiState('idle')
      setKiText('')
      return
    }
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

  function handleKiFill(data: ParsedVakanz) {
    if (data.rolle) setValue('rolle', data.rolle)
    if (data.beschreibung) setValue('beschreibung', data.beschreibung)
    if (data.skills?.length) setValue('skills', data.skills)
    if (data.skills_nice_have?.length) setValue('skills_nice_have', data.skills_nice_have)
    if (data.erfahrungslevel) setValue('erfahrungslevel', data.erfahrungslevel)
    if (data.startdatum) setValue('startdatum', data.startdatum)
    if (data.enddatum) setValue('enddatum', data.enddatum)
    if (data.arbeitsmodell) setValue('arbeitsmodell', data.arbeitsmodell)
    if (data.onsite_anteil !== null) setValue('onsite_anteil', data.onsite_anteil)
    if (data.standort) setValue('standort', data.standort)
    if (data.branche) setValue('branche', data.branche)
    if (data.auslastung !== null) setValue('auslastung', data.auslastung)
    if (data.fte_anzahl !== null) setValue('fte_anzahl', data.fte_anzahl)
    if (data.teamgroesse !== null) setValue('teamgroesse', data.teamgroesse)
    if (data.kunde) setValue('kunde', data.kunde)
    if (data.ansprechpartner) setValue('ansprechpartner', data.ansprechpartner)
  }

  async function handleKiParse() {
    if (!kiText.trim()) return
    setKiState('loading')
    try {
      const res = await fetch('/api/ai/parse-vacancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: kiText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fehler')
      const data: ParsedVakanz = json.vakanz
      const filled = Object.values(data).filter(
        (v) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
      ).length
      setKiFilledCount(filled)
      handleKiFill(data)
      setKiState('done')
    } catch (err) {
      toast.error(`KI-Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`)
      setKiState('open')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="text-lg">
                {mode === 'create' ? 'Neue Vakanz erstellen' : 'Vakanz bearbeiten'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {mode === 'create' ? 'Füllen Sie alle Pflichtfelder aus.' : 'Bearbeiten Sie die Vakanz-Details.'}
              </DialogDescription>
            </div>
            {mode === 'create' && kiState === 'idle' && (
              <div className="shrink-0 pt-0.5">
                <KiIdleButton onClick={() => setKiState('open')} />
              </div>
            )}
            {mode === 'create' && kiState === 'done' && (
              <div className="shrink-0 pt-0.5">
                <KiDoneBadge
                  count={kiFilledCount}
                  onReset={() => { setKiState('open'); setKiText('') }}
                />
              </div>
            )}
          </div>
          {mode === 'create' && (kiState === 'open' || kiState === 'loading') && (
            <KiExpandedPanel
              text={kiText}
              setText={setKiText}
              isLoading={kiState === 'loading'}
              onSubmit={handleKiParse}
              onClose={() => { setKiState('idle'); setKiText('') }}
            />
          )}
        </DialogHeader>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-4">

              {/* Row 1: Rolle */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-rolle">Benötigte Rolle <span className="text-destructive">*</span></Label>
                <Input id="v-rolle" placeholder="z.B. Senior Frontend Engineer" {...register('rolle')} className={errors.rolle ? 'border-destructive' : ''} />
                {errors.rolle && <p className="text-xs text-destructive">{errors.rolle.message}</p>}
              </div>

              {/* Row 2: Projektkontext */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-beschreibung">Projektkontext <span className="text-destructive">*</span></Label>
                <Textarea id="v-beschreibung" placeholder="Kontext, Aufgaben, Anforderungen..." className={`min-h-[90px] ${errors.beschreibung ? 'border-destructive' : ''}`} {...register('beschreibung')} />
                {errors.beschreibung && <p className="text-xs text-destructive">{errors.beschreibung.message}</p>}
              </div>

              {/* Row 3: Branche + Kunde */}
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

              {/* Row 4: Daten */}
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

              {/* Row 5: Team + FTE */}
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

              {/* Row 6: Level + Arbeitsmodell */}
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

              {/* Conditional: Onsite-Anteil */}
              {watchedArbeitsmodell === 'Hybrid' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-onsite">Onsite-Anteil (%)</Label>
                  <Input id="v-onsite" type="number" min={0} max={100} step={5} placeholder="z.B. 40" {...register('onsite_anteil', { valueAsNumber: true })} className={errors.onsite_anteil ? 'border-destructive' : ''} />
                  {errors.onsite_anteil && <p className="text-xs text-destructive">{errors.onsite_anteil.message}</p>}
                </div>
              )}

              {/* Row 7: Skills Must Have */}
              <div className="flex flex-col gap-1.5">
                <Label>Skills (Must Have) <span className="text-destructive">*</span></Label>
                <Controller control={control} name="skills" render={({ field }) => (
                  <TagInput value={field.value} onChange={field.onChange} error={errors.skills?.message} />
                )} />
              </div>

              {/* Row 8: Skills Nice Have */}
              <div className="flex flex-col gap-1.5">
                <Label>Skills (Nice Have)</Label>
                <Controller control={control} name="skills_nice_have" render={({ field }) => (
                  <TagInput value={field.value ?? []} onChange={field.onChange} />
                )} />
              </div>

              {/* Row 9: Budget + Region */}
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

              {/* Row 10: Ansprechpartner */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-ansprech">Ansprechpartner</Label>
                <Input id="v-ansprech" placeholder="optional" {...register('ansprechpartner')} />
              </div>

              {/* Row 11: Kommentare */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-kommentare">Weitere Kommentare</Label>
                <Textarea id="v-kommentare" placeholder="optional" className="min-h-[70px]" {...register('weitere_kommentare')} />
              </div>

              {/* Edit-only: Status */}
              {mode === 'edit' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-status">Status</Label>
                  <Controller control={control} name="status" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="v-status"><SelectValue placeholder="Status wählen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Offen">Offen</SelectItem>
                        <SelectItem value="In Auswahl">In Auswahl</SelectItem>
                        <SelectItem value="Ausreichend Profile">Ausreichend Profile</SelectItem>
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

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern…' : mode === 'create' ? 'Vakanz erstellen' : 'Änderungen speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
