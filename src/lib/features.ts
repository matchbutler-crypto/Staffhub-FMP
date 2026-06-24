export const FEATURE_KEYS = ['mein_pool', 'abrechnung_agentur'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; beschreibung: string; navUrl?: string }
> = {
  mein_pool: {
    label: 'Mein Pool',
    beschreibung: 'Ressourcen-Pool — eigene Kandidaten verwalten und zuweisen.',
    navUrl: '/pool',
  },
  abrechnung_agentur: {
    label: 'Abrechnung',
    beschreibung: 'Abrechnungs-Modul — Zeitnachweise und Rechnungen einsehen.',
    navUrl: '/abrechnung',
  },
}
