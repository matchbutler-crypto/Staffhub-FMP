import { describe, expect, it } from 'vitest'
import { normalizeSkills } from './skillNormalization'

const createMockSupabaseClient = (skillsData: unknown[] = []) => ({
  from: (table: string) => {
    if (table !== 'skills') return {}

    return {
      select: () => ({
        returns: () => ({
          data: skillsData,
          error: null,
        }),
      }),
      insert: (records: { name: string; category: string }[]) => ({
        select: () => ({
          returns: () => ({
            data: records.map((record, index) => ({
              id: `created-${index}`,
              name: record.name,
              category: record.category,
            })),
            error: null,
          }),
        }),
      }),
    }
  },
})

describe('normalizeSkills', () => {
  it('deduplicates different extracted labels that resolve to the same database skill', async () => {
    const client = createMockSupabaseClient([
      {
        id: 'skill-project-management',
        name: 'Projektmanagement',
        category: 'Methoden',
        synonyms: ['Project Management'],
      },
    ])

    const result = await normalizeSkills(
      ['Project Management', 'Projektmanagement'],
      client as never
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'skill-project-management',
      name: 'Projektmanagement',
    })
  })
})
