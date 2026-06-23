// src/app/vakanzen/[id]/page.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock heavy dependencies so pure helper can be imported without side effects
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/context/user-context', () => ({ useUser: vi.fn() }))
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: 'abc-123' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { buildSlackText } from '@/lib/slack-text'

const baseVakanz = {
  id: 'abc-123',
  rolle: 'Senior React Developer',
  beschreibung: 'Build scalable frontend systems.',
  skills: ['React', 'TypeScript'],
  erfahrungslevel: 'Senior',
  startdatum: '2026-07-01',
  enddatum: '2026-12-31',
  auslastung: 100,
  arbeitsmodell: 'Remote',
  standort: 'Berlin',
  branche: 'Fintech',
  teamgroesse: 5,
  budget_intern: null,
}

describe('buildSlackText', () => {
  it('includes role and header', () => {
    const text = buildSlackText(baseVakanz, 'https://app.staffhub.de')
    expect(text).toContain(':mega:  Senior React Developer | NEW')
    expect(text).toContain('*Job Role*\nSenior React Developer')
  })

  it('includes all job detail fields', () => {
    const text = buildSlackText(baseVakanz, 'https://app.staffhub.de')
    expect(text).toContain('*Working Location*: Berlin')
    expect(text).toContain('*Workmode:* Remote')
    expect(text).toContain('*Remote Ratio:* 100 %')
    expect(text).toContain('*Required Skills:* React, TypeScript')
    expect(text).toContain('*Relevant Working Experience:* Senior')
    expect(text).toContain('*Industry:* Fintech')
    expect(text).toContain('*Team Size:* 5')
    expect(text).toContain('*Job Type:* Freelance')
    expect(text).toContain('*Start date:* 01.07.2026')
    expect(text).toContain('*End date:* 31.12.2026')
  })

  it('omits Rate line when budget_intern is null', () => {
    const text = buildSlackText(baseVakanz, 'https://app.staffhub.de')
    expect(text).not.toContain('*Rate:*')
  })

  it('includes Rate line when budget_intern is set', () => {
    const text = buildSlackText({ ...baseVakanz, budget_intern: 850 }, 'https://app.staffhub.de')
    expect(text).toContain('*Rate:* 850 €')
  })

  it('includes CTA with correct URL', () => {
    const text = buildSlackText(baseVakanz, 'https://app.staffhub.de')
    expect(text).toContain('https://app.staffhub.de/vakanzen/abc-123')
  })

  it('shows – for missing enddatum', () => {
    const text = buildSlackText({ ...baseVakanz, enddatum: null }, 'https://app.staffhub.de')
    expect(text).toContain('*End date:* –')
  })

  it('shows – for missing standort', () => {
    const text = buildSlackText({ ...baseVakanz, standort: null }, 'https://app.staffhub.de')
    expect(text).toContain('*Working Location*: –')
  })
})
