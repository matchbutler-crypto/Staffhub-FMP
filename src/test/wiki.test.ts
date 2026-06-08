import { describe, it, expect } from 'vitest'
import type { WikiPage } from '@/lib/wiki/types'
import { wikiPages, getWikiPagesByRole, getWikiPageBySlug } from '@/lib/wiki/index'
import type { Role } from '@/lib/wiki/types'

describe('WikiPage type', () => {
  it('accepts a valid wiki page object', () => {
    const page: WikiPage = {
      slug: 'test',
      title: 'Test',
      roles: ['Admin'],
      sections: [{ heading: 'Einleitung', body: 'Text' }],
    }
    expect(page.slug).toBe('test')
    expect(page.tour).toBeUndefined()
  })

  it('accepts a wiki page with tour steps', () => {
    const page: WikiPage = {
      slug: 'vakanzen',
      title: 'Vakanzen',
      roles: ['Admin', 'Staffhub Manager', 'Agentur'],
      sections: [{ heading: 'Übersicht', body: 'Text' }],
      tour: [{ element: '[data-tour="vakanzen-header"]', title: 'Vakanzen', description: 'Hier siehst du alle Vakanzen.' }],
    }
    expect(page.tour).toHaveLength(1)
  })
})

describe('wikiPages', () => {
  it('has at least one page per role', () => {
    const roles: Role[] = ['Admin', 'Staffhub Manager', 'Agentur', 'Controller']
    for (const role of roles) {
      const pages = getWikiPagesByRole(role)
      expect(pages.length).toBeGreaterThan(0)
    }
  })

  it('filters pages by role correctly', () => {
    const agenturPages = getWikiPagesByRole('Agentur')
    expect(agenturPages.some(p => p.slug === 'pool')).toBe(true)
    expect(agenturPages.some(p => p.slug === 'ressourcen')).toBe(false)
  })

  it('finds page by slug', () => {
    const page = getWikiPageBySlug('vakanzen')
    expect(page).not.toBeNull()
    expect(page?.title).toBeTruthy()
  })

  it('returns null for unknown slug', () => {
    expect(getWikiPageBySlug('does-not-exist')).toBeNull()
  })

  it('all pages have at least one section', () => {
    for (const page of wikiPages) {
      expect(page.sections.length).toBeGreaterThan(0)
    }
  })

  it('all tour steps reference data-tour selectors', () => {
    for (const page of wikiPages) {
      for (const step of page.tour ?? []) {
        expect(step.element).toMatch(/^\[data-tour=/)
      }
    }
  })
})
