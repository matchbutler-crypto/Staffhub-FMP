import type { WikiPage } from './types'

export const beauftragungenPage: WikiPage = {
  slug: 'beauftragungen',
  title: 'Beauftragungen',
  roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  sections: [
    {
      heading: 'Was ist eine Beauftragung?',
      body: 'Eine Beauftragung dokumentiert den aktiven Einsatz einer Ressource beim Kunden. Sie entsteht wenn ein eingereichtes Profil in der Pipeline den Status "Beauftragt" erhält und der Manager den Einsatz formalisiert — mit Startdatum, Stunden pro Woche, Einkaufs- und Verkaufspreis.',
    },
    {
      heading: 'Beauftragung anlegen (Admin & Manager)',
      body: 'Eine Beauftragung kann über zwei Wege entstehen: direkt über "Neue Beauftragung" mit manuellen Eingaben, oder automatisch aus einer Vakanz wenn ein Profil auf "Beauftragt" gesetzt wird. Pflichtfelder: Kandidatenname, Agentur, Vakanz/Projektname, Startdatum, Stunden pro Woche, Einkaufspreis und Verkaufspreis.',
    },
    {
      heading: 'Aktiv vs. Abgeschlossen',
      body: 'Die Übersicht zeigt standardmäßig nur aktive Beauftragungen. Über den Filter "Alle" siehst du auch abgeschlossene. Eine Beauftragung wird als abgeschlossen markiert wenn das Enddatum erreicht ist oder der Manager sie manuell beendet.',
    },
    {
      heading: 'Meine Beauftragungen (Agentur)',
      body: 'Als Agentur siehst du ausschließlich die Beauftragungen deiner eigenen Ressourcen — Kandidatenname, Projektname, Startdatum, Stunden pro Woche und Status. Preise und Margen sind für Agenturen nicht sichtbar.',
    },
    {
      heading: 'Beauftragung bearbeiten & beenden',
      body: 'Über das Drei-Punkte-Menü (⋮) einer Beauftragung können Admins und Manager die Daten bearbeiten oder die Beauftragung beenden. Das Beenden setzt das Enddatum auf heute und markiert sie als abgeschlossen.',
    },
    {
      heading: 'Verbindung zur Abrechnung',
      body: 'Aktive Beauftragungen sind die Basis für die monatliche Abrechnung. Aus jeder aktiven Beauftragung entsteht automatisch ein Zeitnachweis-Eintrag für den laufenden Monat, der in der Abrechnung sichtbar ist.',
    },
  ],
  tour: [
    {
      element: '[data-tour="beauftragungen-header"]',
      title: 'Beauftragungen',
      description: 'Übersicht aller laufenden Einsätze. Jede Karte zeigt Kandidat, Agentur, Projektname und Laufzeit.',
    },
    {
      element: '[data-tour="beauftragungen-filter"]',
      title: 'Aktiv / Alle',
      description: 'Standardmäßig werden nur aktive Beauftragungen angezeigt. Mit "Alle" siehst du auch abgeschlossene.',
    },
  ],
}
