import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── Request Schema ─────────────────────────────────────────────────────────────

const skillToAddSchema = z.union([
  z.object({ skill_name: z.string().min(1, 'Skill name required') }),
  z.object({ skill_id: z.string().uuid('Invalid UUID') }),
])

const editSkillsSchema = z.object({
  skills_to_add: z.array(skillToAddSchema).default([]),
  skills_to_remove: z.array(z.string().uuid('Invalid skill UUID')).default([]),
})

// ── Types ──────────────────────────────────────────────────────────────────────

interface SkillRecord {
  id: string
  name: string
  verified: boolean
  added_by: 'extraction' | 'manual'
}

interface ScoreResult {
  matched: number
  required: number
  percentage: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Gets user profile with authentication and authorization checks
 */
async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv, agentur_id')
    .eq('id', userId)
    .single()
  return data
}

/**
 * Gets a profile by ID with authorization check
 */
async function getProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  agencyId: string
) {
  const { data, error } = await supabase
    .from('kandidaten_profile')
    .select('id, vakanz_id, agentur_id, status')
    .eq('id', profileId)
    .single()

  if (error || !data) {
    return null
  }

  // Verify ownership (agency match)
  if (data.agentur_id !== agencyId) {
    return null
  }

  return data
}

/**
 * Finds or creates a skill by name
 * Returns the skill ID
 */
async function findOrCreateSkillByName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skillName: string
): Promise<string | null> {
  // Normalize: trim, lowercase for search
  const normalized = skillName.trim().toLowerCase()

  // Try case-insensitive exact match
  const { data: existing } = await supabase
    .from('skills')
    .select('id')
    .ilike('name', normalized)
    .single()

  if (existing) {
    return existing.id
  }

  // Skill doesn't exist - create it
  // Will be marked as "pending" for admin curation if it's not a known skill
  const { data: created, error } = await supabase
    .from('skills')
    .insert({
      name: skillName,
      category: 'Uncategorized',
      source: 'manual', // Manually added by agency
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create skill:', { name: skillName, error: error.message })
    return null
  }

  return created?.id || null
}

/**
 * Gets all skills for a profile
 */
async function getProfileSkills(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
): Promise<SkillRecord[]> {
  const { data, error } = await supabase
    .from('profile_skills')
    .select('id, skills(id, name), verified, added_by')
    .eq('profile_id', profileId)

  if (error || !data) {
    return []
  }

  return data.map((record: any) => ({
    id: record.skills?.id || record.id,
    name: record.skills?.name || '',
    verified: record.verified,
    added_by: record.added_by,
  }))
}

/**
 * Gets vacancy skills for score calculation
 * Extracts skill names from the vacancy's skills array
 */
async function getVacancySkills(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vacancyId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('vakanzen')
    .select('skills')
    .eq('id', vacancyId)
    .single()

  if (!data?.skills) {
    return []
  }

  // Assuming skills is an array of skill names or objects with 'name'
  if (Array.isArray(data.skills)) {
    return data.skills.map((s: any) => (typeof s === 'string' ? s : s.name || '')).filter(Boolean)
  }

  return []
}

/**
 * Calculates skill match score
 * Returns: { matched, required, percentage }
 */
function calculateScore(
  profileSkills: string[],
  vacancySkills: string[]
): ScoreResult {
  if (vacancySkills.length === 0) {
    return { matched: 0, required: 0, percentage: 100 }
  }

  if (profileSkills.length === 0) {
    return { matched: 0, required: vacancySkills.length, percentage: 0 }
  }

  // Normalize for case-insensitive comparison
  const profileNorm = new Set(profileSkills.map((s) => s.toLowerCase().trim()))
  const vacancyNorm = vacancySkills.map((s) => s.toLowerCase().trim())

  // Count exact matches
  let matched = 0
  for (const skill of vacancyNorm) {
    if (profileNorm.has(skill)) {
      matched++
    }
  }

  const percentage = Math.round((matched / vacancySkills.length) * 100)

  return { matched, required: vacancySkills.length, percentage }
}

/**
 * Updates profile_scores table
 */
async function updateProfileScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  vacancyId: string,
  scoreResult: ScoreResult
) {
  const { error } = await supabase.from('profile_scores').upsert(
    {
      profile_id: profileId,
      vacancy_id: vacancyId,
      matched_skills_count: scoreResult.matched,
      required_skills_count: scoreResult.required,
      score_percentage: scoreResult.percentage,
      calculated_at: new Date().toISOString(),
    },
    {
      onConflict: 'profile_id,vacancy_id',
    }
  )

  if (error) {
    console.error('Failed to update profile_scores:', { error: error.message })
  }
}

