import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ROLLEN = ['Admin', 'Staffhub Manager', 'Agentur'] as const

const updateSchema = z.object({
  aktiv: z.boolean().optional(),
  rolle: z.enum(ROLLEN).optional(),
  agentur_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
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

// ── PATCH /api/admin/users/[id] ───────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminUser = await requireAdmin(supabase)
  if (!adminUser) {
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

  const updates: Record<string, unknown> = {}
  if (parsed.data.aktiv !== undefined) updates.aktiv = parsed.data.aktiv
  if (parsed.data.rolle !== undefined) updates.rolle = parsed.data.rolle
  if (parsed.data.agentur_id !== undefined) updates.agentur_id = parsed.data.agentur_id
  if (parsed.data.name !== undefined) updates.name = parsed.data.name

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, name, email, rolle, aktiv, agentur_id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}

// ── DELETE /api/admin/users/[id] ──────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminUser = await requireAdmin(supabase)
  if (!adminUser) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (adminUser.id === id) {
    return NextResponse.json({ error: 'Eigenen Account nicht löschbar' }, { status: 400 })
  }

  let supabaseAdmin
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Server-Konfigurationsfehler: SUPABASE_SERVICE_ROLE_KEY fehlt' },
      { status: 503 }
    )
  }

  // Delete profile row first (FK may not cascade automatically)
  await supabase.from('profiles').delete().eq('id', id)

  // Delete auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) {
    return NextResponse.json({ error: `Fehler beim Löschen: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
