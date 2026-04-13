import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const statusSchema = z.object({
  status: z.enum(['Offen', 'In Auswahl', 'Besetzt', 'Pausiert', 'Geschlossen']),
})

// ── PATCH /api/vakanzen/[id]/status ───────────────────────────────────────────

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
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle === 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: vakanz, error } = await supabase
    .from('vakanzen')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select('id, titel, status, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  return NextResponse.json({ vakanz })
}
