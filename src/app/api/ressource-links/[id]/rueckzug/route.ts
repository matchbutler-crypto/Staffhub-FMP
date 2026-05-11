import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const RUECKZUG_ERLAUBT = ['Gespielt'] as const

const rueckzugSchema = z.object({
  grund: z.string().max(500).optional(),
})

// ── PATCH /api/ressource-links/[id]/rueckzug ─────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Nur Agenturen dürfen Einreichungen zurückziehen' }, { status: 403 })
  }
  if (!profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Agentur-Zuordnung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = rueckzugSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Link + verknüpfte Ressource laden (Ownership-Check)
  const { data: link } = await supabase
    .from('ressource_vakanz_links')
    .select('id, ressource_id, status, ressourcen(agentur_id), vakanzen_data(rolle)')
    .eq('id', id)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'Verknüpfung nicht gefunden' }, { status: 404 })
  }

  // Ownership: Ressource muss zur Agentur des eingeloggten Users gehören
  const ressourcenArray = Array.isArray(link.ressourcen) ? link.ressourcen : [link.ressourcen]
  const ressourceAgenturId = ressourcenArray[0]?.agentur_id
  if (ressourceAgenturId !== profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Berechtigung — Ressource gehört nicht zu Ihrer Agentur' }, { status: 403 })
  }

  // Status-Check: Rückzug nur aus erlaubten Status
  if (!RUECKZUG_ERLAUBT.includes(link.status as typeof RUECKZUG_ERLAUBT[number])) {
    return NextResponse.json(
      { error: `Rückzug nicht möglich bei Status "${link.status}"` },
      { status: 409 }
    )
  }

  // Update durchführen (atomisch)
  const { data: updated, error: updateError } = await supabase
    .from('ressource_vakanz_links')
    .update({
      status: 'Zurückgezogen',
      grund_rueckzug: parsed.data.grund ?? null,
    })
    .eq('id', id)
    .select('id, ressource_id, vakanz_id, status, grund_rueckzug, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Zurückziehen' }, { status: 500 })
  }

  // Historien-Eintrag (System)
  const vakanzenArray = Array.isArray(link.vakanzen_data) ? link.vakanzen_data : [link.vakanzen_data]
  const vakanzRolle = vakanzenArray[0]?.rolle ?? 'unbekannte Vakanz'
  const grundText = parsed.data.grund ? ` Grund: ${parsed.data.grund}` : ''
  await supabase.from('ressource_historie').insert({
    ressource_id: link.ressource_id,
    link_id: id,
    typ: 'system',
    text: `Einreichung zurückgezogen (Vakanz: "${vakanzRolle}").${grundText}`,
    erstellt_von: user.id,
  })

  return NextResponse.json({ link: updated })
}
