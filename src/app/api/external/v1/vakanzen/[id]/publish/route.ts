// src/app/api/external/v1/vakanzen/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const publishSchema = z.object({ published: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateExternalApiKey(request, 'vakanzen:update')
  if (authError) return authError

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  if (parsed.data.published === true) {
    const { data: vakanz } = await supabase
      .from('vakanzen_data')
      .select('status')
      .eq('id', id)
      .single()

    if (vakanz?.status === 'Besetzt') {
      return NextResponse.json({ error: 'Besetzte Vakanzen können nicht veröffentlicht werden' }, { status: 422 })
    }
  }

  const { data: updated, error } = await supabase
    .from('vakanzen_data')
    .update({ published: parsed.data.published })
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
  }

  return NextResponse.json({ published: parsed.data.published })
}
