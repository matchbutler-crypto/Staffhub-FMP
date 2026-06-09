import type { Role, WikiPage } from './types'
import { dashboardPage } from './dashboard'
import { vakanzenPage } from './vakanzen'
import { beauftragungenPage } from './beauftragungen'
import { abrechnungPage } from './abrechnung'
import { poolPage } from './pool'
import { ressourcenPage } from './ressourcen'

export { type WikiPage, type WikiSection, type TourStep, type Role } from './types'

export const wikiPages: WikiPage[] = [
  dashboardPage,
  vakanzenPage,
  beauftragungenPage,
  abrechnungPage,
  poolPage,
  ressourcenPage,
]

export function getWikiPagesByRole(role: Role): WikiPage[] {
  return wikiPages.filter((page) => page.roles.includes(role))
}

export function getWikiPageBySlug(slug: string): WikiPage | null {
  return wikiPages.find((page) => page.slug === slug) ?? null
}
