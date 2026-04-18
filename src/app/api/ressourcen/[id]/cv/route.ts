import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/ressourcen/[id]/cv  (Signed URL) ──────────────────────────────────

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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('cv_pfad, agentur_id')
    .eq('id', id)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }

  if (profile.rolle === 'Agentur' && ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  if (!ressource.cv_pfad) {
    return NextResponse.json({ error: 'Kein Lebenslauf vorhanden' }, { status: 404 })
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from('ressourcen-cvs')
    .createSignedUrl(ressource.cv_pfad, 3600)

  if (signError || !signedData) {
    return NextResponse.json({ error: 'Fehler beim Erstellen des Download-Links' }, { status: 500 })
  }

  return NextResponse.json({ url: signedData.signedUrl })
}

// ── POST /api/ressourcen/[id]/cv  (Upload / Replace) ──────────────────────────

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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur' || !profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('agentur_id, cv_pfad')
    .eq('id', id)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('cv') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })
  }

  // Altes CV löschen wenn vorhanden
  if (ressource.cv_pfad) {
    await supabase.storage.from('ressourcen-cvs').remove([ressource.cv_pfad])
  }

  const cvPfad = `${profile.agentur_id}/${id}.pdf`
  const { error: uploadError } = await supabase.storage
    .from('ressourcen-cvs')
    .upload(cvPfad, await file.arrayBuffer(), {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen des Lebenslaufs' }, { status: 500 })
  }

  await supabase.from('ressourcen').update({ cv_pfad: cvPfad }).eq('id', id)

  return NextResponse.json({ cv_pfad: cvPfad }, { status: 201 })
}

// ── DELETE /api/ressourcen/[id]/cv ─────────────────────────────────────────────

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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur' || !profile.agentur_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('agentur_id, cv_pfad')
    .eq('id', id)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }
  if (!ressource.cv_pfad) {
    return NextResponse.json({ error: 'Kein Lebenslauf vorhanden' }, { status: 404 })
  }

  await supabase.storage.from('ressourcen-cvs').remove([ressource.cv_pfad])
  await supabase.from('ressourcen').update({ cv_pfad: null }).eq('id', id)

  return NextResponse.json({ success: true })
}
