export interface StammdatenFields {
  vorname?: string | null
  nachname?: string | null
  geburtsdatum?: string | null
  email?: string | null
  telefon?: string | null
  wohnort?: string | null
}

function fmt(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

function fmtDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  return new Date(value).toLocaleDateString('de-DE')
}

export function buildStammdatenText(fields: StammdatenFields): string {
  return [
    `Vorname: ${fmt(fields.vorname)}`,
    `Nachname: ${fmt(fields.nachname)}`,
    `Geburtsdatum: ${fmtDate(fields.geburtsdatum)}`,
    `E-Mail: ${fmt(fields.email)}`,
    `Telefon: ${fmt(fields.telefon)}`,
    `Wohnort: ${fmt(fields.wohnort)}`,
  ].join('\n')
}
