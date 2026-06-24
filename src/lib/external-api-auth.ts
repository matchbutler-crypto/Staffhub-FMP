import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type ApiPermission =
  | 'vakanzen:read'
  | 'vakanzen:create'
  | 'vakanzen:update'
  | 'vorschlaege:read'
  | 'vorschlaege:update'
  | 'profile:read'
  | 'demand:write'
  | 'supply:read'
  | 'supply:write'
  | 'agency:positions:read'
  | 'agency:profiles:write'
  | 'agency:profiles:read'

export function generateApiKey(): { plaintext: string; hash: string; preview: string } {
  const plaintext = 'sfhub_' + randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(plaintext).digest('hex')
  const preview = plaintext.slice(-8)
  return { plaintext, hash, preview }
}

export async function validateExternalApiKey(
  request: NextRequest,
  permission: ApiPermission
): Promise<NextResponse | null> {
  const authHeader = request.headers.get('authorization')
  const key = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
           ?? request.headers.get('x-api-key')
  if (!key) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const hash = createHash('sha256').update(key).digest('hex')
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, permissions, aktiv')
    .eq('key_hash', hash)
    .single()

  if (error || !data || !data.aktiv) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  if (!(data.permissions as string[]).includes(permission)) {
    return NextResponse.json({ error: 'Fehlende Berechtigung' }, { status: 403 })
  }

  // Fire-and-forget: Letzten Zugriff aktualisieren
  supabase
    .from('external_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {})

  return null
}

// Gibt agencyId zurück wenn Key gültig und permission gesetzt.
// Gibt NextResponse-Fehler zurück wenn nicht.
export async function validateAgencyKey(
  request: NextRequest,
  permission: ApiPermission
): Promise<{ agencyId: string; error: null } | { agencyId: null; error: NextResponse }> {
  const authHeader = request.headers.get('authorization')
  const key = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
           ?? request.headers.get('x-api-key')
  if (!key) {
    return { agencyId: null, error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) }
  }

  const hash = createHash('sha256').update(key).digest('hex')
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, permissions, aktiv, agentur_id')
    .eq('key_hash', hash)
    .single()

  if (error || !data || !data.aktiv) {
    return { agencyId: null, error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) }
  }

  if (!(data.permissions as string[]).includes(permission)) {
    return { agencyId: null, error: NextResponse.json({ error: 'Fehlende Berechtigung' }, { status: 403 }) }
  }

  if (!data.agentur_id) {
    return { agencyId: null, error: NextResponse.json({ error: 'API-Key nicht einer Agentur zugeordnet' }, { status: 403 }) }
  }

  // Fire-and-forget: last_used_at
  supabase
    .from('external_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {})

  return { agencyId: data.agentur_id as string, error: null }
}
