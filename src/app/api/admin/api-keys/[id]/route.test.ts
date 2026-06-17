import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn(),
  }),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { PATCH, DELETE } from './route'

const makeParams = (id = 'key-1') => ({ params: Promise.resolve({ id }) })

function makeReq(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/admin/api-keys/key-1`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('PATCH /api/admin/api-keys/[id]', () => {
  it('gibt 403 zurück wenn kein User eingeloggt', async () => {
    const res = await PATCH(makeReq('PATCH', { aktiv: false }), makeParams())
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/admin/api-keys/[id]', () => {
  it('gibt 403 zurück wenn kein User eingeloggt', async () => {
    const res = await DELETE(makeReq('DELETE'), makeParams())
    expect(res.status).toBe(403)
  })
})
