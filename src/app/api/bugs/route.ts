// src/app/api/bugs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createBugSchema = z.object({
  beschreibung: z.string().min(10, 'Mindestens 10 Zeichen'),
  screenshot_url: z.string().url().optional(),
  seite_url: z.string().min(1),
})

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', userId)
    .single()
  return data
}

// ── POST /api/bugs ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createBugSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bug_reports')
    .insert({
      beschreibung: parsed.data.beschreibung,
      screenshot_url: parsed.data.screenshot_url ?? null,
      seite_url: parsed.data.seite_url,
      melder_id: user.id,
      melder_rolle: profile.rolle,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// ── GET /api/bugs ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getProfile(supabase, user.id)
  if (profile?.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  let query = supabase
    .from('bug_reports')
    .select(`
      id, beschreibung, screenshot_url, seite_url, status,
      melder_rolle, created_at, updated_at,
      melder:profiles!bug_reports_melder_id_fkey(name, rolle)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
