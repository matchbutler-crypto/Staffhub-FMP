import { describe, expect, it } from 'vitest'
import { normalizeSkillNames, removeSkillAtIndex } from './resource-pool-form-sheet'

describe('resource pool skill helpers', () => {
  it('deduplicates skill names case-insensitively while keeping the first label', () => {
    expect(
      normalizeSkillNames(['Project Management', 'project management', 'React', ' React '])
    ).toEqual(['Project Management', 'React'])
  })

  it('removes only the clicked duplicate skill by index', () => {
    expect(removeSkillAtIndex(['Project Management', 'Project Management'], 0)).toEqual([
      'Project Management',
    ])
  })
})
