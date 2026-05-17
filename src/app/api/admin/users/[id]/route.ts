import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ROLLEN = ['Admin', 'Staffhub Manager', 'Controller', 'Agentur'] as const

const updateSchema = z.object({
  aktiv: z.boolean().optional(),
  rolle: z.enum(ROLLEN).optional(),
  agentur_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
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

  // Profile fields (profiles table)
  const profileUpdates: Record<string, unknown> = {}
  if (parsed.data.aktiv !== undefined) profileUpdates.aktiv = parsed.data.aktiv
  if (parsed.data.rolle !== undefined) profileUpdates.rolle = parsed.data.rolle
  if (parsed.data.agentur_id !== undefined) profileUpdates.agentur_id = parsed.data.agentur_id
  if (parsed.data.name !== undefined) profileUpdates.name = parsed.data.name
  if (parsed.data.email !== undefined) profileUpdates.email = parsed.data.email

  // Auth fields (email/password) — require admin client
  const needsAuthUpdate = parsed.data.email !== undefined || parsed.data.password !== undefined
  const needsProfileUpdate = Object.keys(profileUpdates).length > 0

  let supabaseAdmin = needsAuthUpdate ? (() => {
    try { return createAdminClient() } catch { return null }
  })() : null

  if (needsAuthUpdate && !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server-Konfigurationsfehler: SUPABASE_SERVICE_ROLE_KEY fehlt' },
      { status: 503 }
    )
  }

  const authUpdates: { email?: string; password?: string } = {}
  if (parsed.data.email) authUpdates.email = parsed.data.email
  if (parsed.data.password) authUpdates.password = parsed.data.password

  // Run auth and profile updates in parallel when both are needed
  const [authResult, profileResult] = await Promise.all([
    needsAuthUpdate && supabaseAdmin
      ? supabaseAdmin.auth.admin.updateUserById(id, authUpdates)
      : Promise.resolve({ error: null }),
    needsProfileUpdate
      ? supabase.from('profiles').update(profileUpdates).eq('id', id).select('id, name, email, rolle, aktiv, agentur_id').single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (authResult.error) {
    return NextResponse.json(
      { error: `Auth-Fehler: ${authResult.error.message}` },
      { status: 500 }
    )
  }

  const { data, error } = profileResult as { data: unknown; error: { message: string } | null }
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
