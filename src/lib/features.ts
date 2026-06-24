export const FEATURE_KEYS = ['abrechnung_agentur'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const FEATURE_META: Record<
  FeatureKey,
  { label: string; beschreibung: string; navUrl?: string }
> = {
  abrechnung_agentur: {
    label: 'Abrechnung',
    beschreibung: 'Abrechnungs-Modul — Zeitnachweise und Rechnungen einsehen.',
    navUrl: '/abrechnung',
  },
}
