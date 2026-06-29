import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateAgencyKey } from '@/lib/external-api-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const MAX_CV_BYTES = 5 * 1024 * 1024

const SENIORITY_MAP: Record<string, string> = {
  JUNIOR: 'Junior', MID: 'Mid', SENIOR: 'Senior', EXPERT: 'Expert',
}
const AVAILABILITY_MAP: Record<string, string> = {
  AVAILABLE_NOW: 'Jetzt verfügbar',
  AVAILABLE_FROM: 'Verfügbar ab',
  UNAVAILABLE: 'Nicht verfügbar',
}
const WORKMODEL_MAP: Record<string, string> = {
  REMOTE: 'Onshore', ONSITE: 'Onsite', HYBRID: 'Onshore',
  ONSHORE: 'Onshore', NEARSHORE: 'Nearshore', OFFSHORE: 'Offshore',
}

const profileUpsertedSchema = z.object({
  event: z.literal('profile.upserted'),
  externalRef: z.string().min(1).max(255),
  firstName: z.string().min(1).max(200),
  lastName: z.string().min(1).max(200),
  skills: z.array(z.string()).min(1).max(30),
  seniority: z.enum(['JUNIOR', 'MID', 'SENIOR', 'EXPERT']),
  availability: z.enum(['AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE']),
  availableFrom: z.string().nullable().optional(),
  workModel: z.enum(['REMOTE', 'ONSITE', 'HYBRID', 'ONSHORE', 'NEARSHORE', 'OFFSHORE']).optional(),
  location: z.string().max(200).nullable().optional(),
  cvBase64: z.string().nullable().optional(),
}).refine(
  (d) => d.availability !== 'AVAILABLE_FROM' || !!d.availableFrom,
  { message: 'availableFrom required when availability=AVAILABLE_FROM', path: ['availableFrom'] }
)

const profileDeactivatedSchema = z.object({
  event: z.literal('profile.deactivated'),
  externalRef: z.string().min(1).max(255),
})

const submissionCreatedSchema = z.object({
  event: z.literal('submission.created'),
  externalRef: z.string().min(1).max(255),
  positionId: z.string().uuid(),
})

