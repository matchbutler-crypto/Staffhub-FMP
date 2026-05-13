/**
 * ESCO Skills Import (v1.2.1, Deutsch)
 *
 * Liest die ESCO skills_de.csv + skillsHierarchy_de.csv und importiert
 * alle freigegebenen Skills in die Supabase skills-Tabelle.
 * Vorhandene Skills (per Name) werden NICHT überschrieben.
 *
 * Run: npx tsx scripts/import-esco-skills.ts
 *
 * ESCO © European Union, 2024 — frei nutzbar unter CC BY 4.0
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ESCO_DIR = path.join(
  __dirname,
  'ESCO dataset - v1.2.1 - classification - de - csv'
)
const SKILLS_FILE    = path.join(ESCO_DIR, 'skills_de.csv')
const HIERARCHY_FILE = path.join(ESCO_DIR, 'skillsHierarchy_de.csv')

// skillType + reuseLevel → unsere Kategorie
function mapEscoCategory(skillType: string, reuseLevel: string): string {
  if (reuseLevel === 'transversal') return 'Soft Skills'
  if (skillType === 'knowledge') return 'Fachkenntnisse'
  if (skillType === 'language') return 'Sprachen'
  if (reuseLevel === 'cross-sector') return 'Fähigkeiten'
  return 'Fachkompetenz'  // sector-specific / occupation-specific
}

// ── CSV-Parser (einfach, ohne externe Abhängigkeit) ─────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

async function readCSV(filePath: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  const rows: Record<string, string>[] = []
  let headers: string[] = []
  let isFirst = true

  for await (const line of rl) {
    if (!line.trim()) continue
    const cols = parseCSVLine(line)
    if (isFirst) {
      headers = cols.map((h) => h.trim())
      isFirst = false
    } else {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = (cols[i] ?? '').trim()
      })
      rows.push(row)
    }
  }

  return { headers, rows }
}

// ── Schritt 1: Skills aus skills_de.csv lesen ────────────────────────────────

interface SkillRecord {
  name: string
  category: string
  source: string
  synonyms: string[]
}

async function readEscoSkills(): Promise<SkillRecord[]> {
  console.log('📂 Lese skills_de.csv...')
  const { rows } = await readCSV(SKILLS_FILE)

  const skills: SkillRecord[] = []
  let skipped = 0

  for (const row of rows) {
    // Nur freigegebene Skills
    if (row['status'] !== 'released') {
      skipped++
      continue
    }

    const name = row['preferredLabel']?.trim()
    if (!name || name.length < 2 || name.length > 120) {
      skipped++
      continue
    }

    // Synonyme: zeilengetrennt in altLabels
    const altLabels = row['altLabels'] ?? ''
    const synonyms = altLabels
      .split('\n')
      .flatMap((s) => s.split('|'))
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== name)
      .slice(0, 10)

    // Kategorie aus skillType + reuseLevel
    const skillType = row['skillType']?.trim() ?? ''
    const reuseLevel = row['reuseLevel']?.trim() ?? ''
    const category = mapEscoCategory(skillType, reuseLevel)

    skills.push({ name, category, source: 'esco', synonyms })
  }

  console.log(`   ${skills.length} Skills gelesen, ${skipped} übersprungen`)
  return skills
}

// ── Schritt 3: In Supabase importieren ─────────────────────────────────────

async function importToSupabase(
  supabase: ReturnType<typeof createClient>,
  skills: SkillRecord[]
): Promise<{ inserted: number; skipped: number }> {
  const BATCH = 200
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < skills.length; i += BATCH) {
    const batch = skills.slice(i, i + BATCH)

    const { data, error } = await supabase
      .from('skills')
      .upsert(batch, { onConflict: 'name', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`\n   Batch-Fehler bei ${i}: ${error.message}`)
      skipped += batch.length
    } else {
      inserted += data?.length ?? 0
    }

    process.stdout.write(`\r   Fortschritt: ${Math.min(i + BATCH, skills.length)}/${skills.length}`)
  }

  console.log('\n')
  return { inserted, skipped }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Fehlende Umgebungsvariablen: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  if (!fs.existsSync(SKILLS_FILE)) {
    console.error(`❌ Datei nicht gefunden: ${SKILLS_FILE}`)
    console.error('   Bitte ESCO-ZIP entpacken in: scripts/ESCO dataset - v1.2.1 - classification - de - csv/')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Vorherige Anzahl
  const { count: before } = await supabase
    .from('skills')
    .select('*', { count: 'exact', head: true })
  console.log(`\n📊 Skills in DB vor Import: ${before ?? 0}`)

  // 1. Skills lesen
  const skills = await readEscoSkills()

  // 3. Importieren
  console.log(`\n⬆️  Importiere ${skills.length} ESCO-Skills in Batches...`)
  const { inserted, skipped } = await importToSupabase(supabase, skills)

  // Nachher-Anzahl
  const { count: after } = await supabase
    .from('skills')
    .select('*', { count: 'exact', head: true })

  console.log('✅ Import abgeschlossen!')
  console.log(`   Neu eingefügt  : ${inserted}`)
  console.log(`   Übersprungen   : ${skipped} (Fehler oder Duplikate)`)
  console.log(`   Gesamt in DB   : ${after ?? 0}`)

  // Kategorien-Übersicht
  const { data: cats } = await supabase
    .from('skills')
    .select('category')
    .eq('source', 'esco')
    .limit(50000)

  if (cats) {
    const counts: Record<string, number> = {}
    for (const r of cats) counts[r.category] = (counts[r.category] ?? 0) + 1
    console.log('\n📊 ESCO-Kategorien:')
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, n]) => console.log(`   ${cat.padEnd(25)} ${n}`))
  }
}

main().catch((e) => {
  console.error('\n❌ Import fehlgeschlagen:', e instanceof Error ? e.message : e)
  process.exit(1)
})
