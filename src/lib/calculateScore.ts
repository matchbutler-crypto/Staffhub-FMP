/**
 * Score Calculation Utility for Profile Matching
 * Scoring aligned with staffing-matrix skill:
 *   Must-Have Skills  → 60 pts max
 *   Nice-to-Have      → 25 pts max
 *   Level/Seniority   → 15 pts max
 */

export interface ScoreCalculationInput {
  extractedSkills: string[]
  vacancySkillsMustHave: string[]
  vacancySkillsNiceToHave?: string[]
  extractedLevel: string
  vacancyLevel: string
}

export type FitCategory = 'Perfect Fit' | 'Good Fit' | 'Partial Fit' | 'Low Fit'

export interface ScoreResult {
  mustHaveMatchScore: number   // 0-100 % of must-haves matched
  niceToHaveMatchScore: number // 0-100 % of nice-to-haves matched
  levelMatch: boolean
  initialScore: number         // 0-100 weighted total
  fitCategory: FitCategory
}

const LEVEL_HIERARCHY: Record<string, number> = {
  Junior: 1,
  Mid: 2,
  Senior: 3,
  Expert: 4,
}

/**
 * Calculates percentage match between extracted skills and a required skill list.
 * Case-insensitive exact match only.
 */
export function calculateSkillMatchScore(
  extractedSkills: string[],
  vacancySkills: string[]
): number {
  if (vacancySkills.length === 0) return 100
  if (extractedSkills.length === 0) return 0

  const extractedNorm = new Set(extractedSkills.map((s) => s.toLowerCase().trim()))
  let matched = 0
  for (const skill of vacancySkills) {
    if (extractedNorm.has(skill.toLowerCase().trim())) matched++
  }
  return Math.round((matched / vacancySkills.length) * 100)
}

function isLevelMatch(extractedLevel: string, vacancyLevel: string): boolean {
  return (LEVEL_HIERARCHY[extractedLevel] ?? 0) >= (LEVEL_HIERARCHY[vacancyLevel] ?? 0)
}

export function getFitCategory(score: number): FitCategory {
  if (score >= 75) return 'Perfect Fit'
  if (score >= 60) return 'Good Fit'
  if (score >= 40) return 'Partial Fit'
  return 'Low Fit'
}

/**
 * Calculates initial match score for a profile against a vacancy.
 * Used as fallback when OpenAI is unavailable.
 *
 * Weights:
 *   Must-Have Skills   60 pts max
 *   Nice-to-Have       25 pts max
 *   Level/Seniority    15 pts
 */
export function calculateInitialScore(input: ScoreCalculationInput): ScoreResult {
  const mustHaveMatchScore = calculateSkillMatchScore(
    input.extractedSkills,
    input.vacancySkillsMustHave
  )
  const niceToHaveMatchScore = calculateSkillMatchScore(
    input.extractedSkills,
    input.vacancySkillsNiceToHave ?? []
  )
  const levelMatches = isLevelMatch(input.extractedLevel, input.vacancyLevel)

  const mustHaveComponent = (mustHaveMatchScore / 100) * 60
  const niceToHaveComponent = (niceToHaveMatchScore / 100) * 25
  const levelComponent = levelMatches ? 15 : 0

  const initialScore = Math.min(100, Math.round(mustHaveComponent + niceToHaveComponent + levelComponent))

  return {
    mustHaveMatchScore,
    niceToHaveMatchScore,
    levelMatch: levelMatches,
    initialScore,
    fitCategory: getFitCategory(initialScore),
  }
}
