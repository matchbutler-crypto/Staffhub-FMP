import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ROLLEN = ['Admin', 'Staffhub Manager', 'Agentur'] as const

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben'),
  rolle: z.enum(ROLLEN),
  agentur_id: z.string().uuid().nullable().optional(),
}).refine(
  (d) => d.rolle !== 'Agentur' || !!d.agentur_id,
  { message: 'Agentur-Benutzer brauchen eine Agentur-Zuordnung', path: ['agentur_id'] }
)

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

// ── GET /api/admin/users ──────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, rolle, aktiv, agentur_id, created_at, agenturen(name)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}

// ── POST /api/admin/users ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
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

  // Auth-User anlegen
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message?.includes('already registered')) {
      return NextResponse.json({ error: 'E-Mail-Adresse ist bereits registriert' }, { status: 409 })
    }
    return NextResponse.json({ error: `Auth-Fehler: ${authError.message}` }, { status: 500 })
  }

  const userId = authData.user.id

  // Profil anlegen
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      rolle: parsed.data.rolle,
      agentur_id: parsed.data.agentur_id ?? null,
      aktiv: true,
    })
    .select('id, name, email, rolle, aktiv, agentur_id')
    .single()

  if (profileError) {
    // Rollback: Auth-User wieder löschen
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Fehler beim Anlegen des Profils' }, { status: 500 })
  }

  return NextResponse.json({ user: profile }, { status: 201 })
}
