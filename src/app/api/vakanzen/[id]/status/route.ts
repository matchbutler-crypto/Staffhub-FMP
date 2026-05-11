import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { VAKANZ_STATUS } from '@/lib/constants'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const statusSchema = z.object({
  status: z.enum(VAKANZ_STATUS),
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

  const updatePayload: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'Besetzt') {
    updatePayload.besetzt_seit = new Date().toISOString()
  } else {
    updatePayload.besetzt_seit = null
  }

  const { data: vakanz, error } = await supabase
    .from('vakanzen')
    .update(updatePayload)
    .eq('id', id)
    .select('id, titel, status, besetzt_seit, updated_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    }
    console.error('PATCH /api/vakanzen/[id]/status error:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }

  return NextResponse.json({ vakanz })
}
