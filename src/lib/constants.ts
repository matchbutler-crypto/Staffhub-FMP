// ── Profil-Status ──────────────────────────────────────────────────────────────

export const PROFIL_STATUS = [
  'Eingereicht',
  'In Prüfung',
  'Präsentiert',
  'Interview',
  'Beauftragt',
  'Abgelehnt',
  'Archiviert',
] as const

export type ProfilStatus = typeof PROFIL_STATUS[number]

// ── Vakanz-Status ──────────────────────────────────────────────────────────────

export const VAKANZ_STATUS = [
  'Offen',
  'In Auswahl',
  'Besetzt',
  'Pausiert',
  'Geschlossen',
] as const

export type VakanzStatus = typeof VAKANZ_STATUS[number]

// ── Erfahrungslevel ────────────────────────────────────────────────────────────

export const ERFAHRUNGSLEVEL = ['Junior', 'Mid', 'Senior', 'Expert'] as const

export type Erfahrungslevel = typeof ERFAHRUNGSLEVEL[number]

// ── Arbeitsmodell ──────────────────────────────────────────────────────────────

export const ARBEITSMODELL = ['Remote', 'Hybrid', 'Onsite'] as const

export type Arbeitsmodell = typeof ARBEITSMODELL[number]

// ── Rollen ─────────────────────────────────────────────────────────────────────

export const ROLLEN = ['Admin', 'Staffhub Manager', 'Agentur'] as const

export type Rolle = typeof ROLLEN[number]

// ── Branchen ───────────────────────────────────────────────────────────────────

export const BRANCHEN = [
  'Telekommunikation',
  'IT / Software',
  'Automotive',
  'Banking / Finance',
  'Versicherung',
  'Gesundheitswesen',
  'Handel / E-Commerce',
  'Öffentlicher Sektor',
  'Energie / Utilities',
  'Medien / Entertainment',
  'Sonstige',
] as const

export type Branche = typeof BRANCHEN[number]
