import OpenAI from 'openai'
import { BRANCHEN, ERFAHRUNGSLEVEL, ARBEITSMODELL } from '@/lib/constants'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ParsedVakanz {
  rolle: string | null
  beschreibung: string | null
  skills: string[]
  skills_nice_have: string[]
  erfahrungslevel: typeof ERFAHRUNGSLEVEL[number] | null
  startdatum: string | null       // YYYY-MM-DD
  enddatum: string | null         // YYYY-MM-DD
  arbeitsmodell: typeof ARBEITSMODELL[number] | null
  onsite_anteil: number | null
  standort: string | null
  branche: typeof BRANCHEN[number] | null
  auslastung: number | null
  fte_anzahl: number | null
  teamgroesse: number | null
  kunde: string | null
  ansprechpartner: string | null
}

const SYSTEM_PROMPT = `Du bist ein Recruiting-Assistent. Extrahiere strukturierte Daten aus einer Stellenbeschreibung oder Projektanfrage.

Gib IMMER ein valides JSON-Objekt zurück. Felder die du nicht erkennen kannst, setze auf null.

Wichtige Regeln:
- erfahrungslevel: Nur exakt einer dieser Werte: ${ERFAHRUNGSLEVEL.join(', ')}
- arbeitsmodell: Nur exakt einer dieser Werte: ${ARBEITSMODELL.join(', ')}
- branche: Nur exakt einer dieser Werte: ${BRANCHEN.join(', ')} — wähle den passendsten
- Datumsformat: YYYY-MM-DD (z.B. "2025-09-01")
- skills: Must-Have-Skills als Array von kurzen Begriffen (z.B. ["Python", "React", "AWS"])
- skills_nice_have: Nice-to-Have-Skills als Array
- auslastung: Prozentsatz 1-100 (100 = Vollzeit)
- fte_anzahl: Anzahl der benötigten Personen (meist 1.0)
- onsite_anteil: nur setzen wenn arbeitsmodell = "Hybrid", sonst null`

const CV_SKILL_PROMPT = `Du bist ein Recruiting-Assistent. Lies diesen Lebenslauf und extrahiere die Top-Skills.

Gib ein JSON-Objekt zurück: { "skills": ["skill1", "skill2", ...] }

Regeln:
- Nur die relevantesten/wichtigsten Skills
- Technische Skills: Programmiersprachen, Frameworks, Tools, Datenbanken, Cloud-Dienste, Methoden
- Soft Skills: z.B. "Teamarbeit", "Projektmanagement", "Kommunikation"
- Kurze kanonische Begriffe: "React" nicht "React.js Framework", "Python" nicht "Python-Programmierung"
- Keine Duplikate, keine Versionsnummern
- MAXIMAL 30 Skills (nur die Top-30)`

export async function extractSkillsFromCVBuffer(cvBuffer: ArrayBuffer): Promise<string[]> {
  const base64 = Buffer.from(cvBuffer).toString('base64')

  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: 'cv.pdf',
            file_data: `data:application/pdf;base64,${base64}`,
          },
          {
            type: 'input_text',
            text: CV_SKILL_PROMPT,
          },
        ],
      },
    ],
    text: { format: { type: 'json_object' } },
  })

  try {
    const parsed = JSON.parse(response.output_text)
    return Array.isArray(parsed.skills)
      ? parsed.skills.filter((s: unknown) => typeof s === 'string' && s.trim())
      : []
  } catch {
    return []
  }
}

export async function parseVakanzFromText(text: string): Promise<ParsedVakanz> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extrahiere die Vakanz-Daten aus diesem Text:\n\n${text.slice(0, 4000)}`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'

  let parsed: Partial<ParsedVakanz>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('OpenAI hat kein valides JSON zurückgegeben')
  }

  // Validate / sanitize enums
  const erfahrungslevel = ERFAHRUNGSLEVEL.includes(parsed.erfahrungslevel as typeof ERFAHRUNGSLEVEL[number])
    ? parsed.erfahrungslevel as typeof ERFAHRUNGSLEVEL[number]
    : null

  const arbeitsmodell = ARBEITSMODELL.includes(parsed.arbeitsmodell as typeof ARBEITSMODELL[number])
    ? parsed.arbeitsmodell as typeof ARBEITSMODELL[number]
    : null

  const branche = BRANCHEN.includes(parsed.branche as typeof BRANCHEN[number])
    ? parsed.branche as typeof BRANCHEN[number]
    : null

  return {
    rolle: parsed.rolle ?? null,
    beschreibung: parsed.beschreibung ?? null,
    skills: Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean) : [],
    skills_nice_have: Array.isArray(parsed.skills_nice_have) ? parsed.skills_nice_have.filter(Boolean) : [],
    erfahrungslevel,
    startdatum: parsed.startdatum ?? null,
    enddatum: parsed.enddatum ?? null,
    arbeitsmodell,
    onsite_anteil: typeof parsed.onsite_anteil === 'number' ? parsed.onsite_anteil : null,
    standort: parsed.standort ?? null,
    branche,
    auslastung: typeof parsed.auslastung === 'number' ? parsed.auslastung : null,
    fte_anzahl: typeof parsed.fte_anzahl === 'number' ? parsed.fte_anzahl : null,
    teamgroesse: typeof parsed.teamgroesse === 'number' ? parsed.teamgroesse : null,
    kunde: parsed.kunde ?? null,
    ansprechpartner: parsed.ansprechpartner ?? null,
  }
}

export interface KiBewertungResult {
  score: number
  empfehlung: 'Empfohlen' | 'Bedingt geeignet' | 'Nicht geeignet'
  begruendung: string
  skill_vorhanden: string[]
  skill_fehlend: string[]
  model: string
}

const KI_BEWERTUNG_PROMPT = `Du bist ein Recruiting-Assistent. Bewerte das folgende Kandidaten-Profil gegen die Vakanz.

VAKANZ:
Titel: {vakanz_titel}
Erfahrungslevel: {vakanz_level}
Geforderte Skills: {vakanz_skills}
Beschreibung: {vakanz_beschreibung}

KANDIDAT:
Erfahrungslevel: {kandidat_level}
Skills: {kandidat_skills}
Profil: {kandidat_profil}

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, kein Text davor/danach):
{
  "score": <Ganzzahl 0-100>,
  "empfehlung": <"Empfohlen" | "Bedingt geeignet" | "Nicht geeignet">,
  "begruendung": <2-3 Sätze auf Deutsch>,
  "skill_vorhanden": [<geforderte Skills die der Kandidat hat>],
  "skill_fehlend": [<geforderte Skills die fehlen>]
}`

export async function bewerteProfilMitOpenAI(
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
  const prompt = KI_BEWERTUNG_PROMPT
    .replace('{vakanz_titel}', vakanz.titel)
    .replace('{vakanz_level}', vakanz.erfahrungslevel)
    .replace('{vakanz_skills}', vakanz.skills.join(', ') || 'Keine spezifischen Skills gefordert')
    .replace('{vakanz_beschreibung}', vakanz.beschreibung.slice(0, 500))
    .replace('{kandidat_level}', profil.erfahrungslevel)
    .replace('{kandidat_skills}', profil.skills.join(', ') || 'Keine Skills angegeben')
    .replace('{kandidat_profil}', profil.profiltext.slice(0, 1000))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: 'user', content: prompt },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'

  let parsed: Partial<KiBewertungResult>
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('OpenAI hat kein valides JSON zurückgegeben')
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
    skill_fehlend: Array.isArray(parsed.skill_fehlend) ? parsed.skill_fehlend : [],
    model: 'gpt-4o-mini',
  }
}
