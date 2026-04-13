// ── Ollama KI-Bewertung Helper ─────────────────────────────────────────────────
// Lokal: kein Cloud-AI, Kandidatendaten verlassen nie das System.

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
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? 'llama3.2'
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
