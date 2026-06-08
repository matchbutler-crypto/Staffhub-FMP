import type { WikiPage } from './types'

export const vakanzenPage: WikiPage = {
  slug: 'vakanzen',
  title: 'Vakanzen',
  roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  sections: [
    {
      heading: 'Was sind Vakanzen?',
      body: 'Vakanzen sind offene Stellen oder Projektbedarfe, die von Staffhub Managern angelegt werden. Agenturen können passende Profile für diese Vakanzen einreichen.',
    },
    {
      heading: 'Neue Vakanz anlegen',
      body: 'Admins und Staffhub Manager können über den Button "Neue Vakanz" eine neue Stelle anlegen. Dabei werden Titel, Erfahrungslevel, Arbeitsmodell, Startdatum und weitere Details hinterlegt.',
    },
    {
      heading: 'Profil einreichen (Agentur)',
      body: 'Als Agentur kannst du über das Drei-Punkte-Menü einer Vakanz ein Profil aus deinem Pool einreichen. Das Profil wird anschließend vom Staffhub Manager geprüft.',
    },
    {
      heading: 'Status einer Vakanz',
      body: 'Vakanzen durchlaufen verschiedene Status: Offen → In Prüfung → Besetzt / Geschlossen. Der aktuelle Status ist farblich markiert.',
    },
  ],
  tour: [
    {
      element: '[data-tour="vakanzen-header"]',
      title: 'Vakanzen-Übersicht',
      description: 'Hier siehst du alle Vakanzen, nach deiner Rolle gefiltert.',
    },
    {
      element: '[data-tour="vakanzen-search"]',
      title: 'Suche & Filter',
      description: 'Suche nach Titel oder filtere nach Status, Erfahrungslevel und Arbeitsmodell.',
    },
    {
      element: '[data-tour="vakanzen-new"]',
      title: 'Neue Vakanz',
      description: 'Lege hier eine neue Vakanz an. Nur für Admins und Staffhub Manager sichtbar.',
    },
  ],
}
