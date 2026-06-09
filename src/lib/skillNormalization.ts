import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalized skill with database reference and match metadata
 */
export interface NormalizedSkill {
  id: string;
  name: string;
  category: string;
  matched: boolean;
  matchType?: 'exact' | 'fuzzy' | 'pending';
  matchScore?: number; // 0-1 for fuzzy matches
  source?: 'database' | 'pending';
}

/**
 * Internal interface for skills fetched from database
 */
interface SkillRecord {
  id: string;
  name: string;
  category: string;
  synonyms: string[];
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching when exact matches fail
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Number representing the edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate similarity score between two strings (0-1)
 * Based on Levenshtein distance normalized by string length
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0 = no match, 1 = exact match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1; // Both empty strings are identical

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Normalize extracted skills against O*NET database using three-tier matching
 *
 * Matching approach:
 * 1. Exact match (case-insensitive) against skills table
 * 2. Fuzzy match (Levenshtein distance) if no exact match (60% threshold)
 * 3. Create "pending" skill for admin review if no match found
 *
 * Features:
 * - Deduplication of extracted skills
 * - Caching to avoid duplicate DB queries
 * - Synonym support in matching
 * - Proper error handling
 *
 * @param extractedSkills - Array of skill strings extracted from CV/profile
 * @param dbClient - Supabase client for database queries
 * @returns Promise<NormalizedSkill[]> - Array of normalized skills with DB references
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * const client = createClient(url, key);
 * const extracted = ['React', 'node.js', 'PYTHON'];
 * const normalized = await normalizeSkills(extracted, client);
 *
 * // Result:
 * // [
 * //   { id: 'uuid-1', name: 'React', category: 'Frontend', matched: true, matchType: 'exact' },
 * //   { id: 'uuid-2', name: 'Node.js', category: 'Backend', matched: true, matchType: 'exact' },
 * //   { id: 'uuid-3', name: 'Python', category: 'Languages', matched: true, matchType: 'exact' },
 * // ]
 * ```
 */
export async function normalizeSkills(
  extractedSkills: string[],
  dbClient: SupabaseClient
): Promise<NormalizedSkill[]> {
  if (!extractedSkills || extractedSkills.length === 0) {
    return [];
  }

  // Validate input
  const validSkills = extractedSkills
    .map(skill => skill?.trim())
    .filter((skill): skill is string => Boolean(skill) && skill.length > 0);

  if (validSkills.length === 0) {
    return [];
  }

  // Deduplicate skills (case-insensitive)
  const uniqueSkills = Array.from(
    new Map(
      validSkills.map(skill => [skill.toLowerCase(), skill])
    ).values()
  );

  // Cache for matched skills to avoid duplicate DB queries
  const matchCache = new Map<string, NormalizedSkill>();

  // Fetch all skills from database once
  const { data: allSkills, error: fetchError } = await dbClient
    .from('skills')
    .select('id, name, category, synonyms')
    .returns<SkillRecord[]>();

  if (fetchError) {
    throw new Error(
      `Failed to fetch skills from database: ${fetchError.message}`
    );
  }

  // Build lookup maps for fast searching
  const skillsByNameLower = new Map<string, SkillRecord>();
  const skillsByName = new Map<string, SkillRecord>();
  const allSkillsList: SkillRecord[] = [];

  if (allSkills && allSkills.length > 0) {
    for (const skill of allSkills) {
      allSkillsList.push(skill);
      skillsByName.set(skill.name, skill);
      skillsByNameLower.set(skill.name.toLowerCase(), skill);

      // Index synonyms for exact matching
      if (skill.synonyms && Array.isArray(skill.synonyms)) {
        for (const synonym of skill.synonyms) {
          skillsByNameLower.set(synonym.toLowerCase(), skill);
        }
      }
    }
  }

  const results: NormalizedSkill[] = [];
  const pendingSkills: NormalizedSkill[] = [];

  // Process each unique skill
  for (const extractedSkill of uniqueSkills) {
    const cacheKey = extractedSkill.toLowerCase();

    // Check cache first
    if (matchCache.has(cacheKey)) {
      results.push(matchCache.get(cacheKey)!);
      continue;
    }

    // Tier 1: Exact match (case-insensitive)
    const exactMatch = skillsByNameLower.get(extractedSkill.toLowerCase());
    if (exactMatch) {
      const normalized: NormalizedSkill = {
        id: exactMatch.id,
        name: exactMatch.name,
        category: exactMatch.category,
        matched: true,
        matchType: 'exact',
        matchScore: 1,
        source: 'database',
      };
      matchCache.set(cacheKey, normalized);
      results.push(normalized);
      continue;
    }

    // Tier 2: Fuzzy match using Levenshtein distance
    const FUZZY_THRESHOLD = 0.6; // 60% similarity
    let bestMatch: {
      skill: SkillRecord;
      score: number;
    } | null = null;

    for (const dbSkill of allSkillsList) {
      // Check skill name
      const nameSimilarity = calculateSimilarity(
        extractedSkill.toLowerCase(),
        dbSkill.name.toLowerCase()
      );

      if (nameSimilarity >= FUZZY_THRESHOLD) {
        if (!bestMatch || nameSimilarity > bestMatch.score) {
          bestMatch = { skill: dbSkill, score: nameSimilarity };
        }
      }

      // Check synonyms
      if (
        dbSkill.synonyms &&
        Array.isArray(dbSkill.synonyms) &&
        !bestMatch // Only check if we haven't found a match on name
      ) {
        for (const synonym of dbSkill.synonyms) {
          const synonymSimilarity = calculateSimilarity(
            extractedSkill.toLowerCase(),
            synonym.toLowerCase()
          );

          if (synonymSimilarity >= FUZZY_THRESHOLD) {
            if (!bestMatch || synonymSimilarity > bestMatch.score) {
              bestMatch = { skill: dbSkill, score: synonymSimilarity };
            }
          }
        }
      }
    }

    if (bestMatch) {
      const normalized: NormalizedSkill = {
        id: bestMatch.skill.id,
        name: bestMatch.skill.name,
        category: bestMatch.skill.category,
        matched: true,
        matchType: 'fuzzy',
        matchScore: bestMatch.score,
        source: 'database',
      };
      matchCache.set(cacheKey, normalized);
      results.push(normalized);
      continue;
    }

    // Tier 3: No match found - create pending skill for admin review
    const pendingSkill: NormalizedSkill = {
      id: '', // Will be assigned when created in DB
      name: extractedSkill,
      category: 'unknown',
      matched: false,
      matchType: 'pending',
      matchScore: 0,
      source: 'pending',
    };
    pendingSkills.push(pendingSkill);
  }

  // Create pending skills in database if any unmatched skills exist
  if (pendingSkills.length > 0) {
    const pendingRecords = pendingSkills.map(skill => ({
      name: skill.name,
      category: skill.category,
      status: 'pending',
      synonyms: [],
      created_at: new Date().toISOString(),
    }));

    const { data: createdSkills, error: createError } = await dbClient
      .from('skills')
      .insert(pendingRecords)
      .select('id, name, category')
      .returns<{ id: string; name: string; category: string }[]>();

    if (createError) {
      // Log error but don't throw - pending skills are best-effort
      console.error('Failed to create pending skills:', createError);
      // Still add pending skills to results with empty IDs for client-side handling
      results.push(
        ...pendingSkills.map(skill => ({
          ...skill,
          id: `pending_${Date.now()}_${Math.random()}`,
        }))
      );
    } else if (createdSkills && createdSkills.length > 0) {
      // Map created pending skills back to results with generated IDs
      for (let i = 0; i < pendingSkills.length; i++) {
        if (i < createdSkills.length) {
          pendingSkills[i].id = createdSkills[i].id;
        }
      }
      results.push(...pendingSkills);
    }
  }

  const seenMatchedSkillIds = new Set<string>();
  return results.filter((skill) => {
    if (skill.matchType === 'pending') return true;
    if (seenMatchedSkillIds.has(skill.id)) return false;
    seenMatchedSkillIds.add(skill.id);
    return true;
  });
}

/**
 * Extract and normalize skills from raw CV text by keyword-matching against the skills DB.
 * Replaces the Ollama extraction step - no LLM needed.
 */
export async function extractAndNormalizeFromText(
  cvText: string,
  dbClient: SupabaseClient
): Promise<NormalizedSkill[]> {
  const { data: allSkills, error } = await dbClient
    .from('skills')
    .select('id, name, category, synonyms')
    .returns<SkillRecord[]>()

  if (error || !allSkills) return []

  const text = cvText.toLowerCase()
  const matched = new Map<string, NormalizedSkill>()

  for (const skill of allSkills) {
    const terms = [skill.name, ...(skill.synonyms ?? [])]
    for (const term of terms) {
      const t = term.toLowerCase()
      // Word-boundary check: term must not be surrounded by alphanumeric chars
      const idx = text.indexOf(t)
      if (idx === -1) continue
      const before = idx > 0 ? text[idx - 1] : ' '
      const after = idx + t.length < text.length ? text[idx + t.length] : ' '
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue
      matched.set(skill.id, {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        matched: true,
        matchType: 'exact',
        matchScore: 1,
        source: 'database',
      })
      break
    }
  }

  return Array.from(matched.values())
}

/**
 * Get all matched skills from a normalization result
 * Filters for skills that were successfully matched to database records
 *
 * @param normalized - Array of normalized skills
 * @returns Array containing only matched skills (matchType: 'exact' or 'fuzzy')
 */
export function getMatchedSkills(normalized: NormalizedSkill[]): NormalizedSkill[] {
  return normalized.filter(skill => skill.matchType === 'exact' || skill.matchType === 'fuzzy');
}

/**
 * Get all pending skills awaiting admin review
 *
 * @param normalized - Array of normalized skills
 * @returns Array containing only pending skills (matchType: 'pending')
 */
export function getPendingSkills(normalized: NormalizedSkill[]): NormalizedSkill[] {
  return normalized.filter(skill => skill.matchType === 'pending');
}

/**
 * Get skills by category from normalized results
 *
 * @param normalized - Array of normalized skills
 * @param category - Category to filter by
 * @returns Array of skills in the specified category
 */
export function getSkillsByCategory(
  normalized: NormalizedSkill[],
  category: string
): NormalizedSkill[] {
  return normalized.filter(skill => skill.category.toLowerCase() === category.toLowerCase());
}
