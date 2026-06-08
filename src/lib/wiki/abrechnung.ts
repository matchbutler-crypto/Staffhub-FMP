import type { WikiPage } from './types'

export const abrechnungPage: WikiPage = {
  slug: 'abrechnung',
  title: 'Abrechnung',
  roles: ['Admin', 'Staffhub Manager', 'Controller'],
  sections: [
    {
      heading: 'Übersicht',
      body: 'Die Abrechnung zeigt alle abrechnungsrelevanten Beauftragungen. Controller sehen eine aggregierte Ansicht, Admins und Manager haben Zugriff auf alle Details.',
    },
    {
      heading: 'Abrechnungszeitraum',
      body: 'Über den Monatsfilter kannst du den Abrechnungszeitraum eingrenzen. Die Tabelle zeigt Tagessätze, Laufzeit und den berechneten Gesamtbetrag.',
    },
    {
      heading: 'Export',
      body: 'Die Abrechnung kann als CSV exportiert werden, um sie in externe Systeme zu übernehmen.',
    },
  ],
}
