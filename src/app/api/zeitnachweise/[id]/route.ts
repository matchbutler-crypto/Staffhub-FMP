import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()
  return { user, profile }
}

// ── GET /api/zeitnachweise/[id] → signed download URL ────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: zn } = await supabase
    .from('zeitnachweise')
    .select('pdf_path, beauftragung_id')
    .eq('id', id)
    .single()

  if (!zn) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (profile.rolle === 'Agentur') {
    const { data: bauf } = await supabase
      .from('beauftragungen')
      .select('agentur_id')
      .eq('id', zn.beauftragung_id)
      .single()
    if (!bauf || bauf.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
  }

  const { data: signedUrl, error } = await supabase.storage
    .from('zeitnachweise')
    .createSignedUrl(zn.pdf_path, 3600)

  if (error || !signedUrl) {
    return NextResponse.json({ error: 'Fehler beim Generieren der Download-URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signedUrl.signedUrl })
}

// ── DELETE /api/zeitnachweise/[id] ───────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'
  if (!isManager) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { data: zn } = await supabase
    .from('zeitnachweise')
    .select('pdf_path')
    .eq('id', id)
    .single()

  if (!zn) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await supabase.storage.from('zeitnachweise').remove([zn.pdf_path])

  const { error } = await supabase.from('zeitnachweise').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })

  return NextResponse.json({ success: true })
}
