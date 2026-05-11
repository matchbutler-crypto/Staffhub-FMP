import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateStatusSchema = z.object({
  status: z.enum(['Offen', 'In Prüfung', 'Umgesetzt', 'Abgelehnt']),
})

// ── GET /api/ideen/[id] ────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('ideen')
    .select(`
      id, titel, beschreibung, kategorie, status, ersteller_rolle, ersteller_id, created_at,
      ersteller:profiles!ideen_ersteller_id_fkey(name, rolle),
      upvotes_count:ideen_upvotes(count)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Idee nicht gefunden' }, { status: 404 })
  }

  const { data: kommentare, error: kError } = await supabase
    .from('ideen_kommentare')
    .select(`
      id, text, created_at,
      autor:profiles!ideen_kommentare_autor_id_fkey(id, name, rolle)
    `)
    .eq('idee_id', id)
    .order('created_at', { ascending: true })

  if (kError) {
    return NextResponse.json({ error: kError.message }, { status: 500 })
  }

  const { data: userUpvote } = await supabase
    .from('ideen_upvotes')
    .select('id')
    .eq('idee_id', id)
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    ...data,
    kommentare: kommentare ?? [],
    user_upvoted: !!userUpvote,
  })
}

// ── PATCH /api/ideen/[id] — nur Admin ─────────────────────────────────────────

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
    .select('rolle')
    .eq('id', user.id)
    .single()

  if (profile?.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Nur Admin darf den Status ändern' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ideen')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Idee nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json(data)
}
