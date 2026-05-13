/**
 * O*NET Technology Skills Import
 *
 * Downloads the O*NET Technology Skills database and imports unique
 * technology names into the Supabase skills table.
 *
 * Run: npx tsx scripts/import-onet-skills.ts
 *
 * O*NET data is public domain (US Dept. of Labor).
 * Source: https://www.onetcenter.org/database.html
 */

import { createClient } from '@supabase/supabase-js'
import * as https from 'https'
import * as http from 'http'

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// O*NET Technology Skills TSV — try latest version first, fallback to older
const ONET_URLS = [
  'https://www.onetcenter.org/dl_files/database/db_29_0_text/Technology%20Skills.txt',
  'https://www.onetcenter.org/dl_files/database/db_28_3_text/Technology%20Skills.txt',
  'https://www.onetcenter.org/dl_files/database/db_28_2_text/Technology%20Skills.txt',
  'https://www.onetcenter.org/dl_files/database/db_28_1_text/Technology%20Skills.txt',
  'https://www.onetcenter.org/dl_files/database/db_28_0_text/Technology%20Skills.txt',
]

// O*NET category → our simplified category
const CATEGORY_MAP: Record<string, string> = {
  'development environment software': 'Languages',
  'object or component oriented development software': 'Languages',
  'compiler and decompiler software': 'Languages',
  'web platform development software': 'Frontend',
  'graphics or photo imaging software': 'Frontend',
  'desktop publishing software': 'Frontend',
  'presentation software': 'Tools',
  'animation software': 'Frontend',
  'database management system software': 'Databases',
  'database reporting software': 'Databases',
  'data base user interface and query software': 'Databases',
  'business intelligence and data analysis software': 'Databases',
  'cloud-based data access and sharing software': 'Cloud',
  'cloud-based management software': 'Cloud',
  'cloud-based protection or security software': 'Cloud',
  'network monitoring software': 'DevOps',
  'operating system software': 'Tools',
  'configuration management software': 'DevOps',
  'platform interconnectivity software': 'DevOps',
  'program testing software': 'Tools',
  'project management software': 'Tools',
  'version management software': 'Tools',
  'enterprise resource planning erp software': 'Tools',
  'enterprise application integration software': 'Backend',
  'application server software': 'Backend',
  'transaction server software': 'Backend',
  'middleware software': 'Backend',
  'network security and virtual private network vpn equipment and software': 'DevOps',
  'intrusion detection software': 'DevOps',
  'firewall software': 'DevOps',
  'backup or archival software': 'Tools',
  'content workflow software': 'Tools',
  'customer relationship management crm software': 'Tools',
  'computer based training software': 'Tools',
  'human resources software': 'Tools',
  'office suite software': 'Tools',
  'word processing software': 'Tools',
  'spreadsheet software': 'Tools',
  'calendar and scheduling software': 'Tools',
  'email software': 'Tools',
  'video conferencing software': 'Tools',
  'virtualization software': 'DevOps',
  'desktop communications software': 'Tools',
  'helpdesk or call center software': 'Tools',
  'medical software': 'Tools',
  'industrial control software': 'Tools',
  'geographic information system': 'Tools',
  'materials requirements planning logistics and supply chain software': 'Tools',
  'access software': 'Tools',
  'accounting software': 'Tools',
  'authentication server software': 'Backend',
  'file versioning software': 'Tools',
  'metadata management software': 'Tools',
  'document management software': 'Tools',
  'electronic mail software': 'Tools',
  'expert system software': 'Backend',
  'filesystem software': 'Tools',
  'information retrieval or search software': 'Backend',
  'internet browser software': 'Tools',
  'network management software': 'DevOps',
  'pattern design software': 'Frontend',
  'portal server software': 'Backend',
  'reporting software': 'Tools',
  'storage networking software': 'DevOps',
  'web server software': 'Backend',
}

// Known false-positives / generic entries to skip
const SKIP_LIST = new Set([
  'n/a', 'not applicable', 'na', '', 'other', 'various',
  'microsoft office', 'microsoft windows', 'apple macos',
])

