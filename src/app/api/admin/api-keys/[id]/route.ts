import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const updateKeySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  aktiv: z.boolean().optional(),
  permissions: z.array(z.enum([
    'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
    'vorschlaege:read', 'vorschlaege:update', 'profile:read',
    'demand:write', 'supply:read', 'supply:write',
  ])).optional(),
}).refine(d => d.name !== undefined || d.aktiv !== undefined || d.permissions !== undefined, {
  message: 'Mindestens ein Feld muss angegeben werden',
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = updateKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('external_api_keys')
    .update(parsed.data)
    .eq('id', id)
    .select('id, name, key_preview, permissions, aktiv, last_used_at, created_at')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Key nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ key: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('external_api_keys')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
