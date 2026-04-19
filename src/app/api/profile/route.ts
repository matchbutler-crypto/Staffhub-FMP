import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const profilSchema = z.object({
  vakanz_id: z.string().uuid('Ungültige Vakanz-ID'),
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

// ── GET /api/profile ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'

  // Manager/Admin sehen alle; Agentur sieht nur eigene (via RLS)
  const query = supabase
    .from('kandidaten_profile')
    .select(`
      id,
      vakanz_id,
      agentur_id,
      kandidatenname,
      verfuegbarkeit_stunden,
      verfuegbar_ab,
      verkaufspreis,
      skills,
      erfahrungslevel,
      profiltext,
      cv_pfad,
      kommentar_agentur,
      status,
      ki_score,
      created_at,
      updated_at,
      vakanzen!inner(titel),
      agenturen(name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  const { data, error } = await query

  if (error) {
    console.error('GET /api/profile error:', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Fehler beim Laden der Profile' }, { status: 500 })
  }

  const result = (data ?? []).map((p) => {
    const { vakanzen, agenturen, ...rest } = p as typeof p & {
      vakanzen: { titel: string } | null
      agenturen: { name: string } | null
    }
    return {
      ...rest,
      vakanz_titel: vakanzen?.titel ?? null,
      agentur_name: isManager ? (agenturen?.name ?? null) : undefined,
    }
  })

  return NextResponse.json(result)
}

// ── POST /api/profile ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Nur Agenturen können Profile einreichen' }, { status: 403 })
  }
  if (!profile.agentur_id) {
    return NextResponse.json(
      { error: 'Ihr Account ist keiner Agentur zugeordnet' },
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
  if (!cvFile || cvFile.size === 0) {
    return NextResponse.json({ error: 'Lebenslauf (PDF) ist erforderlich' }, { status: 400 })
  }

  // Validate file type + size
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

  // Validate structured fields
  const skillsRaw = formData.get('skills')
  let skills: string[] = []
  try {
    skills = JSON.parse(String(skillsRaw))
  } catch {
    return NextResponse.json({ error: 'Ungültige Skills' }, { status: 400 })
  }

  const bodyRaw = {
    vakanz_id: formData.get('vakanz_id'),
    kandidatenname: formData.get('kandidatenname'),
    verfuegbarkeit_stunden: Number(formData.get('verfuegbarkeit_stunden')),
    verfuegbar_ab: formData.get('verfuegbar_ab'),
    verkaufspreis: Number(formData.get('verkaufspreis')),
    skills,
    erfahrungslevel: formData.get('erfahrungslevel'),
    profiltext: formData.get('profiltext'),
    kommentar_agentur: formData.get('kommentar_agentur') || undefined,
  }

  const parsed = profilSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Check vakanz is still open
  const { data: vakanz, error: vakanzError } = await supabase
    .from('vakanzen')
    .select('id, status')
    .eq('id', parsed.data.vakanz_id)
    .single()

  if (vakanzError || !vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }
  if (vakanz.status !== 'Offen') {
    return NextResponse.json({ error: 'Diese Vakanz ist nicht mehr offen' }, { status: 409 })
  }

  // Upload CV to Storage first (before DB insert)
  const tempId = uuidv4()
  const cvStoragePath = `${tempId}/${uuidv4()}.pdf`
  const cvBuffer = await cvFile.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('cv-uploads')
    .upload(cvStoragePath, cvBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    console.error('CV upload error:', { error: uploadError.message })
    return NextResponse.json({ error: 'Fehler beim Hochladen des Lebenslaufs' }, { status: 500 })
  }

  // Insert DB record
  const { data: newProfil, error: insertError } = await supabase
    .from('kandidaten_profile')
    .insert({
      ...parsed.data,
      agentur_id: profile.agentur_id,
      cv_pfad: cvStoragePath,
      status: 'Eingereicht',
    })
    .select('id, kandidatenname, status, created_at')
    .single()

  if (insertError) {
    console.error('POST /api/profile DB insert error:', { code: insertError.code, message: insertError.message })
    // Cleanup: remove uploaded file
    await supabase.storage.from('cv-uploads').remove([cvStoragePath])
    return NextResponse.json({ error: 'Fehler beim Speichern des Profils' }, { status: 500 })
  }

  return NextResponse.json({ profil: newProfil }, { status: 201 })
}