// ── PATCH /api/profiles/[id]/skills ────────────────────────────────────────────

/**
 * PATCH /api/profiles/[id]/skills
 *
 * Allows agencies to edit/add/remove skills from a candidate profile.
 *
 * Request Body:
 * {
 *   "skills_to_add": [
 *     { "skill_name": "GraphQL" } or { "skill_id": "uuid" }
 *   ],
 *   "skills_to_remove": ["skill-uuid-1", "skill-uuid-2"]
 * }
 *
 * Response:
 * {
 *   "profile_id": "uuid",
 *   "skills": [
 *     { "id": "uuid", "name": "React", "verified": true, "added_by": "manual" }
 *   ],
 *   "score": {
 *     "matched": 3,
 *     "required": 5,
 *     "percentage": 60
 *   }
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params
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

  const userProfile = await getUserProfile(supabase, user.id)
  if (!userProfile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  if (userProfile.rolle !== 'Agentur') {
    return NextResponse.json(
      { error: 'Nur Agenturen können Skills bearbeiten' },
      { status: 403 }
    )
  }

  if (!userProfile.agentur_id) {
    return NextResponse.json(
      { error: 'Ihr Account ist keiner Agentur zugeordnet' },
      { status: 403 }
    )
  }

  // ── 3. Verify Profile Ownership & Exists ────────────────────────────────────

  const profile = await getProfile(supabase, profileId, userProfile.agentur_id)
  if (!profile) {
    return NextResponse.json(
      { error: 'Profil nicht gefunden oder keine Berechtigung' },
      { status: 404 }
    )
  }

  // Profile must be in "Eingereicht" status for editing
  if (profile.status !== 'Eingereicht') {
    return NextResponse.json(
      {
        error: `Skills können nur bearbeitet werden, wenn der Status "Eingereicht" ist (aktuell: ${profile.status})`,
      },
      { status: 403 }
    )
  }

  // ── 4. Parse & Validate Request Body ────────────────────────────────────────

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige JSON' }, { status: 400 })
  }

  const parsed = editSkillsSchema.safeParse(requestBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validierungsfehler',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { skills_to_add, skills_to_remove } = parsed.data

  // ── 5. Remove Skills ────────────────────────────────────────────────────────

  if (skills_to_remove.length > 0) {
    const { error: deleteError } = await supabase
      .from('profile_skills')
      .delete()
      .eq('profile_id', profileId)
      .in('skill_id', skills_to_remove)

    if (deleteError) {
      console.error('Failed to remove skills:', { error: deleteError.message })
      return NextResponse.json(
        { error: 'Fehler beim Entfernen von Skills' },
        { status: 500 }
      )
    }
  }

  // ── 6. Add Skills ──────────────────────────────────────────────────────────

  const skillsToInsert = []

  for (const skillToAdd of skills_to_add) {
    let skillId: string | null = null

    // Determine skill ID: either provided or look up by name
    if ('skill_id' in skillToAdd) {
      skillId = skillToAdd.skill_id
    } else if ('skill_name' in skillToAdd) {
      skillId = await findOrCreateSkillByName(supabase, skillToAdd.skill_name)
    }

    if (!skillId) {
      console.error('Failed to determine skill ID', { skill: skillToAdd })
      continue // Skip this skill and continue with others
    }

    skillsToInsert.push({
      profile_id: profileId,
      skill_id: skillId,
      added_by: 'manual' as const,
      verified: true,
    })
  }

  if (skillsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('profile_skills')
      .insert(skillsToInsert)
      .onConflict((builder) => builder.columns(['profile_id', 'skill_id']))

    if (insertError) {
      console.error('Failed to insert skills:', { error: insertError.message })
      // Don't fail completely - some skills may have been added
    }
  }

  // ── 7. Get Updated Skills ──────────────────────────────────────────────────

  const updatedSkills = await getProfileSkills(supabase, profileId)

  // ── 8. Recalculate Score ──────────────────────────────────────────────────

  const vacancySkills = await getVacancySkills(supabase, profile.vakanz_id)
  const profileSkillNames = updatedSkills.map((s) => s.name)
  const scoreResult = calculateScore(profileSkillNames, vacancySkills)

  // ── 9. Update profile_scores ──────────────────────────────────────────────

  await updateProfileScore(supabase, profileId, profile.vakanz_id, scoreResult)

  // ── 10. Return Success Response ────────────────────────────────────────────

  return NextResponse.json(
    {
      profile_id: profileId,
      skills: updatedSkills,
      score: scoreResult,
    },
    { status: 200 }
  )
}
