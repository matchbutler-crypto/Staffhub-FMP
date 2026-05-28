import { describe, it, expect } from 'vitest'
import { getLinkStatusConfig, LINK_STATUS_ORDER, LINK_STATUS_FALLBACK } from './link-status-config'

describe('getLinkStatusConfig', () => {
  it('returns config for every status in LINK_STATUS_ORDER', () => {
    for (const s of LINK_STATUS_ORDER) {
      const cfg = getLinkStatusConfig(s)
      expect(cfg.color).toBeTruthy()
      expect(cfg.dot).toBeTruthy()
      expect(cfg.label).toBeTruthy()
    }
  })

  it('returns fallback for unknown status', () => {
    const cfg = getLinkStatusConfig('Unbekannt')
    expect(cfg).toEqual(LINK_STATUS_FALLBACK)
  })

  it('returns fallback for null', () => {
    expect(getLinkStatusConfig(null)).toEqual(LINK_STATUS_FALLBACK)
  })

  it('LINK_STATUS_ORDER contains all 13 statuses', () => {
    expect(LINK_STATUS_ORDER).toHaveLength(13)
  })

  it('Stammdaten anfordern has amber colour', () => {
    expect(getLinkStatusConfig('Stammdaten anfordern').color).toContain('amber')
  })

  it('Running has green colour', () => {
    expect(getLinkStatusConfig('Running').color).toContain('green')
  })
})
