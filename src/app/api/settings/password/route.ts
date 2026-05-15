import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
  newPassword: z.string().min(8, 'Mindestens 8 Zeichen'),
})

// ── POST /api/settings/password ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('aktiv')
    .eq('id', user.id)
    .single()

  if (!profile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }

  const email = user.email
  if (!email) {
    return NextResponse.json({ error: 'E-Mail nicht gefunden' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  })

  if (signInError) {
    return NextResponse.json({ error: 'Aktuelles Passwort ist falsch' }, { status: 400 })
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })

  if (updateError) {
    return NextResponse.json({ error: `Fehler beim Ändern: ${updateError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
