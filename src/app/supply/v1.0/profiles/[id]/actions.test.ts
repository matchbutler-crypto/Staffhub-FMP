import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockLinkSelect, mockLinkUpdate, mockVakanzSelect,
  mockRessourceSelect, mockHistorieInsert, mockRessourceUpdate,
  mockVakanzUpdate, mockLinkCount,
} = vi.hoisted(() => ({
  mockLinkSelect:     vi.fn(),
  mockLinkUpdate:     vi.fn(),
  mockVakanzSelect:   vi.fn(),
  mockRessourceSelect: vi.fn(),
  mockHistorieInsert: vi.fn(),
  mockRessourceUpdate: vi.fn(),
  mockVakanzUpdate:   vi.fn(),
  mockLinkCount:      vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'ressource_vakanz_links') return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockLinkSelect,
        then: (r: (v: unknown) => unknown) => mockLinkCount().then(r),
      }
      if (table === 'vakanzen') return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockVakanzSelect,
      }
      if (table === 'ressourcen') return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockRessourceSelect,
      }
      if (table === 'ressource_historie') return { insert: mockHistorieInsert }
      return {}
    }),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/magenta-webhook', () => ({
  sendProfileUpdated: vi.fn().mockResolvedValue(undefined),
}))

import { POST as reserve } from './reserve/route'
import { POST as book }    from './book/route'
import { POST as cancel }  from './cancel/route'
import { sendProfileUpdated } from '@/lib/magenta-webhook'

function makeRequest(profileId: string, vakanzId: string, routeSuffix: string) {
  return new NextRequest(`http://localhost/supply/v1.0/profiles/${profileId}/${routeSuffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
    body: JSON.stringify({ vakanzId }),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const gespielterLink = { id: 'lnk-1', status: 'Gespielt' }
const beauftragtLink = { id: 'lnk-1', status: 'Beauftragt' }
const interviewLink  = { id: 'lnk-1', status: 'Interview geplant' }
const vakanz = { id: 'vak-1', rolle: 'Senior Dev', enddatum: '2027-01-31', fte_anzahl: 1, status: 'Offen' }
const ressource = { id: 'r-1', name: 'Anna Beispiel', email_geschaeftlich: 'anna@test.de', telefon_geschaeftlich: null }

describe('POST reserve', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 404 zurück wenn Link nicht gefunden', async () => {
    mockLinkSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await reserve(makeRequest('r-1', 'vak-1', 'reserve'), params('r-1'))
    expect(res.status).toBe(404)
  })

  it('gibt 409 zurück wenn bereits Beauftragt', async () => {
    mockLinkSelect.mockResolvedValue({ data: beauftragtLink, error: null })
    const res = await reserve(makeRequest('r-1', 'vak-1', 'reserve'), params('r-1'))
    expect(res.status).toBe(409)
  })

  it('setzt Status auf Interview geplant und gibt RESERVED zurück', async () => {
    mockLinkSelect.mockResolvedValue({ data: gespielterLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: { id: 'lnk-1' }, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await reserve(makeRequest('r-1', 'vak-1', 'reserve'), params('r-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'r-1', status: 'RESERVED' })
  })
})

describe('POST book', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 409 zurück wenn bereits Beauftragt', async () => {
    mockLinkSelect.mockResolvedValue({ data: beauftragtLink, error: null })
    const res = await book(makeRequest('r-1', 'vak-1', 'book'), params('r-1'))
    expect(res.status).toBe(409)
  })

  it('setzt Beauftragt, schreibt Historie, feuert Webhook', async () => {
    mockLinkSelect.mockResolvedValue({ data: interviewLink, error: null })
    mockVakanzSelect.mockResolvedValue({ data: vakanz, error: null })
    mockRessourceSelect.mockResolvedValue({ data: ressource, error: null })
    mockLinkUpdate.mockResolvedValue({ data: {}, error: null })
    mockRessourceUpdate.mockResolvedValue({ error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    mockVakanzUpdate.mockResolvedValue({ error: null })
    mockLinkCount.mockResolvedValue({ count: 1, error: null })

    const res = await book(makeRequest('r-1', 'vak-1', 'book'), params('r-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'r-1', status: 'BOOKED' })
    expect(sendProfileUpdated).toHaveBeenCalledWith(
      'vak-1',
      expect.objectContaining({ id: 'r-1' }),
      'BOOKED'
    )
  })
})

describe('POST cancel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 409 zurück wenn bereits Beauftragt (gesperrt)', async () => {
    mockLinkSelect.mockResolvedValue({ data: beauftragtLink, error: null })
    const res = await cancel(makeRequest('r-1', 'vak-1', 'cancel'), params('r-1'))
    expect(res.status).toBe(409)
  })

  it('setzt Status auf Abgelehnt und gibt UNAVAILABLE zurück', async () => {
    mockLinkSelect.mockResolvedValue({ data: gespielterLink, error: null })
    mockLinkUpdate.mockResolvedValue({ data: {}, error: null })
    mockHistorieInsert.mockResolvedValue({ error: null })
    const res = await cancel(makeRequest('r-1', 'vak-1', 'cancel'), params('r-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'r-1', status: 'UNAVAILABLE' })
  })
})
