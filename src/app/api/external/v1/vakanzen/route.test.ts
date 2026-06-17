// src/app/api/external/v1/vakanzen/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVakanzenSelect, mockInsert } = vi.hoisted(() => ({
  mockVakanzenSelect: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'vakanzen') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn(() => ({
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  mockVakanzenSelect().then(resolve, reject),
              })),
            }),
          }),
        }
      }
      if (table === 'vakanzen_data') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockInsert }),
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

import { GET, POST } from './route'
import { validateExternalApiKey } from '@/lib/external-api-auth'

function makeGetRequest() {
  return new NextRequest('http://localhost/api/external/v1/vakanzen', {
    headers: { 'x-api-key': 'test-key' },
  })
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/external/v1/vakanzen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' },
    body: JSON.stringify(body),
  })
}

const validVakanz = {
  branche: 'IT', rolle: 'Frontend Engineer',
  beschreibung: 'React-Projekt', skills: ['React'],
  erfahrungslevel: 'Senior', startdatum: '2026-07-01',
  enddatum: '2026-12-31', fte_anzahl: 1, arbeitsmodell: 'Remote',
  budget_intern: 800,
}

describe('GET /api/external/v1/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück bei fehlendem API-Key', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(validateExternalApiKey).mockResolvedValueOnce(
      NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    )
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('gibt Vakanzen-Liste zurück', async () => {
    mockVakanzenSelect.mockResolvedValue({
      data: [{ id: 'v1', rolle: 'Dev', status: 'Offen', published: true }],
      error: null,
    })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.vakanzen).toHaveLength(1)
    expect(json.vakanzen[0].id).toBe('v1')
  })
})

describe('POST /api/external/v1/vakanzen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 bei fehlendem Pflichtfeld zurück', async () => {
    const res = await POST(makePostRequest({ rolle: 'Dev' }))
    expect(res.status).toBe(400)
  })

  it('erstellt Vakanz und gibt sie zurück', async () => {
    mockInsert.mockResolvedValue({
      data: { id: 'new-v', vakanz_nr: 42, rolle: 'Frontend Engineer', status: 'Offen' },
      error: null,
    })
    const res = await POST(makePostRequest(validVakanz))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.vakanz.id).toBe('new-v')
  })
})
