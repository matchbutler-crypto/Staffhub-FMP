import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_KEYS } from '@/lib/features'

const schema = z.object({
  feature_key: z.enum(FEATURE_KEYS as unknown as [string, ...string[]]),
  titel: z.string().min(1).max(200),
  beschreibung: z.string().optional(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || (profile.rolle !== 'Admin' && profile.rolle !== 'Staffhub Manager')) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('release_notes')
    .insert({
      feature_key: parsed.data.feature_key,
      title: parsed.data.titel,
      body: parsed.data.beschreibung ?? '',
      roles: ['Agentur'],
      datum: parsed.data.datum ?? today,
    })
    .select('id, feature_key, title, body, datum')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 })
  }

  return NextResponse.json({ release_note: data }, { status: 201 })
}
