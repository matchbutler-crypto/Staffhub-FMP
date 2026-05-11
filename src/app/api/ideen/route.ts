import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createIdeaSchema = z.object({
  titel: z.string().min(1, 'Titel erforderlich').max(200),
  beschreibung: z.string().min(1, 'Beschreibung erforderlich'),
  kategorie: z.enum(['Feature', 'Verbesserung', 'Bug', 'Sonstiges']).optional().default('Sonstiges'),
})

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/ideen ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rolleFilter = searchParams.get('rolle') // only Admin can filter by role

  let query = supabase
    .from('ideen')
    .select(`
      id, titel, beschreibung, kategorie, status, ersteller_rolle, created_at,
      ersteller:profiles!ideen_ersteller_id_fkey(name, rolle),
      kommentare_count:ideen_kommentare(count),
      upvotes_count:ideen_upvotes(count)
    `)
    .order('created_at', { ascending: false })

  if (profile.rolle === 'Admin' && rolleFilter) {
    query = query.eq('ersteller_rolle', rolleFilter)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: userUpvotes } = await supabase
    .from('ideen_upvotes')
    .select('idee_id')
    .eq('user_id', user.id)

  const upvotedIds = new Set((userUpvotes ?? []).map((u) => u.idee_id))
  const result = (data ?? []).map((idee) => ({
    ...idee,
    user_upvoted: upvotedIds.has(idee.id),
  }))

  return NextResponse.json(result)
}

// ── POST /api/ideen ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle === 'Admin') {
    return NextResponse.json({ error: 'Admin kann keine Ideen einreichen' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createIdeaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const ersteller_rolle = profile.rolle === 'Staffhub Manager' ? 'manager' : 'agentur'

  const { data, error } = await supabase
    .from('ideen')
    .insert({
      ...parsed.data,
      ersteller_id: user.id,
      ersteller_rolle,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
