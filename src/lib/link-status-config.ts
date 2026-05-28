export const LINK_STATUS_ORDER = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
  'Abgesagt',
  'Abgelehnt',
  'Zurückgezogen',
] as const

export type LinkStatusValue = (typeof LINK_STATUS_ORDER)[number]

export interface LinkStatusStyle {
  color: string
  dot: string
  label: string
}

export const LINK_STATUS_CONFIG: Record<string, LinkStatusStyle> = {
  'Gespielt':                      { color: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-400',    label: 'Gespielt' },
  'Interview geplant':             { color: 'bg-violet-50 text-violet-700 border-violet-200',  dot: 'bg-violet-400',  label: 'Interview geplant' },
  'Zugesagt':                      { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Zugesagt' },
  'Stammdaten anfordern':          { color: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-400',   label: 'Stammdaten anfordern' },
  'Freelancer Prozess gestartet':  { color: 'bg-sky-50 text-sky-700 border-sky-200',           dot: 'bg-sky-400',     label: 'Freelancer Prozess gestartet' },
  'Einkauf gestartet':             { color: 'bg-indigo-50 text-indigo-700 border-indigo-200',  dot: 'bg-indigo-400',  label: 'Einkauf gestartet' },
  'Genehmigung gestartet':         { color: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-400',    label: 'Genehmigung gestartet' },
  'Beauftragt':                    { color: 'bg-teal-50 text-teal-700 border-teal-200',        dot: 'bg-teal-400',    label: 'Beauftragt' },
  'Setup externe Mail & Hardware': { color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400',  label: 'Setup ext. Mail & HW' },
  'Running':                       { color: 'bg-green-50 text-green-700 border-green-200',     dot: 'bg-green-400',   label: 'Running' },
  'Abgesagt':                      { color: 'bg-orange-50 text-orange-700 border-orange-200',  dot: 'bg-orange-400',  label: 'Abgesagt' },
  'Abgelehnt':                     { color: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-400',     label: 'Abgelehnt' },
  'Zurückgezogen':                 { color: 'bg-gray-100 text-gray-500 border-gray-200',       dot: 'bg-gray-400',    label: 'Zurückgezogen' },
}

export const LINK_STATUS_FALLBACK: LinkStatusStyle = {
  color: 'bg-gray-100 text-gray-600 border-gray-200',
  dot: 'bg-gray-300',
  label: '',
}

export function getLinkStatusConfig(status: string | null | undefined): LinkStatusStyle {
  return LINK_STATUS_CONFIG[status ?? ''] ?? LINK_STATUS_FALLBACK
}
