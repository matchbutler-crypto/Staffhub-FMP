import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractStundenFromPDF } from '@/lib/openai'

export const maxDuration = 30

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

// ── GET /api/zeitnachweise?beauftragung_ids=id1,id2&monat=2026-05-01 ──────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { profile } = await getProfile(supabase)
  if (!profile?.aktiv) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const idsParam = searchParams.get('beauftragung_ids') ?? ''
  const monat = searchParams.get('monat')

  if (!monat || !idsParam) return NextResponse.json({ zeitnachweise: [] })

  const ids = idsParam.split(',').filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ zeitnachweise: [] })

  const { data, error } = await supabase
    .from('zeitnachweise')
    .select('id, beauftragung_id, monat, stunden_ist, uploaded_at')
    .in('beauftragung_id', ids)
    .eq('monat', monat)

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ zeitnachweise: data ?? [] })
}

// ── POST /api/zeitnachweise ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user, profile } = await getProfile(supabase)
  if (!profile?.aktiv || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isManager = profile.rolle === 'Staffhub Manager' || profile.rolle === 'Admin'
  const isAgentur = profile.rolle === 'Agentur'
  if (!isManager && !isAgentur) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const beauftragungId = formData.get('beauftragung_id') as string | null
  const monat = formData.get('monat') as string | null // YYYY-MM-DD

  if (!file || !beauftragungId || !monat) {
    return NextResponse.json({ error: 'file, beauftragung_id und monat sind erforderlich' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei darf maximal 10 MB groß sein' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monat)) {
    return NextResponse.json({ error: 'Ungültiges Monat-Format (erwartet YYYY-MM-DD)' }, { status: 400 })
  }

  if (isAgentur) {
    const { data: bauf } = await supabase
      .from('beauftragungen')
      .select('agentur_id')
      .eq('id', beauftragungId)
      .single()
    if (!bauf || bauf.agentur_id !== profile.agentur_id) {
      return NextResponse.json({ error: 'Keine Berechtigung für diese Beauftragung' }, { status: 403 })
    }
  }

  const monthLabel = monat.slice(0, 7)
  const storagePath = `${beauftragungId}/${monthLabel}.pdf`
  const pdfBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('zeitnachweise')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Fehler beim Hochladen der Datei' }, { status: 500 })
  }

  let stundenIst: number | null = null
  let parsedRaw: unknown = null
  let parseWarning: string | null = null
  try {
    stundenIst = await extractStundenFromPDF(pdfBuffer)
  } catch (err) {
    parseWarning = err instanceof Error ? err.message : String(err)
    parsedRaw = { error: parseWarning }
  }

  const { data: record, error: dbError } = await supabase
    .from('zeitnachweise')
    .upsert(
      {
        beauftragung_id: beauftragungId,
        monat,
        stunden_ist: stundenIst,
        pdf_path: storagePath,
        parsed_raw: parsedRaw,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'beauftragung_id,monat' }
    )
    .select('id, beauftragung_id, monat, stunden_ist, uploaded_at')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  return NextResponse.json({
    zeitnachweis: record,
    ...(parseWarning ? { parse_warning: 'PDF konnte nicht automatisch ausgelesen werden. Bitte Stunden manuell eintragen.' } : {}),
  })
}
