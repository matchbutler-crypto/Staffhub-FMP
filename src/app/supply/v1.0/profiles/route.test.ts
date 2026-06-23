import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ then: (r: (v: unknown) => unknown) => mockSelect().then(r) }),
            }),
          }),
        }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

import { GET } from './route'

function makeRequest(vakanzId: string) {
  return new NextRequest(`http://localhost/supply/v1.0/profiles?vakanz=${vakanzId}`, {
    headers: { Authorization: 'Bearer test-key' },
  })
}

const mockLink = {
  id: 'lnk-1',
  status: 'Gespielt',
  ressourcen: {
    id: 'r-1',
    name: 'Anna Beispiel',
    erfahrungslevel: 'Senior',
    skills: ['Python'],
    email_geschaeftlich: 'anna@test.de',
    telefon_geschaeftlich: null,
  },
}

describe('GET /supply/v1.0/profiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 zurück wenn vakanz-Parameter fehlt', async () => {
    const res = await GET(new NextRequest('http://localhost/supply/v1.0/profiles', {
      headers: { Authorization: 'Bearer test-key' },
    }))
    expect(res.status).toBe(400)
  })

  it('gibt Profile mit AVAILABLE-Status zurück', async () => {
    mockSelect.mockResolvedValue({ data: [mockLink], error: null })
    const res = await GET(makeRequest('vak-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).toMatchObject({
      id: 'r-1', firstName: 'Anna', lastName: 'Beispiel',
      status: 'AVAILABLE', email: null, phone: null,
    })
  })

  it('liefert Kontaktdaten nur bei BOOKED', async () => {
    mockSelect.mockResolvedValue({ data: [{ ...mockLink, status: 'Beauftragt' }], error: null })
    const res = await GET(makeRequest('vak-1'))
    const json = await res.json()
    expect(json.data[0].status).toBe('BOOKED')
    expect(json.data[0].email).toBe('anna@test.de')
  })

  it('gibt 500 bei DB-Fehler zurück', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'DB-Fehler' } })
    const res = await GET(makeRequest('vak-1'))
    expect(res.status).toBe(500)
  })
})
