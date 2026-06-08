// src/app/api/ressourcen/bulk-extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractSkillsFromCVBuffer } from '@/lib/openai'

export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024
const LIMITS: Record<string, number> = {
  Admin: 30,
  'Staffhub Manager': 30,
  Agentur: 10,
}

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── POST /api/ressourcen/bulk-extract ─────────────────────────────────────────
// Nimmt ein einzelnes PDF, lädt es in bulk-temp hoch, extrahiert Skills.

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const allowedRollen = ['Admin', 'Staffhub Manager', 'Agentur']
  if (!allowedRollen.includes(profile.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const isManagerOrAdmin = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
  if (!isManagerOrAdmin && !profile.agentur_id) {
    return NextResponse.json({ error: 'Agentur-Zuordnung fehlt' }, { status: 403 })
  }

  const agenturId = isManagerOrAdmin
    ? (request.headers.get('x-agentur-id') ?? 'manager')
    : profile.agentur_id!

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const indexRaw = formData.get('index')
  const index = indexRaw !== null ? Number(indexRaw) : 0

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })
  }

  const uuid = uuidv4()
  const tempCvPfad = `bulk-temp/${agenturId}/${uuid}.pdf`

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server-Konfigurationsfehler' }, { status: 500 })
  }

  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabaseAdmin.storage
    .from('ressourcen-cvs')
    .upload(tempCvPfad, fileBuffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen der Datei' }, { status: 500 })
  }

  let skills: string[] = []
  try {
    skills = await extractSkillsFromCVBuffer(fileBuffer)
  } catch {
    // Skills-Extraktion fehlgeschlagen — leeres Array zurückgeben, Upload bleibt erhalten
    skills = []
  }

  return NextResponse.json({ tempCvPfad, skills, index })
}

// ── DELETE /api/ressourcen/bulk-extract ───────────────────────────────────────
// Löscht temp CVs (Überspringen / Sheet schließen).

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const allowedRollen = ['Admin', 'Staffhub Manager', 'Agentur']
  if (!allowedRollen.includes(profile.rolle)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const isManagerOrAdmin = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'
  if (!isManagerOrAdmin && !profile.agentur_id) {
    return NextResponse.json({ error: 'Agentur-Zuordnung fehlt' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const paths: unknown = body?.paths

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: 'paths ist erforderlich' }, { status: 400 })
  }

  const validPaths = (paths as unknown[]).filter(
    (p): p is string => typeof p === 'string' && p.startsWith('bulk-temp/')
  )

  if (validPaths.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  let supabaseAdmin: ReturnType<typeof createAdminClient>
  try {
    supabaseAdmin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server-Konfigurationsfehler' }, { status: 500 })
  }

  await supabaseAdmin.storage.from('ressourcen-cvs').remove(validPaths)

  return NextResponse.json({ deleted: validPaths.length })
}
