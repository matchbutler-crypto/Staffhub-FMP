import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── DELETE /api/ressource-feedback/[id] ──────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // RLS enforces erstellt_von = auth.uid() on DELETE
  // If the row doesn't exist or belongs to another user, delete returns 0 rows
  const { data, error } = await supabase
    .from('ressource_feedback')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Feedback nicht gefunden oder keine Berechtigung' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
