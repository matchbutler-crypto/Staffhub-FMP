import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/cron/availability-reset ──────────────────────────────────────────
// Vercel Cron: täglich um Mitternacht (vercel.json)
// Setzt Ressourcen auf "Jetzt verfügbar", wenn verfuegbar_ab <= heute

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const { data: ressourcen, error } = await supabase
    .from('ressourcen')
    .select('id, name, verfuegbar_ab')
    .eq('verfuegbarkeit', 'Nicht verfügbar')
    .lte('verfuegbar_ab', today)
    .not('verfuegbar_ab', 'is', null)

  if (error) {
    console.error('availability-reset: query error', error)
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  if (!ressourcen || ressourcen.length === 0) {
    return NextResponse.json({ reset: 0 })
  }

  const ids = ressourcen.map((r) => r.id)

  const { error: updateError } = await supabase
    .from('ressourcen')
    .update({ verfuegbarkeit: 'Jetzt verfügbar', verfuegbar_ab: null })
    .in('id', ids)

  if (updateError) {
    console.error('availability-reset: update error', updateError)
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
  }

  // Historien-Einträge für jede zurückgesetzte Ressource
  const historieRows = ressourcen.map((r) => ({
    ressource_id: r.id,
    typ: 'system',
    text: `Verfügbarkeit automatisch auf "Jetzt verfügbar" gesetzt (verfügbar_ab ${r.verfuegbar_ab} erreicht)`,
  }))

  await supabase.from('ressource_historie').insert(historieRows)

  return NextResponse.json({ reset: ids.length, ids })
}
