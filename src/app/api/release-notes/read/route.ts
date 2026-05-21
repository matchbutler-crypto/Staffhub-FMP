import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  note_ids: z.array(z.string().uuid()).min(1),
})

// ── POST /api/release-notes/read ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }

  const rows = parsed.data.note_ids.map((note_id) => ({
    user_id: user.id,
    note_id,
  }))

  const { error } = await supabase
    .from('release_note_reads')
    .upsert(rows, { onConflict: 'user_id,note_id', ignoreDuplicates: true })

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
