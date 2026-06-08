import type { WikiPage } from './types'

export const vakanzenPage: WikiPage = {
  slug: 'vakanzen',
  title: 'Vakanzen',
  roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  sections: [
    {
      heading: 'Was ist eine Vakanz?',
      body: 'Eine Vakanz ist eine offene Stelle oder ein Projektbedarf beim Kunden. Admins und Staffhub Manager legen Vakanzen an und verwalten sie. Agenturen sehen die für sie freigegebenen Vakanzen und können Profile aus ihrem Pool einreichen.',
    },
    {
      heading: 'Vakanz-Status',
      body: 'Jede Vakanz hat einen Status: Offen (aktiv suchend), In Auswahl (Profile werden geprüft), Besetzt (Stelle wurde vergeben), Pausiert (vorübergehend gestoppt), Geschlossen (nicht mehr aktiv). Der Status ist farblich markiert und kann vom Manager jederzeit geändert werden.',
    },
    {
      heading: 'Neue Vakanz anlegen (Admin & Manager)',
      body: 'Über "Neue Vakanz" öffnet sich ein Formular. Pflichtfelder sind: Jobtitel, Erfahrungslevel (Junior / Mid / Senior / Expert), Arbeitsmodell (Remote / Hybrid / Onsite) und Startdatum. Optional kannst du Projektname, Branche, Stunden pro Woche, Tagessatz-Rahmen und eine Beschreibung hinterlegen.',
    },
    {
      heading: 'Vakanz duplizieren',
      body: 'Über das Drei-Punkte-Menü (⋮) einer Vakanz kannst du sie duplizieren. Das erstellt eine identische Kopie mit Status "Offen" — praktisch wenn ähnliche Stellen mehrfach besetzt werden sollen.',
    },
    {
      heading: 'Profil einreichen (Agentur)',
      body: 'Als Agentur klickst du beim Drei-Punkte-Menü (⋮) einer Vakanz auf "Profil einreichen". Du wählst dann eine Ressource aus deinem Pool aus. Nach dem Einreichen ist das Profil mit Status "Eingereicht" in der Pipeline des Managers sichtbar.',
    },
    {
      heading: 'Eingereichte Profile einsehen (Manager & Admin)',
      body: 'Unter jeder Vakanz siehst du eine Tabelle aller eingereichten Profile mit ihrem aktuellen Pipeline-Status. Von hier aus kannst du den Status eines Profils direkt weiterschalten (z.B. auf "Interview geplant" oder "Zugesagt").',
    },
    {
      heading: 'Suche & Filter',
      body: 'Die Vakanzen-Übersicht lässt sich nach Suchbegriff (Jobtitel), Status, Erfahrungslevel und Arbeitsmodell filtern. Manager sehen zusätzlich einen Filter für "Meine Vakanzen". Die aktiven Filter werden als Tags angezeigt und können einzeln entfernt werden.',
    },
  ],
  tour: [
    {
      element: '[data-tour="vakanzen-header"]',
      title: 'Vakanzen-Übersicht',
      description: 'Hier siehst du alle Vakanzen. Als Agentur nur die für dich freigegebenen, als Manager alle.',
    },
    {
      element: '[data-tour="vakanzen-search"]',
      title: 'Suche & Filter',
      description: 'Filtere nach Status (Offen, Besetzt…), Erfahrungslevel (Junior bis Expert) oder Arbeitsmodell (Remote, Hybrid, Onsite).',
    },
    {
      element: '[data-tour="vakanzen-new"]',
      title: 'Neue Vakanz anlegen',
      description: 'Admins und Manager können hier eine neue Stelle anlegen. Für Agenturen nicht sichtbar.',
    },
  ],
}
