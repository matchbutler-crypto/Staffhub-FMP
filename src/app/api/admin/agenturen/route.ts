import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const agenturSchema = z.object({
  name: z.string().min(1).max(200),
  kontakt_email: z.string().email(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

// ── GET /api/admin/agenturen ──────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('agenturen')
    .select('id, name, kontakt_email, created_at')
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  // Benutzeranzahl pro Agentur
  const { data: profiles } = await supabase
    .from('profiles')
    .select('agentur_id')
    .not('agentur_id', 'is', null)

  const userCounts: Record<string, number> = {}
  for (const p of profiles ?? []) {
    if (p.agentur_id) {
      userCounts[p.agentur_id] = (userCounts[p.agentur_id] ?? 0) + 1
    }
  }

  const agenturen = (data ?? []).map((a) => ({
    ...a,
    user_anzahl: userCounts[a.id] ?? 0,
  }))

  return NextResponse.json({ agenturen })
}

// ── POST /api/admin/agenturen ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = agenturSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('agenturen')
    .insert({ name: parsed.data.name, kontakt_email: parsed.data.kontakt_email })
    .select('id, name, kontakt_email, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Agentur mit diesem Namen existiert bereits' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 })
  }

  return NextResponse.json({ agentur: data }, { status: 201 })
}
