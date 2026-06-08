import { describe, it, expect } from 'vitest'
import type { WikiPage } from '@/lib/wiki/types'

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
