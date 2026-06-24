import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'
import { sendPositionPublished } from '@/lib/agency-webhook'

const publishSchema = z.object({ published: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:update')
  if (authError) return authError

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (parsed.data.published === true) {
    const { data: vakanz, error: statusError } = await supabase
      .from('vakanzen_data')
      .select('status')
      .eq('id', id)
      .single()

    if (statusError) {
      if (statusError.code === 'PGRST116')
        return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
      return NextResponse.json({ error: 'Fehler beim Abrufen der Vakanz' }, { status: 500 })
    }

    if (vakanz.status === 'Besetzt') {
      return NextResponse.json({ error: 'Besetzte Vakanzen können nicht veröffentlicht werden' }, { status: 422 })
    }
  }

  const { data: updated, error } = await supabase
    .from('vakanzen_data')
    .update({ published: parsed.data.published })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  // Agency Webhook: position.published wenn Vakanz veröffentlicht wird
  if (parsed.data.published === true) {
    const { data: vakanzData } = await supabase
      .from('vakanzen')
      .select('id, rolle, branche, beschreibung, skills, skills_nice_have, erfahrungslevel, startdatum, enddatum, auslastung, arbeitsmodell, standort')
      .eq('id', id)
      .single()

    if (vakanzData) {
      sendPositionPublished(id, {
        id: vakanzData.id,
        role: vakanzData.rolle,
        industry: vakanzData.branche,
        description: vakanzData.beschreibung,
        skills: vakanzData.skills ?? [],
        skillsNiceToHave: vakanzData.skills_nice_have ?? [],
        seniority: vakanzData.erfahrungslevel,
        startDate: vakanzData.startdatum,
        endDate: vakanzData.enddatum,
        utilizationPct: vakanzData.auslastung,
        workModel: vakanzData.arbeitsmodell,
        location: vakanzData.standort ?? null,
      }).catch((e) => console.error('Agency webhook error:', e))
    }
  }

  return NextResponse.json({ published: parsed.data.published })
}
