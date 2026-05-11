import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Skill {
  id: string
  name: string
  verified: boolean
  added_by: 'extraction' | 'manual'
}

interface ProfileResponse {
  id: string
  kandidatenname: string
  skills: Skill[]
  status: string
  vakanz_id: string
  agentur_id: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
    .select('id, vakanz_id, agentur_id, status, kandidatenname')
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
 * Gets all skills for a profile
 */
async function getProfileSkills(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
): Promise<Skill[]> {
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

// ── GET /api/profiles/[id] ────────────────────────────────────────────────────

/**
 * GET /api/profiles/[id]
 *
 * Fetches a candidate profile by ID with all associated skills.
 *
 * Response:
 * {
 *   "id": "uuid",
 *   "kandidatenname": "John Doe",
 *   "status": "Eingereicht",
 *   "vakanz_id": "uuid",
 *   "skills": [
 *     { "id": "uuid", "name": "React", "verified": true, "added_by": "extraction" }
 *   ]
 * }
 */
export async function GET(
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
      { error: 'Nur Agenturen können Profile abrufen' },
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

  // ── 4. Get Profile Skills ───────────────────────────────────────────────────

  const skills = await getProfileSkills(supabase, profileId)

  // ── 5. Return Success Response ──────────────────────────────────────────────

  const response: ProfileResponse = {
    id: profile.id,
    kandidatenname: profile.kandidatenname,
    status: profile.status,
    vakanz_id: profile.vakanz_id,
    agentur_id: profile.agentur_id,
    skills,
  }

  return NextResponse.json(response, { status: 200 })
}
