import { describe, it, expect } from 'vitest'
import { calculateSkillMatchScore } from './calculateScore'

describe('calculateSkillMatchScore', () => {
  it('returns 100 when vacancy has no skills', () => {
    expect(calculateSkillMatchScore(['Python', 'SQL'], [])).toBe(100)
  })

  it('returns 0 when resource has no skills', () => {
    expect(calculateSkillMatchScore([], ['Python', 'SQL'])).toBe(0)
  })

  it('returns 100 for full match', () => {
    expect(calculateSkillMatchScore(['Python', 'SQL'], ['Python', 'SQL'])).toBe(100)
  })

  it('returns 50 for half match', () => {
    expect(calculateSkillMatchScore(['Python'], ['Python', 'SQL'])).toBe(50)
  })

  it('is case-insensitive', () => {
    expect(calculateSkillMatchScore(['python', 'sql'], ['Python', 'SQL'])).toBe(100)
  })

  it('returns 0 when no skills overlap', () => {
    expect(calculateSkillMatchScore(['Java', 'Go'], ['Python', 'SQL'])).toBe(0)
  })
})
