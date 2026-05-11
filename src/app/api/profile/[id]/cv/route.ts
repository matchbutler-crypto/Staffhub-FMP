import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/profile/[id]/cv ───────────────────────────────────────────────────
// Returns a signed URL (1 hour) for CV download

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  // Fetch the profil record (RLS ensures access control)
  const { data: profil, error: fetchError } = await supabase
    .from('kandidaten_profile')
    .select('cv_pfad, agentur_id')
    .eq('id', id)
    .single()

  if (fetchError || !profil) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

  // Application-level ownership check for Agentur role (defense in depth)
  if (profile.rolle === 'Agentur' && profil.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  if (!profil.cv_pfad) {
    return NextResponse.json({ error: 'Kein Lebenslauf vorhanden' }, { status: 404 })
  }

  // Generate signed URL (3600 seconds = 1 hour)
  const { data: signedData, error: signError } = await supabase.storage
    .from('cv-uploads')
    .createSignedUrl(profil.cv_pfad, 3600)

  if (signError || !signedData) {
    console.error('GET /api/profile/[id]/cv signed URL error:', { message: signError?.message })
    return NextResponse.json({ error: 'Fehler beim Erstellen des Download-Links' }, { status: 500 })
  }

  return NextResponse.json({ url: signedData.signedUrl })
}
