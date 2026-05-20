import { describe, it, expect, vi } from 'vitest'
import { isResourceUnavailable } from '@/lib/resource-availability'

describe('Pool page availability filtering', () => {
  it('correctly filters resources with active beauftragung', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const beauftragungen = [
      {
        id: 'b1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]

    // Resource should be unavailable
    expect(isResourceUnavailable('res-1', beauftragungen, null)).toBe(true)

    // Other resources should be available
    expect(isResourceUnavailable('res-2', beauftragungen, null)).toBe(false)
  })

  it('correctly handles nicht_verfügbar status', () => {
    expect(isResourceUnavailable('res-1', [], 'nicht_verfügbar')).toBe(true)
    expect(isResourceUnavailable('res-1', [], 'verfügbar')).toBe(false)
    expect(isResourceUnavailable('res-1', [], null)).toBe(false)
  })

  it('resource becomes available after beauftragung ends', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const expiredBeauftragungen = [
      {
        id: 'b1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: yesterday.toISOString(),
      },
    ]

    expect(isResourceUnavailable('res-1', expiredBeauftragungen, null)).toBe(false)
  })

  it('handles multiple beauftragungen correctly', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const beauftragungen = [
      {
        id: 'b1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: yesterday.toISOString(), // Ended
      },
      {
        id: 'b2',
        ressource_id: 'res-1',
        ressource_link_id: 'link-2',
        start_date: tomorrow.toISOString(),
        end_date: tomorrow.toISOString(), // Hasn't started
      },
    ]

    // res-1 should still be available (no active beauftragung)
    expect(isResourceUnavailable('res-1', beauftragungen, null)).toBe(false)
  })

  it('returns true if resource is unavailable AND has beauftragung', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const beauftragungen = [
      {
        id: 'b1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]

    // Both conditions true: should be unavailable
    expect(
      isResourceUnavailable('res-1', beauftragungen, 'nicht_verfügbar')
    ).toBe(true)
  })
})
