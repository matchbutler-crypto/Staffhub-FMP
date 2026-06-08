import type { WikiPage } from './types'

export const poolPage: WikiPage = {
  slug: 'pool',
  title: 'Mein Pool',
  roles: ['Agentur'],
  sections: [
    {
      heading: 'Was ist der Pool?',
      body: 'Der Pool ist dein persönliches Ressourcenverzeichnis. Hier pflegst du alle Profile deiner Mitarbeiter und Freelancer, die du für Vakanzen einreichen kannst. Nur du und die Staffhub Manager sehen deinen Pool.',
    },
    {
      heading: 'Ressource anlegen',
      body: 'Über "Neue Ressource" öffnet sich ein Formular. Pflichtfelder: Name, Erfahrungslevel (Junior / Mid / Senior / Expert) und Verfügbarkeit. Optional: Rolle/Jobtitel, Skills (als Tags), Tagessatz, Stunden pro Woche, Branche und eine Kurzbeschreibung.',
    },
    {
      heading: 'Verfügbarkeit',
      body: 'Jede Ressource hat einen Verfügbarkeits-Status: "Jetzt verfügbar", "Verfügbar ab [Datum]", "Nicht verfügbar" oder "Deaktiviert". Halte diesen Status aktuell — der Staffhub Manager sieht ihn bei der Suche nach passenden Profilen.',
    },
    {
      heading: 'CV & Dokumente',
      body: 'Du kannst pro Ressource einen anonymisierten CV als PDF hochladen. Der CV wird beim Einreichen eines Profils automatisch mitgeschickt. Hochgeladene CVs lassen sich jederzeit ersetzen oder löschen.',
    },
    {
      heading: 'Skills & Tags',
      body: 'Skills werden als frei wählbare Tags hinterlegt (z.B. "Java", "AWS", "Scrum"). Gib einen Begriff ein und bestätige mit Enter oder Komma. Diese Tags helfen dem Manager bei der Suche nach passenden Ressourcen.',
    },
    {
      heading: 'Favoriten',
      body: 'Ressourcen die du besonders häufig einreichst, kannst du mit dem Stern (☆) als Favorit markieren. Favoriten erscheinen immer ganz oben in der Liste.',
    },
    {
      heading: 'KI-Bewertung',
      body: 'Für jede Ressource kann eine KI-gestützte Bewertung angefordert werden. Die KI analysiert Erfahrungslevel, Skills und Beschreibung und gibt eine strukturierte Einschätzung zurück. Die Bewertung wird als Hinweistext am Profil gespeichert.',
    },
    {
      heading: 'Profil für eine Vakanz einreichen',
      body: 'Gehe zur Vakanzen-Übersicht, öffne das Drei-Punkte-Menü (⋮) der gewünschten Vakanz und wähle "Profil einreichen". Du wählst eine Ressource aus deinem Pool — nach dem Einreichen ist das Profil mit Status "Eingereicht" beim Manager sichtbar.',
    },
    {
      heading: 'Einreichungsstatus verfolgen',
      body: 'Den aktuellen Status eines eingereichten Profils siehst du im Dashboard unter "Meine Einreichungen". Die möglichen Status sind: Eingereicht → In Prüfung → Präsentiert → Interview → Beauftragt oder Abgelehnt.',
    },
  ],
}
