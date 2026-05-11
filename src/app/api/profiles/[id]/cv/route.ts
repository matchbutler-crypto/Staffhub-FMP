import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Get user profile with role and active status
 */
async function getUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', userId)
    .single()
  return data
}

/**
 * Get profile by ID with CV file path
 */
async function getProfileById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
) {
  const { data } = await supabase
    .from('kandidaten_profile')
    .select('id, cv_pfad, kandidatenname')
    .eq('id', profileId)
    .single()
  return data
}

// ── GET /api/profiles/[id]/cv ──────────────────────────────────────────────────

/**
 * GET /api/profiles/[id]/cv
 *
 * Download CV as signed URL (24-hour expiry).
 * Only "Staffhub Manager" and "Admin" roles are authorized.
 *
 * Response:
 * ```json
 * {
 *   "download_url": "https://...",
 *   "expires_in_hours": 24
 * }
 * ```
 *
 * Error responses:
 * - 401: Not authenticated
 * - 403: Not authorized (not Staffhub Manager / Admin, or inactive)
 * - 404: Profile not found
 * - 400: Profile has no CV uploaded
 * - 500: Storage error
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // ── 1. Authenticate User ──────────────────────────────────────────────────────

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // ── 2. Verify User Role & Active Status ────────────────────────────────────────

  const userProfile = await getUserProfile(supabase, user.id)

  if (!userProfile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  // Only Staffhub Manager and Admin can download CVs
  const isAuthorized =
    userProfile.rolle === 'Staffhub Manager' || userProfile.rolle === 'Admin'

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Nur Staffhub Manager dürfen CVs herunterladen' },
      { status: 403 }
    )
  }

  // ── 3. Get Profile & Validate CV ────────────────────────────────────────────────

  const profile = await getProfileById(supabase, id)

  if (!profile) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

  if (!profile.cv_pfad) {
    return NextResponse.json(
      { error: 'Dieses Profil hat keinen hochgeladenen Lebenslauf' },
      { status: 400 }
    )
  }

  // ── 4. Generate Signed URL ────────────────────────────────────────────────────

  const SIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60 // 24 hours

  const { data: signedUrl, error: storageError } =
    await supabase.storage
      .from('cv-uploads')
      .createSignedUrl(profile.cv_pfad, SIGNED_URL_EXPIRY_SECONDS)

  if (storageError || !signedUrl?.signedUrl) {
    console.error('Storage signed URL error:', {
      error: storageError?.message,
      path: profile.cv_pfad,
    })
    return NextResponse.json(
      { error: 'Fehler beim Generieren der Download-URL' },
      { status: 500 }
    )
  }

  // ── 5. Return Response ─────────────────────────────────────────────────────────

  const response = NextResponse.json(
    {
      download_url: signedUrl.signedUrl,
      expires_in_hours: 24,
      candidate_name: profile.kandidatenname,
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )

  return response
}
