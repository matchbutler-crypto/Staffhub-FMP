import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const MAX_CV_BYTES = 5 * 1024 * 1024 // 5 MB decoded

const AVAILABILITY_MAP: Record<string, string> = {
  AVAILABLE_NOW: 'Jetzt verfügbar',
  AVAILABLE_FROM: 'Verfügbar ab',
  UNAVAILABLE: 'Nicht verfügbar',
}

const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior', MID: 'Mid', SENIOR: 'Senior', EXPERT: 'Expert',
}

const WORKMODEL_MAP: Record<string, string> = {
  REMOTE: 'Onshore', ONSITE: 'Onsite', HYBRID: 'Onshore',
  ONSHORE: 'Onshore', NEARSHORE: 'Nearshore', OFFSHORE: 'Offshore',
}

const profileSchema = z.object({
  externalRef:   z.string().min(1).max(255),
  firstName:     z.string().min(1).max(200),
  lastName:      z.string().min(1).max(200),
  skills:        z.array(z.string()).min(1).max(30),
  seniority:     z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']),
  availability:  z.enum(['AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE']),
  availableFrom: z.string().nullable().optional(),
  workModel:     z.enum(['REMOTE', 'ONSITE', 'HYBRID', 'ONSHORE', 'NEARSHORE', 'OFFSHORE']).optional(),
  location:      z.string().max(200).nullable().optional(),
  cvBase64:      z.string().nullable().optional(),
}).refine(
  (d) => d.availability !== 'AVAILABLE_FROM' || !!d.availableFrom,
  { message: 'availableFrom erforderlich wenn availability=AVAILABLE_FROM', path: ['availableFrom'] }
)

export async function POST(request: NextRequest) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    )
  }

  const d = parsed.data

  // Fix 3: CV size check BEFORE any DB write
  if (d.cvBase64) {
    const cvBuffer = Buffer.from(d.cvBase64, 'base64')
    if (cvBuffer.byteLength > MAX_CV_BYTES) {
      return NextResponse.json({ error: { code: 'CV_TOO_LARGE', message: 'CV darf max. 5 MB groß sein' } }, { status: 413 })
    }
  }

  const supabase = createServiceRoleClient()
  const name = `${d.firstName} ${d.lastName}`.trim()

  // Upsert via externalRef + agentur_id
  const { data: existing } = await supabase
    .from('ressourcen')
    .select('id, cv_pfad')
    .eq('external_ref', d.externalRef)
    .eq('agentur_id', auth.agencyId)
    .maybeSingle()

  const ressourcePayload = {
    name,
    vorname: d.firstName,
    nachname: d.lastName,
    skills: d.skills,
    erfahrungslevel: SENIORITY_MAP[d.seniority],
    verfuegbarkeit: AVAILABILITY_MAP[d.availability],
    verfuegbar_ab: d.availableFrom ?? null,
    arbeitsmodell: WORKMODEL_MAP[d.workModel ?? 'ONSHORE'] ?? 'Onshore',
    wohnort: d.location ?? null,
    agentur_id: auth.agencyId,
    external_ref: d.externalRef,
  }

  let ressourceId: string
  let created: boolean

  if (existing) {
    const { error } = await supabase
      .from('ressourcen')
      .update(ressourcePayload)
      .eq('id', existing.id)
    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
    }
    ressourceId = existing.id
    created = false
  } else {
    const { data: newRessource, error } = await supabase
      .from('ressourcen')
      .insert(ressourcePayload)
      .select('id')
      .single()
    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Anlegen' } }, { status: 500 })
    }
    ressourceId = newRessource.id
    created = true
  }

  // CV hochladen wenn vorhanden (size already checked above)
  if (d.cvBase64) {
    const buffer = Buffer.from(d.cvBase64, 'base64')

    // Altes CV entfernen wenn vorhanden
    if (existing?.cv_pfad) {
      await supabase.storage.from('ressourcen-cvs').remove([existing.cv_pfad])
    }

    const cvPfad = `${auth.agencyId}/${ressourceId}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('ressourcen-cvs')
      .upload(cvPfad, buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('CV upload error:', uploadError)
    } else {
      await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', ressourceId)
    }
  }

  return NextResponse.json({ profileId: ressourceId, externalRef: d.externalRef, created }, { status: created ? 201 : 200 })
}

export async function GET(request: NextRequest) {
  const auth = await validateAgencyKey(request, 'agency:profiles:read')
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200)
  const cursor = searchParams.get('cursor')

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('ressourcen')
    .select('id, external_ref, name, skills, erfahrungslevel, verfuegbarkeit, verfuegbar_ab, arbeitsmodell, wohnort, created_at')
    .eq('agentur_id', auth.agencyId)
    .neq('verfuegbarkeit', 'Deaktiviert')
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden' } }, { status: 500 })
  }

  const hasMore = (data ?? []).length > limit
  const rows = hasMore ? data!.slice(0, limit) : (data ?? [])

  const SENIORITY_OUT: Record<string, string> = {
    Junior: 'JUNIOR', Mid: 'MID', Senior: 'SENIOR', Expert: 'EXPERT',
  }

  const AVAILABILITY_OUT: Record<string, string> = {
    'Jetzt verfügbar': 'AVAILABLE_NOW',
    'Verfügbar ab': 'AVAILABLE_FROM',
    'Nicht verfügbar': 'UNAVAILABLE',
  }

  const WORKMODEL_OUT: Record<string, string> = {
    Onshore: 'ONSHORE', Nearshore: 'NEARSHORE', Offshore: 'OFFSHORE', Onsite: 'ONSITE', Hybrid: 'HYBRID',
  }

  const profiles = rows.map((r) => ({
    profileId: r.id,
    externalRef: r.external_ref ?? null,
    name: r.name,
    skills: r.skills ?? [],
    seniority: SENIORITY_OUT[r.erfahrungslevel ?? ''] ?? r.erfahrungslevel,
    availability: AVAILABILITY_OUT[r.verfuegbarkeit ?? ''] ?? r.verfuegbarkeit,
    availableFrom: r.verfuegbar_ab ?? null,
    workModel: WORKMODEL_OUT[r.arbeitsmodell ?? ''] ?? r.arbeitsmodell ?? null,
    location: r.wohnort ?? null,
  }))

  return NextResponse.json({ data: profiles, nextCursor: hasMore ? rows[rows.length - 1]?.created_at ?? null : null })
}
