import { describe, it, expect } from 'vitest'
import { isResourceUnavailable } from './resource-availability'

describe('isResourceUnavailable', () => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  it('returns true if status is nicht_verfügbar', () => {
    const result = isResourceUnavailable('res-1', [], 'nicht_verfügbar')
    expect(result).toBe(true)
  })

  it('returns false if status is available', () => {
    const result = isResourceUnavailable('res-1', [], 'verfügbar')
    expect(result).toBe(false)
  })

  it('returns false if status is null', () => {
    const result = isResourceUnavailable('res-1', [], null)
    expect(result).toBe(false)
  })

  it('returns true if resource has active beauftragung', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(true)
  })

  it('returns false if beauftragung ends before today', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: yesterday.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(false)
  })

  it('returns false if beauftragung starts after today', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: tomorrow.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(false)
  })

  it('returns true if today equals start_date (inclusive)', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: today.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(true)
  })

  it('returns true if today equals end_date (inclusive)', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: today.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(true)
  })

  it('ignores beauftragungen for other resources', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-2',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(false)
  })
})
