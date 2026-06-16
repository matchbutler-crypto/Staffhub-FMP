import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockLinkSelect, mockLinkUpdate } = vi.hoisted(() => ({
  mockLinkSelect: vi.fn(),
  mockLinkUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockLinkSelect }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockLinkUpdate }),
        }),
      }),
    })),
  })),
}))

vi.mock('@/lib/external-api-auth', () => ({
  validateExternalApiKey: vi.fn(() => null),
}))

import { PATCH } from './route'

function makeRequest(vakanzId: string, linkId: string, body: unknown) {
  return new NextRequest(
    `http://localhost/api/external/v1/vakanzen/${vakanzId}/kandidaten/${linkId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
      body: JSON.stringify(body),
    }
  )
}

describe('PATCH /api/external/v1/vakanzen/[id]/kandidaten/[linkId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei ungültigem Status zurück', async () => {
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Beauftragt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Link nicht gefunden', async () => {
    mockLinkSelect.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Zugesagt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(404)
  })

  it('setzt Status auf Zugesagt', async () => {
    mockLinkSelect.mockResolvedValue({ data: { id: 'link-1', status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', status: 'Zugesagt' }, error: null,
    })
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Zugesagt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Zugesagt')
  })

  it('setzt Status auf Abgelehnt', async () => {
    mockLinkSelect.mockResolvedValue({ data: { id: 'link-1', status: 'Gespielt' }, error: null })
    mockLinkUpdate.mockResolvedValue({
      data: { id: 'link-1', status: 'Abgelehnt' }, error: null,
    })
    const res = await PATCH(
      makeRequest('v1', 'link-1', { status: 'Abgelehnt' }),
      { params: Promise.resolve({ id: 'v1', linkId: 'link-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.link.status).toBe('Abgelehnt')
  })
})
