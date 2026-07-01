import OpenAI from 'openai'
import { BRANCHEN, ERFAHRUNGSLEVEL, ARBEITSMODELL } from '@/lib/constants'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

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
  budget_extern: number | null    // Tagesrate aus Ausschreibung (€/Tag)
}

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  return `Du bist ein Recruiting-Assistent. Extrahiere strukturierte Daten aus einer Stellenbeschreibung oder Projektanfrage.

Heutiges Datum: ${today}

Gib IMMER ein valides JSON-Objekt zurück. Felder die du nicht erkennen kannst, setze auf null.

Wichtige Regeln:
- erfahrungslevel: Nur exakt einer dieser Werte: ${ERFAHRUNGSLEVEL.join(', ')}
- arbeitsmodell: Nur exakt einer dieser Werte: ${ARBEITSMODELL.join(', ')}
- branche: Nur exakt einer dieser Werte: ${BRANCHEN.join(', ')} — wähle den passendsten
- Datumsformat: YYYY-MM-DD (z.B. "2025-09-01")
- Relative Datumsangaben: "sofort" oder "ab sofort" → heutiges Datum (${today}), "nächsten Monat" → ersten des nächsten Monats, etc.
- skills: Must-Have-Skills als Array von kurzen Begriffen
- skills_nice_have: Nice-to-Have-Skills als Array
- auslastung: Prozentsatz 1-100 ("Vollzeit" = 100, "Teilzeit 50%" = 50)
- fte_anzahl: Anzahl der gesuchten Freelancer/Kandidaten (fast immer 1.0, nur höher wenn explizit mehrere Personen gesucht werden)
- teamgroesse: Größe des bestehenden Projektteams beim Kunden (z.B. "Team ca. 15 Personen" → 15) — NICHT die gesuchten FTEs
- onsite_anteil: nur setzen wenn arbeitsmodell = "Hybrid", sonst null
- budget_extern: genannte Tagesrate oder Budget in €/Tag als Zahl (z.B. "1.200 €/Tag" → 1200, "Tagesrate: 800" → 800) — nur die reine Zahl, kein €-Zeichen
- erfahrungslevel nach Berufsjahren: < 2 Jahre → Junior, 2–5 Jahre → Mid, 5–10 Jahre → Senior, 10+ Jahre → Expert; "3+ Jahre" → Mid; "5+ Jahre" → Senior

Regeln für rolle:
- Extrahiere die gesuchte Rolle/Position wenn sie explizit genannt ist
- Falls keine Rolle explizit genannt, leite sie aus dem Kontext ab (z.B. "Digitalisierung Öffentlicher Sektor" → "Digitalisierungsberater (m/w/d)", "Prozessoptimierung" → "Prozessberater (m/w/d)")
- Sei präzise aber allgemein genug um keine spezifische Organisation zu verraten

Regeln für beschreibung (Projektkontext):
- Formuliere den Projektkontext allgemein und anonym — er darf NICHT auf ein konkretes Projekt, einen konkreten Kunden oder eine spezifische Organisation zurückgeführt werden können
- Verwende übergeordnete Oberbegriffe statt spezifischer Bezeichnungen (z.B. "Anwendung im öffentlichen Sektor" statt "Behördenanwendung für Amt XY", "Enterprise-Plattform" statt "internes Tooling der Firma Z")
- Keine Kunden- oder Projektnamen, keine konkreten Behörden- oder Unternehmensbezeichnungen

Regeln für skills und skills_nice_have:
- IT-Rollen: Bevorzuge Technologien, Frameworks, Tools (z.B. "Java", "Scrum", "Kubernetes")
- Nicht-IT-Rollen (Beratung, Management, öffentlicher Sektor etc.): Nimm auch fachliche Kompetenzen und Methoden auf (z.B. "Prozessanalyse", "Prozessoptimierung", "Stakeholder-Management", "Erfahrung öffentlicher Sektor", "Behördenumfeld")
- Sprachkenntnisse die als Anforderung genannt sind (z.B. "Verhandlungssicheres Deutsch") als Skill aufnehmen
- Ignoriere Skills, die auf proprietäre Architekturen, interne Systemkürzel oder spezifische Fachverfahren hinweisen
- Ignoriere Skills, die so speziell sind, dass sie die Vakanz auf ein bestimmtes Projekt oder einen bestimmten Kunden zurückführen lassen`
}

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

  const response = await getOpenAI().responses.create({
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
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 1000,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
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
    budget_extern: typeof parsed.budget_extern === 'number' ? parsed.budget_extern : null,
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
Must-Have Skills: {vakanz_must_have}
Nice-to-Have Skills: {vakanz_nice_have}
Beschreibung: {vakanz_beschreibung}

KANDIDAT:
Erfahrungslevel: {kandidat_level}
Skills: {kandidat_skills}
Profil: {kandidat_profil}

SCORING-REGELN (Score 0-100):
- Must-Have Skills: max 60 Punkte (60 / Anzahl Must-Haves pro erfülltem Skill; ähnliche Technologie = halbe Punkte)
- Nice-to-Have Skills: max 25 Punkte (25 / Anzahl Nice-to-Haves pro erfülltem Skill)
- Seniority-Match (Kandidat >= Vakanz): 15 Punkte, sonst 0

FIT-KATEGORIEN:
- ≥75 → "Perfect Fit"  |  60–74 → "Good Fit"  |  40–59 → "Partial Fit"  |  <40 → "Low Fit"

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, kein Text davor/danach):
{
  "score": <Ganzzahl 0-100>,
  "empfehlung": <"Empfohlen" | "Bedingt geeignet" | "Nicht geeignet">,
  "begruendung": <2-3 Sätze auf Deutsch>,
  "skill_vorhanden": [<Must-Have Skills die der Kandidat hat>],
  "skill_fehlend": [<Must-Have Skills die fehlen>]
}`

export async function bewerteProfilMitOpenAI(
  vakanz: {
    titel: string
    beschreibung: string
    skills: string[]
    skills_nice_have?: string[]
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
    .replace('{vakanz_must_have}', vakanz.skills.join(', ') || 'Keine spezifischen Skills gefordert')
    .replace('{vakanz_nice_have}', vakanz.skills_nice_have?.join(', ') || 'Keine')
    .replace('{vakanz_beschreibung}', vakanz.beschreibung.slice(0, 500))
    .replace('{kandidat_level}', profil.erfahrungslevel)
    .replace('{kandidat_skills}', profil.skills.join(', ') || 'Keine Skills angegeben')
    .replace('{kandidat_profil}', profil.profiltext.slice(0, 1000))

  const completion = await getOpenAI().chat.completions.create({
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

export async function extractStundenFromPDF(pdfBuffer: ArrayBuffer): Promise<number | null> {
  const base64 = Buffer.from(pdfBuffer).toString('base64')

  const response = await getOpenAI().responses.create({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: 'zeitnachweis.pdf',
            file_data: `data:application/pdf;base64,${base64}`,
          },
          {
            type: 'input_text',
            text: 'Du bekommst einen Zeitnachweis (Stundennachweis). Extrahiere die Gesamtanzahl der geleisteten Stunden als Dezimalzahl. Antworte nur mit der Zahl, ohne Einheit oder Erklärung. Beispiel: 160.5',
          },
        ],
      },
    ],
  })

  const text = response.output_text?.trim()
  if (!text) return null
  const num = parseFloat(text)
  return isNaN(num) || num < 0 ? null : num
}
