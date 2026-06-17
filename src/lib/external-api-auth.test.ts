import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSelect = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSelect }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ then: vi.fn() }),
      }),
    })),
  })),
}))

import { generateApiKey, validateExternalApiKey } from './external-api-auth'

function makeRequest(key?: string) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen', {
    headers: key ? { 'x-api-key': key } : {},
  })
}

describe('generateApiKey', () => {
  it('erzeugt Key mit sfhub_-Prefix und 32 Hex-Zeichen', () => {
    const { plaintext, hash, preview } = generateApiKey()
    expect(plaintext).toMatch(/^sfhub_[a-f0-9]{32}$/)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(preview).toHaveLength(8)
    expect(plaintext.endsWith(preview)).toBe(true)
  })

  it('erzeugt bei jedem Aufruf einen anderen Key', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.plaintext).not.toBe(b.plaintext)
  })
})

describe('validateExternalApiKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück wenn kein x-api-key Header vorhanden', async () => {
    const res = await validateExternalApiKey(makeRequest(), 'vakanzen:read')
    expect(res?.status).toBe(401)
  })

  it('gibt 401 zurück wenn Key nicht in DB vorhanden', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const res = await validateExternalApiKey(makeRequest('sfhub_invalid'), 'vakanzen:read')
    expect(res?.status).toBe(401)
  })

  it('gibt 401 zurück wenn Key inaktiv', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'k1', permissions: ['vakanzen:read'], aktiv: false },
      error: null,
    })
    const res = await validateExternalApiKey(makeRequest('sfhub_abc'), 'vakanzen:read')
    expect(res?.status).toBe(401)
  })

  it('gibt 403 zurück wenn Permission fehlt', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'k1', permissions: ['vakanzen:read'], aktiv: true },
      error: null,
    })
    const res = await validateExternalApiKey(makeRequest('sfhub_abc'), 'vakanzen:create')
    expect(res?.status).toBe(403)
  })

  it('gibt null zurück bei gültigem Key mit korrekter Permission', async () => {
    mockSelect.mockResolvedValue({
      data: { id: 'k1', permissions: ['vakanzen:read', 'vakanzen:create'], aktiv: true },
      error: null,
    })
    const res = await validateExternalApiKey(makeRequest('sfhub_abc'), 'vakanzen:read')
    expect(res).toBeNull()
  })
})
