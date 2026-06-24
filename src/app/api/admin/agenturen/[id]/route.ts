import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_KEYS } from '@/lib/features'

const featureRecord = z.record(
  z.enum(FEATURE_KEYS as unknown as [string, ...string[]]),
  z.boolean()
)

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  kontakt_email: z.string().email().optional(),
  features: featureRecord.optional(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager')) return null
  return user
}

// ── PATCH /api/admin/agenturen/[id] ──────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.kontakt_email !== undefined) updateData.kontakt_email = parsed.data.kontakt_email
  if (parsed.data.features !== undefined) updateData.features = parsed.data.features

  const { data, error } = await supabase
    .from('agenturen')
    .update(updateData)
    .eq('id', id)
    .select('id, name, kontakt_email, features')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ agentur: data })
}

// ── DELETE /api/admin/agenturen/[id] ─────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('agentur_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Agentur hat noch zugeordnete Benutzer und kann nicht gelöscht werden.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('agenturen').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
