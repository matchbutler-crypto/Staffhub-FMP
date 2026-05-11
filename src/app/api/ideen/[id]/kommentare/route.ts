import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const kommentarSchema = z.object({
  text: z.string().min(1, 'Kommentar darf nicht leer sein').max(2000),
})

// ── POST /api/ideen/[id]/kommentare ───────────────────────────────────────────

export async function POST(
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
    .select('aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = kommentarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // RLS stellt sicher dass nur berechtigte User kommentieren können
  const { data, error } = await supabase
    .from('ideen_kommentare')
    .insert({ idee_id: id, autor_id: user.id, text: parsed.data.text })
    .select(`
      id, text, created_at,
      autor:profiles!ideen_kommentare_autor_id_fkey(id, name, rolle)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
