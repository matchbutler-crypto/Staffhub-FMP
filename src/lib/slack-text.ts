export function buildSlackText(
  vakanz: {
    id: string
    rolle: string
    beschreibung: string
    skills: string[]
    erfahrungslevel: string
    startdatum: string
    enddatum?: string | null
    auslastung: number
    arbeitsmodell: string
    standort?: string | null
    branche: string
    teamgroesse?: number | null
    budget_intern?: number | null
  },
  appUrl: string
): string {
  const vakanzUrl = `${appUrl}/vakanzen/${vakanz.id}`
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const year = d.getUTCFullYear()
    return `${day}.${month}.${year}`
  }
  const startFormatiert = fmtDate(vakanz.startdatum)
  const endFormatiert = vakanz.enddatum ? fmtDate(vakanz.enddatum) : '–'

  const lines = [
    `:mega:  ${vakanz.rolle} | NEW`,
    '',
    '*Job Role*',
    vakanz.rolle,
    '',
    '*Job Description & Requirements*',
    vakanz.beschreibung,
    '',
    '*Job Details*',
    ` *Working Location*: ${vakanz.standort ?? '–'}`,
    ` *Workmode:* ${vakanz.arbeitsmodell}`,
    ` *Remote Ratio:* ${vakanz.auslastung} %`,
    ` *Required Skills:* ${vakanz.skills?.join(', ') || '–'}`,
    ` *Relevant Working Experience:* ${vakanz.erfahrungslevel}`,
    ` *Industry:* ${vakanz.branche}`,
    ` *Project Context:* ${vakanz.beschreibung}`,
    ` *Project Stack:* ${vakanz.skills?.join(', ') || '–'}`,
    ` *Team Size:* ${vakanz.teamgroesse ?? '–'}`,
    ` *Job Type:* Freelance`,
    ` *Start date:* ${startFormatiert}`,
    ` *End date:* ${endFormatiert}`,
    ` *Project Language:* –`,
    ...(vakanz.budget_intern != null ? [` *Rate:* ${vakanz.budget_intern} €`] : []),
    '',
    `@channel If your profile matches the vacancy, submit your CV directly: ${vakanzUrl}`,
  ]

  return lines.join('\n')
}
