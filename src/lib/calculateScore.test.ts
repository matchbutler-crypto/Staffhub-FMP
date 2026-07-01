import { describe, it, expect } from 'vitest'
import { calculateSkillMatchScore, calculateInitialScore, getFitCategory } from './calculateScore'

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

describe('getFitCategory', () => {
  it('returns Perfect Fit for score >= 75', () => {
    expect(getFitCategory(75)).toBe('Perfect Fit')
    expect(getFitCategory(100)).toBe('Perfect Fit')
  })

  it('returns Good Fit for score 60-74', () => {
    expect(getFitCategory(60)).toBe('Good Fit')
    expect(getFitCategory(74)).toBe('Good Fit')
  })

  it('returns Partial Fit for score 40-59', () => {
    expect(getFitCategory(40)).toBe('Partial Fit')
    expect(getFitCategory(59)).toBe('Partial Fit')
  })

  it('returns Low Fit for score < 40', () => {
    expect(getFitCategory(0)).toBe('Low Fit')
    expect(getFitCategory(39)).toBe('Low Fit')
  })
})

describe('calculateInitialScore', () => {
  it('scores 100 for perfect must-have + nice-to-have + level match', () => {
    const result = calculateInitialScore({
      extractedSkills: ['Python', 'SQL', 'Docker'],
      vacancySkillsMustHave: ['Python', 'SQL'],
      vacancySkillsNiceToHave: ['Docker'],
      extractedLevel: 'Senior',
      vacancyLevel: 'Mid',
    })
    // 100% of must-have → 60pts, 100% nice-to-have → 25pts, level match → 15pts = 100
    expect(result.initialScore).toBe(100)
    expect(result.fitCategory).toBe('Perfect Fit')
    expect(result.levelMatch).toBe(true)
  })

  it('scores 60 for full must-have match, no nice-to-have, level match', () => {
    const result = calculateInitialScore({
      extractedSkills: ['Python'],
      vacancySkillsMustHave: ['Python'],
      vacancySkillsNiceToHave: ['Docker', 'Kubernetes'],
      extractedLevel: 'Senior',
      vacancyLevel: 'Mid',
    })
    // 60pts must-have + 0pts nice-to-have + 15pts level = 75
    expect(result.initialScore).toBe(75)
    expect(result.fitCategory).toBe('Perfect Fit')
  })

  it('gives 0 for level component when extracted level is lower', () => {
    const result = calculateInitialScore({
      extractedSkills: ['Python', 'SQL'],
      vacancySkillsMustHave: ['Python', 'SQL'],
      vacancySkillsNiceToHave: ['Docker', 'Kubernetes'],  // unmatched → 0 nice-to-have pts
      extractedLevel: 'Junior',
      vacancyLevel: 'Senior',
    })
    // 60pts must-have + 0pts nice-to-have + 0pts level = 60
    expect(result.initialScore).toBe(60)
    expect(result.levelMatch).toBe(false)
    expect(result.fitCategory).toBe('Good Fit')
  })

  it('handles missing nice-to-have gracefully', () => {
    const result = calculateInitialScore({
      extractedSkills: ['Python'],
      vacancySkillsMustHave: ['Python'],
      extractedLevel: 'Mid',
      vacancyLevel: 'Mid',
    })
    // No nice-to-have → treated as 100% (0 required = 100 score) → 25pts, + 60pts + 15pts = 100
    expect(result.initialScore).toBe(100)
  })
})
