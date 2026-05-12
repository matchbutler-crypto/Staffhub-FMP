// ── Ollama KI-Bewertung Helper ─────────────────────────────────────────────────
// Lokal: kein Cloud-AI, Kandidatendaten verlassen nie das System.

export interface ExtractSkillsFromCVOptions {
  timeout?: number
  temperature?: number
}

export interface KiBewertungResult {
  score: number
  empfehlung: 'Empfohlen' | 'Bedingt geeignet' | 'Nicht geeignet'
  begruendung: string
  skill_vorhanden: string[]
  skill_fehlend: string[]
  model: string
}

interface OllamaGenerateResponse {
  response: string
  done: boolean
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? 'orca-mini:latest'
const TIMEOUT_MS      = 90_000

function buildPrompt(vakanz: {
  titel: string
  beschreibung: string
  skills: string[]
  erfahrungslevel: string
}, profil: {
  kandidatenname: string
  skills: string[]
  erfahrungslevel: string
  profiltext: string
}): string {
  return `
Du bist ein Recruiting-Assistent. Bewerte das folgende Kandidaten-Profil gegen die Vakanz.

VAKANZ:
Titel: ${vakanz.titel}
Erfahrungslevel: ${vakanz.erfahrungslevel}
Geforderte Skills: ${vakanz.skills.join(', ')}
Beschreibung: ${vakanz.beschreibung}

KANDIDAT:
Name: ${vakanz.titel} (anonymisiert)
Erfahrungslevel: ${profil.erfahrungslevel}
Skills: ${profil.skills.join(', ')}
Profil: ${profil.profiltext}

Antworte NUR mit einem validen JSON-Objekt in diesem Format (kein Markdown, kein Text davor oder danach):
{
  "score": <Ganzzahl 0-100, wie gut passt der Kandidat zur Vakanz>,
  "empfehlung": <"Empfohlen" | "Bedingt geeignet" | "Nicht geeignet">,
  "begruendung": <2-4 Sätze auf Deutsch, warum dieser Score>,
  "skill_vorhanden": [<Liste der geforderten Skills die der Kandidat hat>],
  "skill_fehlend": [<Liste der geforderten Skills die fehlen>]
}
`.trim()
}

export async function bewerteProfilMitOllama(
  vakanz: {
    titel: string
    beschreibung: string
    skills: string[]
    erfahrungslevel: string
  },
  profil: {
    kandidatenname: string
    skills: string[]
    erfahrungslevel: string
    profiltext: string
  }
): Promise<KiBewertungResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildPrompt(vakanz, profil),
        stream: false,
        format: 'json',
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`)
    }

    const data = await res.json() as OllamaGenerateResponse
    const raw = data.response.trim()

    // Parse JSON (Ollama gibt bei format:'json' direkt JSON zurück)
    let parsed: Partial<KiBewertungResult>
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Fallback: versuche JSON aus Text zu extrahieren
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Kein JSON in Ollama-Antwort gefunden')
      parsed = JSON.parse(match[0])
    }

    const score = Number(parsed.score)
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Ungültiger Score: ${parsed.score}`)
    }

    const empfehlung = parsed.empfehlung
    if (empfehlung !== 'Empfohlen' && empfehlung !== 'Bedingt geeignet' && empfehlung !== 'Nicht geeignet') {
      throw new Error(`Ungültige Empfehlung: ${empfehlung}`)
    }

    return {
      score,
      empfehlung,
      begruendung: String(parsed.begruendung ?? ''),
      skill_vorhanden: Array.isArray(parsed.skill_vorhanden) ? parsed.skill_vorhanden : [],
      skill_fehlend:   Array.isArray(parsed.skill_fehlend)   ? parsed.skill_fehlend   : [],
      model: OLLAMA_MODEL,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ── CV Skill Extraction ─────────────────────────────────────────────────────
// Extracts professional skills from CV text using Ollama API

/**
 * Extracts professional skills from CV text using Ollama API
 * @param cvText - The full text content of the CV
 * @param options - Optional configuration (timeout, temperature)
 * @returns Promise resolving to an array of extracted skill strings
 * @throws Error if API URL is not configured or if extraction fails
 */
export async function extractSkillsFromCV(
  cvText: string,
  options?: ExtractSkillsFromCVOptions
): Promise<string[]> {
  const apiUrl = process.env.NEXT_PUBLIC_OLLAMA_API_URL || process.env.OLLAMA_API_URL
  const model = process.env.OLLAMA_MODEL || 'orca-mini:latest'
  const timeout = options?.timeout ?? 30000 // Default 30 seconds
  const temperature = options?.temperature ?? 0.3 // Deterministic (low temperature)

  // Validate environment configuration
  if (!apiUrl) {
    throw new Error(
      'OLLAMA_API_URL environment variable is not set. ' +
      'Please configure the Ollama API URL (e.g., http://your-vps-ip:11434)'
    )
  }

  // Validate input
  if (!cvText || cvText.trim().length === 0) {
    throw new Error('CV text cannot be empty')
  }

  try {
    const generateUrl = `${apiUrl}/api/generate`

    const prompt = `Extract all professional skills and technologies from this CV. Return ONLY a comma-separated list of skills, nothing else. Do not include any explanations, introductions, or other text.

CV Text:
${cvText}

Skills:`

    const controller = new AbortController()
    const timeoutHandle = setTimeout(() => controller.abort(), timeout)

    let response: Response
    try {
      response = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          temperature,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutHandle)
    }

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}. ` +
        `Details: ${errorText}`
      )
    }

    // Parse response
    let data: OllamaGenerateResponse
    try {
      data = await response.json()
    } catch (parseError) {
      throw new Error(
        'Failed to parse Ollama response as JSON. ' +
        'Response might be malformed or not valid JSON.'
      )
    }

    // Validate response structure
    if (!data || typeof data.response !== 'string') {
      throw new Error(
        `Invalid Ollama response structure. Expected { response: string }, ` +
        `got: ${JSON.stringify(data)}`
      )
    }

    // Extract and parse the skills string
    const skillsString = data.response.trim()

    if (!skillsString) {
      // Empty response is acceptable - just return empty array
      return []
    }

    // Parse comma-separated skills
    const skills = skillsString
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0)

    // Additional validation: remove any skill that contains newlines or special characters
    // that might indicate malformed responses
    const validSkills = skills.filter((skill) => {
      // Allow alphanumeric, spaces, dots, hyphens, plus signs, and common tech symbols
      return /^[a-zA-Z0-9\s.+\-/#()]+$/.test(skill)
    })

    return validSkills
  } catch (error) {
    // Handle specific error types
    if (error instanceof TypeError) {
      // Network/fetch errors
      throw new Error(
        `Skill extraction network error: ${error.message}. ` +
        `Ensure Ollama is running at ${apiUrl}`
      )
    }

    if (error instanceof Error) {
      // Re-throw with context
      if (error.message.includes('aborted')) {
        throw new Error(
          `Skill extraction timeout: Request took longer than ${timeout}ms. ` +
          `Ollama API may be slow or unresponsive.`
        )
      }
      throw error
    }

    // Fallback for unknown errors
    throw new Error(`Skill extraction failed: ${String(error)}`)
  }
}

/**
 * Tests if the Ollama API is accessible (health check)
 * @returns Promise resolving to true if accessible, false otherwise
 */
export async function isOllamaAvailable(): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_OLLAMA_API_URL || process.env.OLLAMA_API_URL

  if (!apiUrl) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${apiUrl}/api/tags`, {
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}
