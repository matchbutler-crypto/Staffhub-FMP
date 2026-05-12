import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { extractTextFromPDF, isValidPDF } from '@/lib/pdfExtraction'
import { extractSkillsFromCV } from '@/lib/ollama'
import { normalizeSkills, getMatchedSkills, getPendingSkills } from '@/lib/skillNormalization'
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
  if (profile.rolle !== 'Agentur') {
    return NextResponse.json(
      { error: 'Nur Agenturen können Profile einreichen' },
      { status: 403 }
    )
  }
  if (!profile.agentur_id) {
    return NextResponse.json(
      { error: 'Ihr Account ist keiner Agentur zugeordnet' },
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

  // Verify agency matches user's agency (only for non-pool profiles)
  if (!forPool && parsed.data.agency_id !== profile.agentur_id) {
    return NextResponse.json(
      { error: 'Sie können Profile für diese Agentur nicht einreichen' },
      { status: 403 }
    )
  }

  // For pool profiles, use user's agency
  const targetAgencyId = forPool ? profile.agentur_id : parsed.data.agency_id

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

  let cvText: string
  try {
    cvText = await extractTextFromPDF(cvBuffer)
    // Sanitize: remove invalid Unicode escape sequences and control characters
    cvText = cvText.replace(/\\u[0-9a-fA-F]{4}/g, ' ').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('PDF extraction error:', { error: errorMsg })
    // Return 400 but allow manual skill entry
    return NextResponse.json(
      {
        error: 'PDF konnte nicht verarbeitet werden',
        message: 'Sie können Skills manuell eingeben',
        extracted_skills: [],
      },
      { status: 400 }
    )
  }

  // ── 7. Extract Skills from PDF using Ollama ────────────────────────────────

  let extractedSkills: string[] = []
  try {
    extractedSkills = await extractSkillsFromCV(cvText)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('Skill extraction timeout:', { error: errorMsg })

    // Ollama timeout - return 408 with warning but allow continuation
    if (errorMsg.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'Zeitüberschreitung bei Skill-Erkennung',
          message: 'Ollama antwortet nicht rechtzeitig. Sie können Skills manuell eingeben.',
          extracted_skills: [],
        },
        { status: 408 }
      )
    }

    // Other extraction error - continue with empty skills
    console.warn('Skill extraction error (continuing):', { error: errorMsg })
    extractedSkills = []
  }

  // ── 8. Normalize Skills ────────────────────────────────────────────────────

  let normalizedSkills: Awaited<ReturnType<typeof normalizeSkills>> = []
  try {
    normalizedSkills = await normalizeSkills(extractedSkills, supabase)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('Skill normalization error:', { error: errorMsg })
    // Continue with un-normalized skills
    normalizedSkills = extractedSkills.map((skill, idx) => ({
      id: `${idx}`,
      name: skill,
      category: 'Uncategorized',
      matched: false,
      matchType: 'pending' as const,
    }))
  }

  const matchedSkills = getMatchedSkills(normalizedSkills)
  const pendingSkills = getPendingSkills(normalizedSkills)

  // ── 9. Calculate Initial Score ─────────────────────────────────────────────

  const scoreResult = calculateInitialScore({
    extractedSkills: normalizedSkills.map((s) => s.name),
    vacancySkills: vacancy.skills || [],
    extractedLevel: 'Mid', // Will be updated from detailed Ollama evaluation
    vacancyLevel: vacancy.erfahrungslevel || 'Junior',
    cvLength: cvText.length,
  })

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
      skills: normalizedSkills.map((s) => s.name),
      erfahrungslevel: 'Mid',
      profiltext: cvText.slice(0, 2000),
      cv_pfad: cvStoragePath,
      status: 'Eingereicht',
      ki_score: scoreResult.initialScore,
    })
    .select('*')
    .single()

  if (insertError) {
    console.error('Profile insert error:', { code: insertError.code, message: insertError.message })
    await supabase.storage.from('cv-uploads').remove([cvStoragePath])
    return NextResponse.json(
      { error: 'STEP_INSERT: ' + insertError.message },
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
        ki_score: scoreResult.initialScore,
        confidence: scoreResult.confidence,
        cv_length: cvText.length,
      },
    },
    { status: 201 }
  )
}
