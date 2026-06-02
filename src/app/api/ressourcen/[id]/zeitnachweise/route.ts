import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })

  // Resolve: ressource → ressource_vakanz_links → beauftragungen → zeitnachweise
  const { data: links } = await supabase
    .from('ressource_vakanz_links')
    .select('id')
    .eq('ressource_id', id)

  const linkIds = links?.map(l => l.id) ?? []
  if (linkIds.length === 0) return NextResponse.json([])

  const { data: beauftragungen } = await supabase
    .from('beauftragungen')
    .select('id')
    .in('ressource_link_id', linkIds)

  const beauftragungIds = beauftragungen?.map(b => b.id) ?? []
  if (beauftragungIds.length === 0) return NextResponse.json([])

  const { data, error } = await supabase
    .from('zeitnachweise')
    .select('id, beauftragung_id, monat, stunden_ist, tage_ist_override, uploaded_at')
    .in('beauftragung_id', beauftragungIds)
    .order('monat', { ascending: false })

  if (error) return NextResponse.json({ error: 'Fehler beim Laden der Zeitnachweise' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
