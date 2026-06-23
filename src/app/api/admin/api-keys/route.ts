import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateApiKey, type ApiPermission } from '@/lib/external-api-auth'

const VALID_PERMISSIONS: ApiPermission[] = [
  'vakanzen:read',
  'vakanzen:create',
  'vakanzen:update',
  'vorschlaege:read',
  'vorschlaege:update',
  'profile:read',
  'demand:write',
  'supply:read',
  'supply:write',
]

const createKeySchema = z.object({
  name: z.string().min(1).max(200),
  permissions: z.array(z.enum([
    'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
    'vorschlaege:read', 'vorschlaege:update', 'profile:read',
    'demand:write', 'supply:read', 'supply:write',
  ])).min(1),
})

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, name, key_preview, permissions, aktiv, last_used_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { plaintext, hash, preview } = generateApiKey()
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('external_api_keys')
    .insert({
      name: parsed.data.name,
      key_hash: hash,
      key_preview: preview,
      permissions: parsed.data.permissions,
    })
    .select('id, name, key_preview, permissions, aktiv, last_used_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 })

  return NextResponse.json({ key: data, plaintext_key: plaintext }, { status: 201 })
}
