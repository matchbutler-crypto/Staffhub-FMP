import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Skill {
  id: string
  name: string
  verified: boolean
  added_by: 'extraction' | 'manual'
}

// ── GET /api/skills ──────────────────────────────────────────────────────────

/**
 * GET /api/skills
 *
 * Fetches all available skills for the skill editor autocomplete.
 * Only authenticated agencies can access this endpoint.
 *
 * Query Parameters:
 * - search: Optional search string to filter skills (case-insensitive)
 * - limit: Optional limit on number of results (default: 100)
 *
 * Response:
 * {
 *   "skills": [
 *     { "id": "uuid", "name": "React", "verified": true, "added_by": "extraction" },
 *     { "id": "uuid", "name": "TypeScript", "verified": true, "added_by": "manual" }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
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

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!userProfile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  if (userProfile.rolle !== 'Agentur') {
    return NextResponse.json(
      { error: 'Nur Agenturen können Skills abrufen' },
      { status: 403 }
    )
  }

  // ── 3. Parse Query Parameters ───────────────────────────────────────────────

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const limitStr = searchParams.get('limit') || '100'
  const limit = Math.min(parseInt(limitStr, 10), 500) // Cap at 500

  // ── 4. Query Skills from Database ──────────────────────────────────────────

  let query = supabase.from('skills').select('id, name').limit(limit)

  // Add search filter if provided
  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  const { data: skillsData, error: skillsError } = await query

  if (skillsError) {
    console.error('Failed to fetch skills:', { error: skillsError.message })
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Skills' },
      { status: 500 }
    )
  }

  // ── 5. Format Response ──────────────────────────────────────────────────────

  const skills: Skill[] = (skillsData || []).map((skill: any) => ({
    id: skill.id,
    name: skill.name,
    verified: true, // Skills from the database are considered verified
    added_by: 'manual' as const, // Database skills are manually curated
  }))

  return NextResponse.json({ skills }, { status: 200 })
}
