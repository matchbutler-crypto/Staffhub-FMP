import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/server'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const updateProfilSchema = z.object({
  kandidatenname: z.string().min(1, 'Name ist erforderlich').max(200),
  verfuegbarkeit_stunden: z
    .number({ invalid_type_error: 'Muss eine Zahl sein' })
    .int()
    .min(1)
    .max(168),
  verfuegbar_ab: z.string().min(1, 'Datum ist erforderlich'),
  verkaufspreis: z.number({ invalid_type_error: 'Muss eine Zahl sein' }).min(1),
  skills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich'),
  erfahrungslevel: z.enum(['Junior', 'Mid', 'Senior', 'Expert']),
  profiltext: z.string().min(1, 'Profiltext ist erforderlich').max(5000),
  kommentar_agentur: z.string().max(2000).optional(),
})

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

// ── GET /api/profile/[id] ──────────────────────────────────────────────────────

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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('kandidaten_profile')
    .select(`
      *,
      vakanzen!inner(titel),
      agenturen(name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Fehler beim Laden des Profils' }, { status: 500 })
  }

  const { vakanzen, agenturen, ...rest } = data as typeof data & {
    vakanzen: { titel: string } | null
    agenturen: { name: string } | null
  }

  return NextResponse.json({
    ...rest,
    vakanz_titel: vakanzen?.titel ?? null,
    agentur_name: agenturen?.name ?? null,
  })
}

// ── PUT /api/profile/[id] ──────────────────────────────────────────────────────

export async function PUT(
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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Check profil exists and is editable
  const { data: existing, error: fetchError } = await supabase
    .from('kandidaten_profile')
    .select('id, status, cv_pfad, agentur_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }
  if (existing.status !== 'Eingereicht') {
    return NextResponse.json(
      { error: 'Bearbeiten nur bei Status „Eingereicht" möglich' },
      { status: 403 }
    )
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const cvFile = formData.get('cv') as File | null
  const hasCv = cvFile && cvFile.size > 0

  // Validate new CV if provided
  if (hasCv) {
    if (cvFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
    }
    if (cvFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei darf maximal 10 MB groß sein' }, { status: 400 })
    }
    // Magic-Byte-Check: echte PDF-Datei prüfen (%PDF)
    const header = new Uint8Array(await cvFile.slice(0, 4).arrayBuffer())
    if (header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 || header[3] !== 0x46) {
      return NextResponse.json({ error: 'Ungültige PDF-Datei (Dateiinhalt stimmt nicht überein)' }, { status: 400 })
    }
  }

  // Validate structured fields
  const skillsRaw = formData.get('skills')
  let skills: string[] = []
  try {
    skills = JSON.parse(String(skillsRaw))
  } catch {
    return NextResponse.json({ error: 'Ungültige Skills' }, { status: 400 })
  }

  const bodyRaw = {
    kandidatenname: formData.get('kandidatenname'),
    verfuegbarkeit_stunden: Number(formData.get('verfuegbarkeit_stunden')),
    verfuegbar_ab: formData.get('verfuegbar_ab'),
    verkaufspreis: Number(formData.get('verkaufspreis')),
    skills,
    erfahrungslevel: formData.get('erfahrungslevel'),
    profiltext: formData.get('profiltext'),
    kommentar_agentur: formData.get('kommentar_agentur') || undefined,
  }

  const parsed = updateProfilSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  let newCvPfad = existing.cv_pfad

  // Upload new CV and remove old one
  if (hasCv) {
    const newPath = `${id}/${uuidv4()}.pdf`
    const cvBuffer = await cvFile.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('cv-uploads')
      .upload(newPath, cvBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Fehler beim Hochladen des Lebenslaufs' }, { status: 500 })
    }

    // Delete old file (best-effort, don't fail on error)
    if (existing.cv_pfad) {
      await supabase.storage.from('cv-uploads').remove([existing.cv_pfad])
    }

    newCvPfad = newPath
  }

  // Update DB
  const { data: updated, error: updateError } = await supabase
    .from('kandidaten_profile')
    .update({
      ...parsed.data,
      cv_pfad: newCvPfad,
    })
    .eq('id', id)
    .select('id, kandidatenname, status, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Profils' }, { status: 500 })
  }

  return NextResponse.json({ profil: updated })
}

// ── DELETE /api/profile/[id] ───────────────────────────────────────────────────

export async function DELETE(
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

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (profile.rolle !== 'Agentur') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Fetch profil to check ownership + status (RLS also enforces this)
  const { data: existing, error: fetchError } = await supabase
    .from('kandidaten_profile')
    .select('id, status, cv_pfad')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }
  if (existing.status !== 'Eingereicht') {
    return NextResponse.json(
      { error: 'Zurückziehen nur bei Status „Eingereicht" möglich' },
      { status: 403 }
    )
  }

  // Delete DB record first
  const { error: deleteError } = await supabase
    .from('kandidaten_profile')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: 'Fehler beim Löschen des Profils' }, { status: 500 })
  }

  // Delete CV from Storage (best-effort)
  if (existing.cv_pfad) {
    await supabase.storage.from('cv-uploads').remove([existing.cv_pfad])
  }

  return NextResponse.json({ success: true })
}
