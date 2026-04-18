import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const spielenSchema = z.object({
  vakanz_id: z.string().uuid('Ungültige Vakanz-ID'),
})

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── POST /api/ressourcen/[id]/spielen ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ressourceId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = spielenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { vakanz_id } = parsed.data

  // Ressource prüfen (existiert + nicht deaktiviert)
  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('id, name, verfuegbarkeit')
    .eq('id', ressourceId)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (ressource.verfuegbarkeit === 'Deaktiviert') {
    return NextResponse.json({ error: 'Deaktivierte Ressource kann nicht gespielt werden' }, { status: 400 })
  }

  // Vakanz prüfen (existiert + offen)
  const { data: vakanz } = await supabase
    .from('vakanzen_data')
    .select('id, rolle, status')
    .eq('id', vakanz_id)
    .single()

  if (!vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }
  if (vakanz.status === 'Geschlossen' || vakanz.status === 'Besetzt') {
    return NextResponse.json({ error: 'Ressource kann nur auf offene Vakanzen gespielt werden' }, { status: 400 })
  }

  // Verknüpfung anlegen (unique constraint verhindert Duplikate)
  const { data: link, error: insertError } = await supabase
    .from('ressource_vakanz_links')
    .insert({
      ressource_id: ressourceId,
      vakanz_id,
      status: 'Gespielt',
      created_by: user.id,
    })
    .select('id, ressource_id, vakanz_id, status, created_at')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'Diese Ressource ist bereits auf diese Vakanz gespielt' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Fehler beim Spielen der Ressource' }, { status: 500 })
  }

  // Automatischer Historien-Eintrag
  await supabase.from('ressource_historie').insert({
    ressource_id: ressourceId,
    link_id: link.id,
    typ: 'system',
    text: `Auf Vakanz "${vakanz.rolle}" gespielt`,
    erstellt_von: user.id,
  })

  return NextResponse.json({ link }, { status: 201 })
}
