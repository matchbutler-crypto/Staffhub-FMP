import type { WikiPage } from './types'

export const ressourcenPage: WikiPage = {
  slug: 'ressourcen',
  title: 'Ressourcen',
  roles: ['Admin', 'Staffhub Manager'],
  sections: [
    {
      heading: 'Übersicht',
      body: 'Die Ressourcen-Übersicht zeigt alle Profile aus den Pools aller Agenturen. Hier kannst du den aktuellen Status, Verfügbarkeit und Einsatzhistorie jeder Ressource einsehen.',
    },
    {
      heading: 'Filter & Suche',
      body: 'Filtere nach Agentur, Status (Verfügbar / Im Einsatz / Pausiert) oder Suchbegriff. Die Ansicht hilft beim schnellen Abgleich von Bedarf und Verfügbarkeit.',
    },
    {
      heading: 'Ressource bearbeiten',
      body: 'Admins können Ressourcen direkt bearbeiten. Über das Drei-Punkte-Menü sind Bearbeiten, Statusänderung und Löschen erreichbar.',
    },
  ],
}
