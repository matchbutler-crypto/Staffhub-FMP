import type { WikiPage } from './types'

export const dashboardPage: WikiPage = {
  slug: 'dashboard',
  title: 'Dashboard',
  roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  sections: [
    {
      heading: 'Übersicht',
      body: 'Das Dashboard zeigt dir eine Zusammenfassung aller relevanten Kennzahlen auf einen Blick. Abhängig von deiner Rolle siehst du unterschiedliche Karten und Statistiken.',
    },
    {
      heading: 'Kennzahlen',
      body: 'Die Karten zeigen aktive Vakanzen, laufende Beauftragungen und offene Abrechnungen. Klicke auf eine Karte um direkt zur jeweiligen Übersicht zu gelangen.',
    },
  ],
}