const submissionWithdrawnSchema = z.object({
  event: z.literal('submission.withdrawn'),
  externalRef: z.string().min(1).max(255),
  positionId: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAgencyKey(request, 'agency:profiles:write')
  if (auth.error) return auth.error

  const { id: agenturId } = await params

  if (auth.agencyId !== agenturId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.event !== 'string') {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: { event: ['Required'] } },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  switch (body.event) {
    case 'profile.upserted': {
      const parsed = profileUpsertedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const d = parsed.data

      if (d.cvBase64) {
        const buf = Buffer.from(d.cvBase64, 'base64')
        if (buf.byteLength > MAX_CV_BYTES) {
          return NextResponse.json({ error: 'CV_TOO_LARGE', message: 'CV max 5 MB' }, { status: 413 })
        }
      }

      const payload = {
        name: `${d.firstName} ${d.lastName}`.trim(),
        vorname: d.firstName,
        nachname: d.lastName,
        skills: d.skills,
        erfahrungslevel: SENIORITY_MAP[d.seniority],
        verfuegbarkeit: AVAILABILITY_MAP[d.availability],
        verfuegbar_ab: d.availableFrom ?? null,
        arbeitsmodell: WORKMODEL_MAP[d.workModel ?? 'ONSHORE'] ?? 'Onshore',
        wohnort: d.location ?? null,
        agentur_id: agenturId,
        external_ref: d.externalRef,
      }

      const { data: existing } = await supabase
        .from('ressourcen')
        .select('id, cv_pfad')
        .eq('external_ref', d.externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      let ressourceId: string
      let created: boolean

      if (existing) {
        await supabase.from('ressourcen').update(payload).eq('id', existing.id)
        ressourceId = existing.id
        created = false
      } else {
        const { data: newR, error } = await supabase
          .from('ressourcen').insert(payload).select('id').single()
        if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
        ressourceId = newR.id
        created = true
      }

      if (d.cvBase64) {
        const buffer = Buffer.from(d.cvBase64, 'base64')
        if (existing?.cv_pfad) {
          await supabase.storage.from('ressourcen-cvs').remove([existing.cv_pfad])
        }
        const cvPfad = `${agenturId}/${ressourceId}.pdf`
        await supabase.storage
          .from('ressourcen-cvs')
          .upload(cvPfad, buffer, { contentType: 'application/pdf', upsert: true })
        await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', ressourceId)
      }

      return NextResponse.json({
        received: true,
        event: d.event,
        processed: { profileId: ressourceId, externalRef: d.externalRef, created },
      })
    }

    case 'profile.deactivated': {
      const parsed = profileDeactivatedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      const { data: ressource } = await supabase
        .from('ressourcen')
        .select('id')
        .eq('external_ref', parsed.data.externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      if (!ressource) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Profil nicht gefunden' }, { status: 404 })
      }

      await supabase.from('ressourcen').update({ verfuegbarkeit: 'Deaktiviert' }).eq('id', ressource.id)

      return NextResponse.json({ received: true, event: parsed.data.event, processed: { profileId: ressource.id } })
    }

    case 'submission.created': {
      const parsed = submissionCreatedSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const { externalRef, positionId } = parsed.data

      const { data: ressource } = await supabase
        .from('ressourcen')
        .select('id, verfuegbarkeit')
        .eq('external_ref', externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      if (!ressource) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Profil nicht gefunden' }, { status: 404 })
      }
      if (ressource.verfuegbarkeit === 'Deaktiviert') {
        return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 400 })
      }

      const { data: vakanz } = await supabase
        .from('vakanzen')
        .select('id, rolle, status, published')
        .eq('id', positionId)
        .maybeSingle()

      if (!vakanz || !vakanz.published) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Position nicht gefunden' }, { status: 404 })
      }
      if (vakanz.status === 'Besetzt' || vakanz.status === 'Geschlossen') {
        return NextResponse.json({ error: 'POSITION_CLOSED' }, { status: 400 })
      }

      const { data: link, error: insertError } = await supabase
        .from('ressource_vakanz_links')
        .insert({ ressource_id: ressource.id, vakanz_id: positionId, status: 'Gespielt', created_by: null })
        .select('id')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          return NextResponse.json({ error: 'ALREADY_SUBMITTED' }, { status: 409 })
        }
        return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
      }

      await supabase.from('ressource_historie').insert({
        ressource_id: ressource.id,
        link_id: link.id,
        typ: 'system',
        text: `Via Inbound-Webhook auf Position "${vakanz.rolle}" eingereicht`,
        erstellt_von: null,
      })

      return NextResponse.json({ received: true, event: parsed.data.event, processed: { submissionId: link.id } })
    }

    case 'submission.withdrawn': {
      const parsed = submissionWithdrawnSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const { externalRef, positionId } = parsed.data

      const { data: ressource } = await supabase
        .from('ressourcen')
        .select('id')
        .eq('external_ref', externalRef)
        .eq('agentur_id', agenturId)
        .maybeSingle()

      if (!ressource) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Profil nicht gefunden' }, { status: 404 })
      }

      const { data: link } = await supabase
        .from('ressource_vakanz_links')
        .select('id, status')
        .eq('ressource_id', ressource.id)
        .eq('vakanz_id', positionId)
        .maybeSingle()

      if (!link) {
        return NextResponse.json({ error: 'NOT_FOUND', message: 'Einreichung nicht gefunden' }, { status: 404 })
      }
      if (['Beauftragt', 'Abgesagt', 'Zurückgezogen'].includes(link.status)) {
        return NextResponse.json({ error: 'INVALID_STATUS', message: 'Einreichung kann nicht zurückgezogen werden' }, { status: 400 })
      }

      await supabase.from('ressource_vakanz_links').update({ status: 'Zurückgezogen' }).eq('id', link.id)

      return NextResponse.json({ received: true, event: parsed.data.event, processed: { submissionId: link.id } })
    }

    default:
      return NextResponse.json({ received: true, skipped: true })
  }
}
