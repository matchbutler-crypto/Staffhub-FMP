// src/app/api/external/v1/vakanzen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const createVakanzSchema = z.object({
  branche: z.string().min(1),
  kunde: z.string().nullable().optional(),
  rolle: z.string().min(1),
  beschreibung: z.string().min(1),
  skills: z.array(z.string()).min(1).max(20),
  skills_nice_have: z.array(z.string()).max(20).optional().default([]),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  startdatum: z.string().min(1),
  enddatum: z.string().min(1),
  teamgroesse: z.number().int().min(1).nullable().optional(),
  fte_anzahl: z.number().min(0.1),
  auslastung: z.number().int().min(1).max(100).optional().default(100),
  arbeitsmodell: z.enum(['Remote', 'Hybrid', 'Onsite']),
  onsite_anteil: z.number().int().min(0).max(100).nullable().optional(),
  ansprechpartner: z.string().nullable().optional(),
  standort: z.string().nullable().optional(),
  budget_intern: z.number().positive(),
  weitere_kommentare: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:read')
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen')
    .select('id, vakanz_nr, branche, kunde, rolle, status, published, published_at, startdatum, enddatum, fte_anzahl, arbeitsmodell, erfahrungslevel, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden der Vakanzen' }, { status: 500 })

  return NextResponse.json({ vakanzen: data ?? [] })
}

export async function POST(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'vakanzen:create')
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = createVakanzSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('vakanzen_data')
    .insert({
      ...parsed.data,
      skills_nice_have: parsed.data.skills_nice_have ?? [],
      status: 'Offen',
    })
    .select('id, vakanz_nr, rolle, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Erstellen der Vakanz' }, { status: 500 })

  return NextResponse.json({ vakanz: data }, { status: 201 })
}
