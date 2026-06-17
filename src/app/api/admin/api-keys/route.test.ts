import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn(),
  }),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/external-api-auth', () => ({
  generateApiKey: vi.fn().mockReturnValue({
    plaintext: 'sfhub_test',
    hash: 'abc123',
    preview: 'testprev',
  }),
}))

import { GET, POST } from './route'
import { NextRequest } from 'next/server'

function makeReq(method = 'GET', body?: unknown) {
  return new NextRequest('http://localhost/api/admin/api-keys', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/api-keys', () => {
  it('gibt 403 zurück wenn kein User eingeloggt', async () => {
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/api-keys', () => {
  it('gibt 403 zurück wenn kein User eingeloggt', async () => {
    const res = await POST(makeReq('POST', { name: 'Test', permissions: ['vakanzen:read'] }))
    expect(res.status).toBe(403)
  })
})
