import type { WikiPage } from './types'

export const ressourcenPage: WikiPage = {
  slug: 'ressourcen',
  title: 'Ressourcen',
  roles: ['Admin', 'Staffhub Manager'],
  tour: [
    {
      element: '[data-tour="ressourcen-header"]',
      title: 'Freelancer-Pool',
      description: 'Hier siehst du alle Profile aus den Pools aller Agenturen auf einen Blick — inklusive Verfügbarkeit, Pipeline-Status und EK-Rate.',
    },
    {
      element: '[data-tour="ressourcen-search"]',
      title: 'Suche',
      description: 'Filtere nach Name oder Skill. Die Suche durchsucht alle Ressourcen gleichzeitig nach beiden Feldern.',
    },
    {
      element: '[data-tour="ressourcen-filter"]',
      title: 'Filter',
      description: 'Grenze die Auswahl nach Verfügbarkeit, Erfahrungslevel oder Agentur ein. Mit "Beauftragt" siehst du gezielt alle aktuell im Einsatz befindlichen Ressourcen.',
    },
    {
      element: '[data-tour="ressourcen-table"]',
      title: 'Ressourcen-Tabelle',
      description: 'Klicke auf eine Zeile um das vollständige Profil zu öffnen. Das Pfeil-Symbol in der "Gespielt"-Spalte zeigt die Vakanz-Pipeline der Ressource — aufklappen um Status weiterzuschalten.',
    },
  ],
  sections: [
    {
      heading: 'Was zeigt die Ressourcen-Übersicht?',
      body: 'Hier siehst du alle Profile aus den Pools aller Agenturen in einer zentralen Übersicht. Im Gegensatz zur Vakanz-Pipeline, die profilbezogen ist, zeigt diese Seite den Status jeder Ressource übergreifend — inklusive aktueller Verfügbarkeit, Einsatzhistorie und Pipeline-Status.',
    },
    {
      heading: 'Verfügbarkeits-Status',
      body: 'Jede Ressource hat einen Verfügbarkeits-Status der von der Agentur gepflegt wird: "Jetzt verfügbar", "Verfügbar ab [Datum]", "Nicht verfügbar" oder "Deaktiviert". Dieser Status gibt einen schnellen Überblick ob eine Ressource für neue Vakanzen in Frage kommt.',
    },
    {
      heading: 'Pipeline-Status einer Ressource',
      body: 'Ressourcen die aktuell für eine Vakanz eingereicht sind, haben zusätzlich einen Pipeline-Status: Gespielt → Interview geplant → Zugesagt → Stammdaten anfordern → Freelancer Prozess gestartet → Einkauf gestartet → Genehmigung gestartet → Beauftragt → Setup ext. Mail & HW → Running. Dieser Status kann vom Manager direkt aus der Ressourcen-Übersicht weitergeschaltet werden.',
    },
    {
      heading: 'Ressource einsetzen ("spielen")',
      body: 'Über "Ressource einsetzen" (oder das Pfeil-Icon) kannst du eine Ressource direkt einer Vakanz zuordnen und in die Pipeline aufnehmen — ohne dass die Agentur erst einreichen muss. Das ist nützlich wenn du proaktiv eine passende Ressource gefunden hast.',
    },
    {
      heading: 'Suche & Filter',
      body: 'Filtere nach Agentur, Verfügbarkeit, Erfahrungslevel oder Suchbegriff (Name, Skills). Mit "Beauftragt" kannst du gezielt alle aktuell im Einsatz befindlichen Ressourcen anzeigen.',
    },
    {
      heading: 'Ressourcen-Detailansicht',
      body: 'Ein Klick auf eine Ressource öffnet das vollständige Profil: Kontaktdaten, Skills, Einsatzhistorie, eingereichte Vakanzen, KI-Bewertung, Kommentare und hochgeladene Dokumente. Von hier aus kannst du den Status ändern, Kommentare hinterlassen oder Dokumente herunterladen.',
    },
    {
      heading: 'Massenaktion: PDF-Extraktion',
      body: 'Über die Mehrfachauswahl (Checkboxen) kannst du mehrere Profile gleichzeitig auswählen und als anonymisierte PDFs exportieren. Praktisch um mehrere Kandidaten auf einmal beim Kunden zu präsentieren.',
    },
    {
      heading: 'Favoriten',
      body: 'Ressourcen können mit dem Stern (☆) als Favorit markiert werden. Favoriten erscheinen oben in der Liste und helfen dabei, häufig benötigte Profile schnell zu finden.',
    },
  ],
}