// ── Helpers ──────────────────────────────────────────────────────────────────

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        res.resume()
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function downloadOnetFile(): Promise<string> {
  for (const url of ONET_URLS) {
    try {
      console.log(`Trying: ${url}`)
      const text = await fetchText(url)
      if (text.includes('O*NET-SOC Code') || text.includes('Example')) {
        console.log(`✅ Downloaded from: ${url}`)
        return text
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ↳ Failed: ${msg}`)
    }
  }
  throw new Error('Could not download O*NET file from any known URL')
}

interface SkillEntry {
  name: string
  category: string
  source: string
  synonyms: string[]
  hot: boolean
}

function mapCategory(onetCategory: string): string {
  const key = onetCategory.toLowerCase().trim()
  return CATEGORY_MAP[key] ?? 'Tools'
}

/**
 * Clean up O*NET example names like "Adobe Systems Adobe Acrobat" → "Adobe Acrobat"
 * or "Amazon Web Services AWS" → "AWS"
 */
function cleanName(raw: string): string {
  const name = raw.trim()

  // Known rewrites
  const rewrites: Record<string, string> = {
    'Amazon Web Services AWS': 'AWS',
    'Microsoft SQL Server': 'SQL Server',
    'Microsoft Azure': 'Azure',
    'Microsoft Visual Studio': 'Visual Studio',
    'Microsoft Visual Studio Code': 'VS Code',
    'Microsoft .NET Framework': '.NET',
    'Microsoft PowerShell': 'PowerShell',
    'Microsoft Excel': 'Excel',
    'Microsoft Word': 'Word',
    'Google Cloud': 'Google Cloud',
    'Google Kubernetes Engine': 'GKE',
    'Apache Hadoop': 'Hadoop',
    'Apache Kafka': 'Kafka',
    'Apache Spark': 'Apache Spark',
    'Apache Maven': 'Maven',
    'Apache Tomcat': 'Tomcat',
    'HashiCorp Terraform': 'Terraform',
    'HashiCorp Vault': 'Vault',
    'Elastic Elasticsearch': 'Elasticsearch',
    'GitHub Actions': 'GitHub Actions',
    'GitLab CI/CD': 'GitLab CI/CD',
  }

  return rewrites[name] ?? name
}

function parseTsv(tsv: string): SkillEntry[] {
  const lines = tsv.split('\n')

  // Find header line
  const headerIdx = lines.findIndex(
    (l) => l.includes('Example') || l.includes('O*NET-SOC Code')
  )
  if (headerIdx === -1) throw new Error('Could not find header in TSV')

  const header = lines[headerIdx].split('\t').map((h) => h.trim().toLowerCase())
  const exampleCol = header.findIndex((h) => h === 'example')
  const hotCol = header.findIndex((h) => h.includes('hot'))
  // O*NET v29 uses "Commodity Title" as the category column
  const categoryCol = header.findIndex(
    (h) => h === 'commodity title' || h === 'category' || h.includes('title')
  )

  if (exampleCol === -1) throw new Error('No "Example" column found in TSV')

  const seen = new Map<string, SkillEntry>() // keyed by lowercase name

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split('\t')
    const raw = cols[exampleCol]?.trim() ?? ''
    if (!raw) continue

    const name = cleanName(raw)
    const key = name.toLowerCase()

    if (SKIP_LIST.has(key)) continue
    if (name.length < 2 || name.length > 80) continue
    // Skip entries that look like full sentences
    if (name.split(' ').length > 6) continue

    const hot = hotCol !== -1 && cols[hotCol]?.trim().toUpperCase() === 'Y'
    const onetCategory = categoryCol !== -1 ? cols[categoryCol]?.trim() ?? '' : ''
    const category = mapCategory(onetCategory)

    if (!seen.has(key)) {
      seen.set(key, { name, category, source: 'onet', synonyms: [], hot })
    } else if (hot) {
      // Upgrade to hot if we encounter a hot-marked duplicate
      seen.get(key)!.hot = true
    }
  }

  return Array.from(seen.values())
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Download
  console.log('\n📥 Downloading O*NET Technology Skills...')
  const tsv = await downloadOnetFile()

  // 2. Parse
  console.log('🔍 Parsing skills...')
  const skills = parseTsv(tsv)

  const hotCount = skills.filter((s) => s.hot).length
  console.log(`   Found ${skills.length} unique skills (${hotCount} hot/in-demand)`)

  // 3. Check existing count
  const { count: before } = await supabase
    .from('skills')
    .select('*', { count: 'exact', head: true })
  console.log(`   Existing DB skills: ${before ?? 0}`)

  // 4. Upsert in batches (Supabase has a row limit per request)
  const BATCH = 200
  let inserted = 0
  let skipped = 0

  console.log(`\n⬆️  Inserting in batches of ${BATCH}...`)

  for (let i = 0; i < skills.length; i += BATCH) {
    const batch = skills.slice(i, i + BATCH).map(({ hot: _hot, ...s }) => s)

    const { error, data } = await supabase
      .from('skills')
      .upsert(batch, { onConflict: 'name', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`   Batch ${i / BATCH + 1} error:`, error.message)
      skipped += batch.length
    } else {
      inserted += data?.length ?? 0
    }

    process.stdout.write(`\r   Progress: ${Math.min(i + BATCH, skills.length)}/${skills.length}`)
  }

  console.log('\n')

  // 5. Final count
  const { count: after } = await supabase
    .from('skills')
    .select('*', { count: 'exact', head: true })

  console.log(`✅ Done!`)
  console.log(`   New skills inserted : ${(after ?? 0) - (before ?? 0)}`)
  console.log(`   Total skills in DB  : ${after ?? 0}`)
  if (skipped > 0) console.log(`   Skipped (errors)    : ${skipped}`)

  // 6. Category breakdown
  const { data: cats } = await supabase
    .from('skills')
    .select('category')

  if (cats) {
    const counts: Record<string, number> = {}
    for (const row of cats) {
      counts[row.category] = (counts[row.category] ?? 0) + 1
    }
    console.log('\n📊 Category breakdown:')
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, n]) => console.log(`   ${cat.padEnd(20)} ${n}`))
  }
}

main().catch((e) => {
  console.error('\n❌ Import failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
