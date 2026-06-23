import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const STATUS_MAP: Record<string, string> = { closed: 'Geschlossen', open: 'Offen' }

const updateVakanzSchema = z.object({
  status: z.string().optional(),  // Akzeptiert Offen, Besetzt, Storniert, closed, open (siehe STATUS_MAP)
  beschreibung: z.string().min(1).optional(),
  budget_intern: z.number().positive().optional(),
  skills: z.array(z.string()).min(1).max(20).optional(),
  sourcing_erlaubt: z.boolean().optional(),
  // MagentaOS-Felder (demand:write)
  rolle: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  startdatum: z.string().optional(),
  startDate: z.string().optional(),
  enddatum: z.string().optional(),
  endDate: z.string().optional(),
}).refine(
  d => Object.values(d).some(v => v !== undefined),
  { message: 'Mindestens ein Feld muss angegeben werden' }
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:read')
  if (authError) return authError

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('vakanzen')
    .select('id, external_ref, vakanz_nr, branche, kunde, rolle, beschreibung, status, published, published_at, skills, skills_nice_have, erfahrungslevel, startdatum, enddatum, fte_anzahl, auslastung, arbeitsmodell, onsite_anteil, standort, ansprechpartner, budget_intern, weitere_kommentare, sourcing_erlaubt, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Dual-Permission-Check: vakanzen:update ODER demand:write
  const authError1 = await validateExternalApiKey(request, 'vakanzen:update')
  const authError2 = await validateExternalApiKey(request, 'demand:write')
  if (authError1 && authError2) return authError1  // beide fehlgeschlagen

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateVakanzSchema.safeParse(body ?? {})
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return NextResponse.json(
      { error: flat.formErrors[0] ?? 'Validierungsfehler', details: flat.fieldErrors },
      { status: 400 }
    )
  }

  const d = parsed.data
  const updatePayload: Record<string, unknown> = {}

  // Status-Mapping anwenden
  if (d.status !== undefined) {
    updatePayload.status = STATUS_MAP[d.status] ?? d.status
  }
  // MagentaOS-Felder mit Fallback auf Alt-Namen
  if (d.rolle ?? d.role) {
    updatePayload.rolle = d.rolle ?? d.role
  }
  if (d.beschreibung ?? d.description) {
    updatePayload.beschreibung = d.beschreibung ?? d.description
  }
  if (d.startdatum ?? d.startDate) {
    updatePayload.startdatum = d.startdatum ?? d.startDate
  }
  if (d.enddatum ?? d.endDate) {
    updatePayload.enddatum = d.enddatum ?? d.endDate
  }
  if (d.skills !== undefined) {
    updatePayload.skills = d.skills
  }
  if (d.budget_intern !== undefined) {
    updatePayload.budget_intern = d.budget_intern
  }
  if (d.sourcing_erlaubt !== undefined) {
    updatePayload.sourcing_erlaubt = d.sourcing_erlaubt
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .update(updatePayload)
    .eq('id', id)
    .select('id, vakanz_nr, rolle, status, published, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}
