import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateExternalApiKey } from '@/lib/external-api-auth'

const INTERNAL_TO_SUPPLY: Record<string, string> = {
  Gespielt:          'AVAILABLE',
  'Interview geplant': 'RESERVED',
  Zugesagt:          'RESERVED',
  Beauftragt:        'BOOKED',
  Abgelehnt:         'UNAVAILABLE',
  Abgesagt:          'UNAVAILABLE',
  Zurückgezogen:     'UNAVAILABLE',
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ')
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export async function GET(request: NextRequest) {
  const authError = await validateExternalApiKey(request, 'supply:read')
  if (authError) return authError

  const vakanzId = request.nextUrl.searchParams.get('vakanz')
  if (!vakanzId) {
    return NextResponse.json({ error: { code: 'MISSING_PARAM', message: 'Parameter vakanz ist Pflicht' } }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('ressource_vakanz_links')
    .select(`
      id, status,
      ressourcen!inner(id, name, erfahrungslevel, skills, email_geschaeftlich, telefon_geschaeftlich)
    `)
    .eq('vakanz_id', vakanzId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Fehler beim Laden der Profile' } }, { status: 500 })
  }

  const profiles = (data ?? []).map((link) => {
    const r = link.ressourcen as unknown as {
      id: string; name: string; erfahrungslevel: string | null
      skills: string[] | null; email_geschaeftlich: string | null; telefon_geschaeftlich: string | null
    }
    const supplyStatus = INTERNAL_TO_SUPPLY[link.status] ?? 'AVAILABLE'
    const isBooked = supplyStatus === 'BOOKED'
    const { firstName, lastName } = splitName(r.name)

    return {
      id: r.id,
      firstName,
      lastName,
      email: isBooked ? (r.email_geschaeftlich ?? null) : null,
      phone: isBooked ? (r.telefon_geschaeftlich ?? null) : null,
      status: supplyStatus,
      seniority: r.erfahrungslevel ?? null,
      skills: r.skills ?? [],
    }
  })

  return NextResponse.json({ data: profiles })
}
