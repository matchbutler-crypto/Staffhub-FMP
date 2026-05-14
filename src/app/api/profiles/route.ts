import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const maxDuration = 60
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { extractTextFromPDF, isValidPDF } from '@/lib/pdfExtraction'
import { normalizeSkills, extractAndNormalizeFromText, getMatchedSkills, getPendingSkills } from '@/lib/skillNormalization'
import { extractSkillsFromCVBuffer, bewerteProfilMitOpenAI } from '@/lib/openai'
import { calculateInitialScore } from '@/lib/calculateScore'

// ── Request Schema ─────────────────────────────────────────────────────────────

const createProfileSchema = z.object({
  vacancy_id: z.string().uuid('Ungültige Vakanz-ID').optional(),
  agency_id: z.string().uuid('Ungültige Agentur-ID').optional(),
  candidate_name: z.string().min(1, 'Name ist erforderlich').max(200),
  for_pool: z.string().optional(),
  availability: z.string().optional(),
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

async function getVacancy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vacancyId: string
) {
  const { data } = await supabase.from('vakanzen').select('id, titel, beschreibung, skills, erfahrungslevel, status').eq('id', vacancyId).single()
  return data
}

// ── POST /api/profiles ────────────────────────────────────────────────────

/**
 * POST /api/profiles
 *
 * Handles CV upload and skill extraction for a candidate profile.
 *
 * Request Body (multipart/form-data):
 * - vacancy_id: UUID of the vacancy
 * - agency_id: UUID of the agency (for authorization)
 * - candidate_name: Full name of candidate
 * - file: PDF file (max 10MB)
 *
 * Response: Profile record with extracted skills
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // ── 1. Authenticate User ────────────────────────────────────────────────────

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // ── 2. Verify User Profile & Authorization ──────────────────────────────────

  const profile = await getUserProfile(supabase, user.id)
  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const isManagerOrAdmin = profile.rolle === 'Admin' || profile.rolle === 'Staffhub Manager'

  // Agencies always allowed; managers/admins only for pool uploads
  // (vacancy-specific profiles still require Agentur)
  if (profile.rolle !== 'Agentur' && !isManagerOrAdmin) {
    return NextResponse.json(
      { error: 'Keine Berechtigung' },
      { status: 403 }
    )
  }

  // ── 3. Parse & Validate Request Body ────────────────────────────────────────

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Formulardaten' }, { status: 400 })
  }

  const forPool = formData.get('for_pool') === 'true'

  // Managers/admins can only use this endpoint for pool uploads
  if (isManagerOrAdmin && !forPool) {
    return NextResponse.json(
      { error: 'Nur Agenturen können Profile zu Vakanzen einreichen' },
      { status: 403 }
    )
  }

  if (profile.rolle === 'Agentur' && !profile.agentur_id) {
    return NextResponse.json(
      { error: 'Ihr Account ist keiner Agentur zugeordnet' },
      { status: 403 }
    )
  }

  const bodyRaw = {
    vacancy_id: forPool ? undefined : formData.get('vacancy_id'),
    agency_id: forPool ? undefined : formData.get('agency_id'),
    candidate_name: formData.get('candidate_name'),
    for_pool: formData.get('for_pool'),
    availability: formData.get('availability'),
  }

  const parsed = createProfileSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Verify agency matches user's agency (only for non-pool Agentur profiles)
  if (!forPool && profile.rolle === 'Agentur' && parsed.data.agency_id !== profile.agentur_id) {
    return NextResponse.json(
      { error: 'Sie können Profile für diese Agentur nicht einreichen' },
      { status: 403 }
    )
  }

  // For pool: manager/admin pass agentur_id via form; Agentur uses their own
  const managerAgenturId = forPool ? (formData.get('agentur_id') as string | null) : null
  const targetAgencyId = forPool
    ? (isManagerOrAdmin ? managerAgenturId : profile.agentur_id)
    : parsed.data.agency_id

  // ── 4. Validate & Extract File ──────────────────────────────────────────────

  const cvFile = formData.get('file') as File | null
  if (!cvFile || cvFile.size === 0) {
    return NextResponse.json(
      { error: 'Lebenslauf (PDF) ist erforderlich' },
      { status: 400 }
    )
  }

  // Validate file type
  if (cvFile.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }

  // Validate file size (10MB limit)
  const MAX_FILE_SIZE = 10 * 1024 * 1024
  if (cvFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Datei darf maximal 10 MB groß sein' },
      { status: 413 }
    )
  }

  // Validate PDF magic bytes
  const cvBuffer = await cvFile.arrayBuffer()
  if (!isValidPDF(cvBuffer)) {
    return NextResponse.json(
      { error: 'Ungültige PDF-Datei' },
      { status: 400 }
    )
  }

  // ── 5. Get Vacancy Details (skip for pool) ────────────────────────────────

  let vacancy
  if (!forPool) {
    vacancy = await getVacancy(supabase, parsed.data.vacancy_id!)
    if (!vacancy) {
      return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    }
    if (vacancy.status !== 'Offen') {
      return NextResponse.json({ error: 'Diese Vakanz ist nicht mehr offen' }, { status: 409 })
    }
  } else {
    // Dummy vacancy for pool profiles
    vacancy = {
      id: 'pool',
      titel: 'Ressourcen Pool',
      beschreibung: 'Allgemeiner Pool',
      skills: [],
      erfahrungslevel: 'Mid',
      status: 'Offen',
    }
  }

  // ── 6. Extract PDF Text ────────────────────────────────────────────────────

  let cvText = ''
  try {
    cvText = await extractTextFromPDF(cvBuffer)
    // Sanitize: remove invalid Unicode escape sequences and control characters
    cvText = cvText.replace(/\\u[0-9a-fA-F]{4}/g, ' ').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('PDF extraction warning - continuing with empty text:', { error: errorMsg })
    // Don't bail – OpenAI can still extract skills directly from the buffer
  }

  // ── 7. Extract Skills via OpenAI, then normalize against DB ─────────────────

  let normalizedSkills: Awaited<ReturnType<typeof extractAndNormalizeFromText>> = []
  try {
    if (process.env.OPENAI_API_KEY) {
      const rawSkills = await extractSkillsFromCVBuffer(cvBuffer)
      normalizedSkills = await normalizeSkills(rawSkills, supabase)
    } else {
      normalizedSkills = await extractAndNormalizeFromText(cvText, supabase)
    }
  } catch (error) {
    console.error('Skill extraction error:', error)
    try {
      normalizedSkills = await extractAndNormalizeFromText(cvText, supabase)
    } catch {
      normalizedSkills = []
    }
  }

  const matchedSkills = getMatchedSkills(normalizedSkills)
  const pendingSkills = getPendingSkills(normalizedSkills)

  // ── 9. Calculate KI-based Score with OpenAI ───────────────────────────────

  let kiScore = 0
  let kiDetails: Record<string, unknown> | null = null

  if (!forPool && process.env.OPENAI_API_KEY) {
    try {
      const kiBewertung = await bewerteProfilMitOpenAI(
        {
          titel: vacancy.titel || 'Unbekannt',
          beschreibung: vacancy.beschreibung ?? '',
          skills: vacancy.skills ?? [],
          erfahrungslevel: vacancy.erfahrungslevel || 'Mid',
        },
        {
          kandidatenname: parsed.data.candidate_name,
          skills: normalizedSkills.map((s) => s.name),
          erfahrungslevel: 'Mid',
          profiltext: cvText.slice(0, 2000),
        }
      )
      kiScore = kiBewertung.score
      kiDetails = {
        empfehlung: kiBewertung.empfehlung,
        begruendung: kiBewertung.begruendung,
        skill_vorhanden: kiBewertung.skill_vorhanden,
        skill_fehlend: kiBewertung.skill_fehlend,
        model: kiBewertung.model,
      }
    } catch (error) {
      console.error('KI-Scoring error:', error)
      const scoreResult = calculateInitialScore({
        extractedSkills: normalizedSkills.map((s) => s.name),
        vacancySkills: vacancy.skills || [],
        extractedLevel: 'Mid',
        vacancyLevel: vacancy.erfahrungslevel || 'Junior',
        cvLength: cvText.length,
      })
      kiScore = scoreResult.initialScore
    }
  } else {
    const scoreResult = calculateInitialScore({
      extractedSkills: normalizedSkills.map((s) => s.name),
      vacancySkills: vacancy.skills || [],
      extractedLevel: 'Mid',
      vacancyLevel: vacancy.erfahrungslevel || 'Junior',
      cvLength: cvText.length,
    })
    kiScore = scoreResult.initialScore
  }

  // ── 10. Upload PDF to Storage ──────────────────────────────────────────────

  const profileId = uuidv4()
  const cvStoragePath = `agencies/${targetAgencyId}/${profileId}/cv.pdf`

  const { error: uploadError } = await supabase.storage
    .from('cv-uploads')
    .upload(cvStoragePath, cvBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    console.error('CV upload error:', { error: uploadError.message, path: cvStoragePath })
    return NextResponse.json(
      { error: 'STEP_STORAGE: ' + uploadError.message },
      { status: 500 }
    )
  }

  // ── 11. Create Kandidaten Profile Record ────────────────────────────────────

  const skillsArray = normalizedSkills
    .map((s) => s.name)
    .filter(Boolean)
    .slice(0, 30) // Max 30 skills per DB constraint

  const { data: newProfile, error: insertError } = await supabase
    .from('kandidaten_profile')
    .insert({
      id: profileId,
      vakanz_id: forPool ? null : parsed.data.vacancy_id,
      agentur_id: targetAgencyId,
      kandidatenname: parsed.data.candidate_name,
      verfuegbarkeit_stunden: parsed.data.availability ? parseInt(parsed.data.availability, 10) : null,
      verfuegbar_ab: null,
      verkaufspreis: null,
      skills: skillsArray,
      erfahrungslevel: 'Mid',
      profiltext: cvText.slice(0, 2000),
      cv_pfad: cvStoragePath,
      status: 'Eingereicht',
      ki_score: kiScore,
    })
    .select('*')
    .single()

  if (insertError) {
    console.error('Profile insert error:', { code: insertError.code, message: insertError.message, skillsArray, normalizedSkillsCount: normalizedSkills.length })
    await supabase.storage.from('cv-uploads').remove([cvStoragePath])
    return NextResponse.json(
      { error: insertError.message, code: insertError.code },
      { status: 500 }
    )
  }

  // ── 12. Insert profile_skills records ──────────────────────────────────────

  const profileSkillsRecords = normalizedSkills
    .filter((skill) => skill.id) // Only insert skills with valid IDs
    .map((skill) => ({
      profile_id: profileId,
      skill_id: skill.id,
      added_by: 'extraction',
      verified: false,
    }))

  if (profileSkillsRecords.length > 0) {
    const { error: skillsError } = await supabase
      .from('profile_skills')
      .insert(profileSkillsRecords)

    if (skillsError) {
      console.error('Profile skills insert error:', { code: skillsError.code, message: skillsError.message })
      // Don't fail - skills can be added manually or during review
    }
  }

  // ── 13. Return Success Response ────────────────────────────────────────────

  return NextResponse.json(
    {
      profile: {
        ...newProfile,
        extracted_skills: normalizedSkills.map((s) => ({
          name: s.name,
          category: s.category,
          matchType: s.matchType || 'unknown',
        })),
        matched_skills: matchedSkills.length,
        pending_skills: pendingSkills.length,
        ki_score: kiScore,
        ki_details: kiDetails,
        cv_length: cvText.length,
      },
    },
    { status: 201 }
  )
}
