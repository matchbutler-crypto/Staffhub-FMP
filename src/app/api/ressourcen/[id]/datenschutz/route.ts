import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logHistorie } from '@/lib/log-historie'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const BUCKET = 'ressourcen-datenschutz'

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/ressourcen/[id]/datenschutz  (Signed URL) ────────────────────────
// Admin + Staffhub Manager only

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
  if (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { data: ressource } = await supabase
    .from('ressourcen')
    .select('datenschutz_pfad')
    .eq('id', id)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (!ressource.datenschutz_pfad) {
    return NextResponse.json({ error: 'Kein Datenschutz-Screenshot vorhanden' }, { status: 404 })
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ressource.datenschutz_pfad, 3600)

  if (signError || !signedData) {
    return NextResponse.json({ error: 'Fehler beim Erstellen des Download-Links' }, { status: 500 })
  }

  return NextResponse.json({ url: signedData.signedUrl })
}

// ── POST /api/ressourcen/[id]/datenschutz  (Upload) ───────────────────────────
// Agentur only — uploads PNG screenshot of Datenschutzerklärung

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
    .select('agentur_id, datenschutz_pfad')
    .eq('id', id)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('datenschutz') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
  }
  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    return NextResponse.json({ error: 'Nur PNG/JPG-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })
  }

  if (ressource.datenschutz_pfad) {
    await supabase.storage.from(BUCKET).remove([ressource.datenschutz_pfad])
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const pfad = `${profile.agentur_id}/${id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen' }, { status: 500 })
  }

  await supabase.from('ressourcen').update({ datenschutz_pfad: pfad }).eq('id', id)

  await logHistorie({
    ressourceId: id,
    text: 'Datenschutzerklärung-Screenshot hochgeladen',
    erstelltVon: user.id,
    supabase,
  })

  return NextResponse.json({ datenschutz_pfad: pfad }, { status: 201 })
}

// ── DELETE /api/ressourcen/[id]/datenschutz ───────────────────────────────────
// Agentur only

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
    .select('agentur_id, datenschutz_pfad')
    .eq('id', id)
    .single()

  if (!ressource) {
    return NextResponse.json({ error: 'Ressource nicht gefunden' }, { status: 404 })
  }
  if (ressource.agentur_id !== profile.agentur_id) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }
  if (!ressource.datenschutz_pfad) {
    return NextResponse.json({ error: 'Kein Screenshot vorhanden' }, { status: 404 })
  }

  await supabase.storage.from(BUCKET).remove([ressource.datenschutz_pfad])
  await supabase.from('ressourcen').update({ datenschutz_pfad: null }).eq('id', id)

  await logHistorie({
    ressourceId: id,
    text: 'Datenschutzerklärung-Screenshot gelöscht',
    erstelltVon: user.id,
    supabase,
  })

  return NextResponse.json({ success: true })
}
