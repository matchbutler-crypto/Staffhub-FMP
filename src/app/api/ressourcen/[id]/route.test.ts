import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetUser,
  mockProfileSelect,
  mockRessourceSingle,
  mockRessourceLinksSelect,
  mockLinksSelect,
  mockBeauftragungenSelect,
  mockVakanzenSelect,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockRessourceSingle: vi.fn(),
  mockRessourceLinksSelect: vi.fn(),
  mockLinksSelect: vi.fn(),
  mockBeauftragungenSelect: vi.fn(),
  mockVakanzenSelect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSelect }),
          }),
        }
      }
      if (table === 'ressourcen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockRessourceSingle }),
          }),
        }
      }
      if (table === 'ressource_vakanz_links') {
        return {
          select: mockRessourceLinksSelect.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                  mockLinksSelect().then(resolve, reject),
              }),
            }),
          }),
        }
      }
      if (table === 'beauftragungen') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                mockBeauftragungenSelect().then(resolve, reject),
            }),
          }),
        }
      }
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                mockVakanzenSelect().then(resolve, reject),
            }),
          }),
        }
      }
      return {}
    }),
  }),
}))

import { GET } from './route'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/ressourcen/res-1', { method: 'GET' })
}

describe('GET /api/ressourcen/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRessourceLinksSelect.mockClear()
    mockVakanzenSelect.mockResolvedValue({ data: [], error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockProfileSelect.mockResolvedValue({
      data: { rolle: 'Agentur', aktiv: true, agentur_id: 'ag-1' },
      error: null,
    })
    mockRessourceSingle.mockResolvedValue({
      data: {
        id: 'res-1',
        agentur_id: 'ag-1',
        name: 'Max M.',
        verfuegbarkeit: 'Jetzt verfügbar',
        created_at: '2026-05-25T00:00:00Z',
        updated_at: '2026-05-25T00:00:00Z',
        agenturen: { name: 'Agentur A' },
      },
      error: null,
    })
  })

  it('returns beauftragungen fallback from links when beauftragungen table is empty', async () => {
    mockLinksSelect.mockResolvedValue({
      data: [
        {
          id: 'link-1',
          status: 'Beauftragt',
          created_at: '2026-05-25T10:00:00Z',
          vakanz_id: 'vak-1',
          vakanzen_data: { id: 'vak-1', vakanz_nr: 'V-100', titel: 'React Dev', rolle: 'Developer', agenturen: { name: 'Agentur A' } },
        },
      ],
      error: null,
    })
    mockBeauftragungenSelect.mockResolvedValue({ data: [], error: null })

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.beauftragungen).toHaveLength(1)
    expect(body.beauftragungen[0]).toMatchObject({
      vakanz_nr: 'V-100',
      vakanz_titel: 'React Dev',
      status: 'Beauftragt',
      agentur_name: 'Agentur A',
    })
  })

  it('does not request unsupported agenturen relation from vakanzen_data for beauftragungen tab', async () => {
    mockLinksSelect.mockResolvedValue({
      data: [
        {
          id: 'link-1',
          status: 'Beauftragt',
          created_at: '2026-05-25T10:00:00Z',
          vakanz_id: 'vak-1',
          vakanzen_data: { id: 'vak-1', vakanz_nr: 'V-100', titel: 'React Dev', rolle: 'Developer' },
        },
      ],
      error: null,
    })
    mockBeauftragungenSelect.mockResolvedValue({ data: [], error: null })

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    const linkSelect = mockRessourceLinksSelect.mock.calls[0]?.[0] as string
    expect(linkSelect).not.toContain('agenturen')
  })

  it('falls back to minimal links query when nested vakanz join fails', async () => {
    mockLinksSelect
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'missing relation for vakanzen_data' },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'link-1',
            status: 'Beauftragt',
            created_at: '2026-05-25T10:00:00Z',
            vakanz_id: 'vak-1',
          },
        ],
        error: null,
      })
    mockBeauftragungenSelect.mockResolvedValue({ data: [], error: null })

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'res-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.beauftragungen).toHaveLength(1)
    expect(body.beauftragungen[0]).toMatchObject({
      status: 'Beauftragt',
    })
  })
})
