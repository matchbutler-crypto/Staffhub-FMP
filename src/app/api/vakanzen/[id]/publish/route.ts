import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logVakanzHistorie } from '@/lib/log-vakanz-historie'

const publishSchema = z.object({ published: z.boolean() })

// ── PATCH /api/vakanzen/[id]/publish ──────────────────────────────────────────

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
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  // Alten Status + published-Wert laden (Besetzt-Check + Log)
  const { data: oldVakanz } = await supabase
    .from('vakanzen_data')
    .select('status, published')
    .eq('id', id)
    .single()

  if (parsed.data.published === true && oldVakanz?.status === 'Besetzt') {
    return NextResponse.json({ error: 'Besetzte Vakanzen können nicht veröffentlicht werden' }, { status: 400 })
  }

  const { error } = await supabase
    .from('vakanzen_data')
    .update({ published: parsed.data.published })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  if (oldVakanz?.published !== parsed.data.published) {
    await logVakanzHistorie({
      vakanzId: id,
      text: parsed.data.published ? 'Veröffentlicht' : 'Veröffentlichung aufgehoben',
      erstelltVon: user.id,
    })
  }

  return NextResponse.json({ published: parsed.data.published })
}
