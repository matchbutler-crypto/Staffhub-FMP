import type { WikiPage } from './types'

export const beauftragungenPage: WikiPage = {
  slug: 'beauftragungen',
  title: 'Beauftragungen',
  roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  sections: [
    {
      heading: 'Was sind Beauftragungen?',
      body: 'Eine Beauftragung entsteht, wenn ein eingereichertes Profil für eine Vakanz akzeptiert wurde. Sie dokumentiert den Einsatz einer Ressource beim Kunden.',
    },
    {
      heading: 'Beauftragung anlegen',
      body: 'Admins und Staffhub Manager können Beauftragungen direkt anlegen oder aus einer akzeptierten Profileinreichung erstellen.',
    },
    {
      heading: 'Status & Laufzeit',
      body: 'Beauftragungen haben ein Start- und Enddatum sowie einen Status (Aktiv / Abgeschlossen / Storniert). Aktive Beauftragungen bilden die Basis für die Abrechnung.',
    },
  ],
  tour: [
    {
      element: '[data-tour="beauftragungen-header"]',
      title: 'Beauftragungen',
      description: 'Übersicht aller laufenden und abgeschlossenen Beauftragungen.',
    },
    {
      element: '[data-tour="beauftragungen-filter"]',
      title: 'Filter',
      description: 'Filtere nach Status, Zeitraum oder Agentur.',
    },
  ],
}
