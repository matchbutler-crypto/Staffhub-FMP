import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logHistorie } from '@/lib/log-historie'

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

  // Fetch before delete to get ressource_id for history logging
  const { data: existing } = await supabase
    .from('ressource_feedback')
    .select('id, ressource_id')
    .eq('id', id)
    .eq('erstellt_von', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: 'Feedback nicht gefunden oder keine Berechtigung' },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from('ressource_feedback')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  await logHistorie({
    ressourceId: existing.ressource_id,
    text: 'Feedback gelöscht',
    erstelltVon: user.id,
    supabase,
  })

  return NextResponse.json({ success: true })
}
