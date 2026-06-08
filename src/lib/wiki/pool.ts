import type { WikiPage } from './types'

export const poolPage: WikiPage = {
  slug: 'pool',
  title: 'Mein Pool',
  roles: ['Agentur'],
  sections: [
    {
      heading: 'Was ist der Pool?',
      body: 'Der Pool ist dein internes Ressourcenverzeichnis. Hier pflegst du die Profile deiner Mitarbeiter und Freelancer, die du für Vakanzen einreichen kannst.',
    },
    {
      heading: 'Ressource hinzufügen',
      body: 'Über "Neue Ressource" kannst du ein neues Profil anlegen. Fülle die Pflichtfelder (Name, Skills, Erfahrungslevel, Verfügbarkeit) vollständig aus, um das Profil für Einreichungen nutzen zu können.',
    },
    {
      heading: 'Ressource einreichen',
      body: 'Um eine Ressource für eine Vakanz einzureichen, gehe zu Vakanzen, öffne das Drei-Punkte-Menü der gewünschten Vakanz und wähle "Profil einreichen".',
    },
  ],
}
