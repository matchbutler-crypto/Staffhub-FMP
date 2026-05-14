/**
 * Score Calculation Utility for Profile Matching
 * Calculates initial match score based on extracted skills and vacancy requirements.
 */

export interface ScoreCalculationInput {
  extractedSkills: string[]
  vacancySkills: string[]
  extractedLevel: string
  vacancyLevel: string
  cvLength: number // length of extracted CV text in characters
}

export interface ScoreResult {
  skillMatchScore: number // 0-100 based on skill overlap
  levelMatch: boolean
  initialScore: number // 0-100 overall score
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Level hierarchy for experience level matching
 * Junior < Mid < Senior < Expert
 */
const LEVEL_HIERARCHY: Record<string, number> = {
  'Junior': 1,
  'Mid': 2,
  'Senior': 3,
  'Expert': 4,
}

/**
 * Calculates a skill match score (0-100) based on overlap between
 * extracted skills and vacancy requirements.
 *
 * @param extractedSkills - Skills extracted from the CV
 * @param vacancySkills - Skills required by the vacancy
 * @returns Score 0-100
 */
export function calculateSkillMatchScore(
  extractedSkills: string[],
  vacancySkills: string[]
): number {
  if (vacancySkills.length === 0) {
    return 100 // No requirements = perfect match
  }

  if (extractedSkills.length === 0) {
    return 0 // No skills extracted = no match
  }

  // Normalize for case-insensitive comparison
  const extractedNorm = new Set(extractedSkills.map((s) => s.toLowerCase().trim()))
  const vacancyNorm = vacancySkills.map((s) => s.toLowerCase().trim())

  // Count exact matches
  let exactMatches = 0
  for (const skill of vacancyNorm) {
    if (extractedNorm.has(skill)) {
      exactMatches++
    }
  }

  // Calculate percentage match
  return Math.round((exactMatches / vacancyNorm.length) * 100)
}

/**
 * Determines if extracted experience level meets vacancy requirements
 * Allows match if extracted level >= required level
 *
 * @param extractedLevel - Extracted level (Junior, Mid, Senior, Expert)
 * @param vacancyLevel - Required level
 * @returns boolean indicating if level matches
 */
function isLevelMatch(extractedLevel: string, vacancyLevel: string): boolean {
  const extractedScore = LEVEL_HIERARCHY[extractedLevel] ?? 0
  const vacancyScore = LEVEL_HIERARCHY[vacancyLevel] ?? 0

  // Extracted level must be >= required level
  return extractedScore >= vacancyScore
}

/**
 * Determines confidence level based on amount of extracted CV content
 *
 * @param cvLength - Length of extracted CV text in characters
 * @returns 'high' if CV is substantial, 'medium' if partial, 'low' if minimal
 */
function getConfidence(cvLength: number): 'high' | 'medium' | 'low' {
  // High confidence: >5000 chars (substantial CV)
  if (cvLength > 5000) return 'high'
  // Medium confidence: 1000-5000 chars (decent amount of content)
  if (cvLength >= 1000) return 'medium'
  // Low confidence: <1000 chars (minimal content)
  return 'low'
}

/**
 * Calculates initial match score for a profile against a vacancy
 *
 * This provides a baseline score before Ollama's detailed evaluation.
 * Score is weighted as follows:
 * - 70%: Skill match (exact matches of required skills)
 * - 20%: Experience level match
 * - 10%: Confidence bonus (based on CV content length)
 *
 * @param input - Calculation input with skills, levels, and CV length
 * @returns ScoreResult with breakdown and confidence level
 */
export function calculateInitialScore(input: ScoreCalculationInput): ScoreResult {
  const skillScore = calculateSkillMatchScore(input.extractedSkills, input.vacancySkills)
  const levelMatches = isLevelMatch(input.extractedLevel, input.vacancyLevel)
  const confidence = getConfidence(input.cvLength)

  // Weighted calculation
  const skillComponent = skillScore * 0.7
  const levelComponent = levelMatches ? 20 : 0 // 20 points if level matches
  const confidenceBonus = confidence === 'high' ? 10 : confidence === 'medium' ? 5 : 0

  const initialScore = Math.round(skillComponent + levelComponent + confidenceBonus)

  return {
    skillMatchScore: skillScore,
    levelMatch: levelMatches,
    initialScore: Math.min(100, Math.max(0, initialScore)),
    confidence,
  }
}
