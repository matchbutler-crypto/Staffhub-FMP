import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendProfilesAvailable, sendProfileUpdated } from './magenta-webhook'

const snapshot = { id: 'r-1', name: 'Anna Beispiel', email: 'anna@test.de', phone: '+49123' }

describe('magenta-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MAGENTA_WEBHOOK_URL = 'https://magenta-os.vercel.app/api/integrations/staffhub/webhook'
    process.env.MAGENTA_WEBHOOK_SECRET = 'test-secret'
  })
  afterEach(() => {
    delete process.env.MAGENTA_WEBHOOK_URL
    delete process.env.MAGENTA_WEBHOOK_SECRET
  })

  it('tut nichts wenn MAGENTA_WEBHOOK_URL fehlt', async () => {
    delete process.env.MAGENTA_WEBHOOK_URL
    await sendProfilesAvailable('vak-1')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sendet profiles.available mit korrektem Payload', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    await sendProfilesAvailable('vak-1')
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://magenta-os.vercel.app/api/integrations/staffhub/webhook')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toEqual({ event: 'profiles.available', vakanzId: 'vak-1' })
    const headers = options.headers as Record<string, string>
    expect(headers['x-staffhub-signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('sendet profile.updated mit BOOKED-Status', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    await sendProfileUpdated('vak-1', snapshot, 'BOOKED')
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({
      event: 'profile.updated',
      vakanzId: 'vak-1',
      profile: { id: 'r-1', status: 'BOOKED', firstName: 'Anna', lastName: 'Beispiel' },
    })
  })

  it('sendet profile.updated mit UNAVAILABLE-Status', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    await sendProfileUpdated('vak-1', snapshot, 'UNAVAILABLE')
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({
      event: 'profile.updated',
      vakanzId: 'vak-1',
      profile: { id: 'r-1', status: 'UNAVAILABLE', firstName: 'Anna', lastName: 'Beispiel' },
    })
  })

  it('loggt Fehler bei HTTP-Fehler ohne zu werfen', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValue({ ok: false, status: 503 })
    await expect(sendProfilesAvailable('vak-1')).resolves.toBeUndefined()
    consoleSpy.mockRestore()
  })
})
