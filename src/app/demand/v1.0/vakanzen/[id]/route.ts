import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const updateVakanzSchema = z.object({
  status: z.enum(['Offen', 'Besetzt', 'Storniert']).optional(),
  beschreibung: z.string().min(1).optional(),
  budget_intern: z.number().positive().optional(),
  skills: z.array(z.string()).min(1).max(20).optional(),
  sourcing_erlaubt: z.boolean().optional(),
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
  const authError = await validateExternalApiKey(request, 'vakanzen:update')
  if (authError) return authError

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

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .update(parsed.data)
    .eq('id', id)
    .select('id, vakanz_nr, rolle, status, published, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ vakanz: data })
}
