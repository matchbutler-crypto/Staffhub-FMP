import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── DELETE /api/ressource-links/[id] ─────────────────────────────────────────
// Admin-only: löscht eine Ressource-Vakanz-Verknüpfung vollständig.
// Bereinigt zugehörige Beauftragungen und setzt Vakanz-Status zurück.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (profile.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Nur Admins können Beauftragungen lösen' }, { status: 403 })
  }

  const { data: link } = await supabase
    .from('ressource_vakanz_links')
    .select('id, ressource_id, vakanz_id, status, vakanzen(rolle, fte_anzahl, status)')
    .eq('id', id)
    .single()

  if (!link) return NextResponse.json({ error: 'Verknüpfung nicht gefunden' }, { status: 404 })

  const wasBeauftragt = link.status === 'Beauftragt'

  // Beauftragungen-Datensätze bereinigen
  await supabase
    .from('beauftragungen')
    .delete()
    .eq('ressource_link_id', id)

  // Historien-Eintrag vor dem Löschen
  const vakanzenArray = Array.isArray(link.vakanzen) ? link.vakanzen : [link.vakanzen]
  const vakanzRolle = vakanzenArray[0]?.rolle ?? 'unbekannte Vakanz'
  await supabase.from('ressource_historie').insert({
    ressource_id: link.ressource_id,
    link_id: id,
    typ: 'system',
    text: `Beauftragung für Vakanz "${vakanzRolle}" wurde vom Admin gelöst (Link-Status war: "${link.status}")`,
    erstellt_von: user.id,
  })

  // Link löschen
  const { error: deleteError } = await supabase
    .from('ressource_vakanz_links')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: 'Fehler beim Löschen der Verknüpfung' }, { status: 500 })
  }

  // Wenn Link "Beauftragt" war: Vakanz ggf. auf "Offen" zurücksetzen
  if (wasBeauftragt) {
    const vakanz = vakanzenArray[0]
    if (vakanz?.status === 'Besetzt') {
      const { count: beauftragtCount } = await supabase
        .from('ressource_vakanz_links')
        .select('*', { count: 'exact', head: true })
        .eq('vakanz_id', link.vakanz_id)
        .eq('status', 'Beauftragt')

      const fte = vakanz.fte_anzahl != null ? Number(vakanz.fte_anzahl) : null
      const count = beauftragtCount ?? 0

      if (fte !== null && count < fte) {
        await supabase
          .from('vakanzen')
          .update({ status: 'Offen', published: false, besetzt_seit: null })
          .eq('id', link.vakanz_id)
      }
    }

    // Ressource-Verfügbarkeit zurücksetzen
    await supabase
      .from('ressourcen')
      .update({ verfuegbarkeit: 'Verfügbar', verfuegbar_ab: null })
      .eq('id', link.ressource_id)
  }

  return NextResponse.json({ success: true })
}
