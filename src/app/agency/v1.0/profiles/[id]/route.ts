import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateAgencyKey } from '@/lib/external-api-auth'

const MAX_CV_BYTES = 5 * 1024 * 1024

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

const updateSchema = z.object({
  firstName:     z.string().min(1).max(200).optional(),
  lastName:      z.string().min(1).max(200).optional(),
  skills:        z.array(z.string()).min(1).max(30).optional(),
  seniority:     z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']).optional(),
  availability:  z.enum(['AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE']).optional(),
  availableFrom: z.string().nullable().optional(),
  workModel:     z.enum(['REMOTE', 'ONSITE', 'HYBRID', 'ONSHORE', 'NEARSHORE', 'OFFSHORE']).optional(),
  location:      z.string().max(200).nullable().optional(),
  cvBase64:      z.string().nullable().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const { id } = await params
  const supabase = createServiceRoleClient()

  // Ownership prüfen
  const { data: existing } = await supabase
    .from('ressourcen')
    .select('id, cv_pfad, agentur_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil nicht gefunden' } }, { status: 404 })
  }
  if (existing.agentur_id !== auth.agencyId) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Keine Berechtigung' } }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    )
  }

  const d = parsed.data

  // CV size check BEFORE DB write
  let cvBuffer: Buffer | null = null
  if (d.cvBase64) {
    const buffer = Buffer.from(d.cvBase64, 'base64')
    if (buffer.byteLength > MAX_CV_BYTES) {
      return NextResponse.json({ error: { code: 'CV_TOO_LARGE', message: 'CV darf max. 5 MB groß sein' } }, { status: 413 })
    }
    cvBuffer = buffer
  }

  const updates: Record<string, unknown> = {}

  if (d.firstName !== undefined || d.lastName !== undefined) {
    const { data: cur, error: curError } = await supabase.from('ressourcen').select('vorname, nachname').eq('id', id).single()
    if (curError || !cur) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Profil nicht gefunden' } }, { status: 404 })
    }
    const fn = d.firstName ?? cur.vorname ?? ''
    const ln = d.lastName ?? cur.nachname ?? ''
    updates.vorname = fn
    updates.nachname = ln
    updates.name = `${fn} ${ln}`.trim()
  }
  if (d.skills !== undefined)        updates.skills = d.skills
  if (d.seniority !== undefined)     updates.erfahrungslevel = SENIORITY_MAP[d.seniority]
  if (d.availability !== undefined)  updates.verfuegbarkeit = AVAILABILITY_MAP[d.availability]
  if (d.availableFrom !== undefined) updates.verfuegbar_ab = d.availableFrom
  if (d.workModel !== undefined)     updates.arbeitsmodell = WORKMODEL_MAP[d.workModel]
  if (d.location !== undefined)      updates.wohnort = d.location

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('ressourcen').update(updates).eq('id', id)
    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Aktualisieren' } }, { status: 500 })
    }
  }

  if (cvBuffer) {
    if (existing.cv_pfad) {
      await supabase.storage.from('ressourcen-cvs').remove([existing.cv_pfad])
    }
    const cvPfad = `${auth.agencyId}/${id}.pdf`
    await supabase.storage.from('ressourcen-cvs').upload(cvPfad, cvBuffer, { contentType: 'application/pdf', upsert: true })
    await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', id)
  }

  return NextResponse.json({ profileId: id })
}
