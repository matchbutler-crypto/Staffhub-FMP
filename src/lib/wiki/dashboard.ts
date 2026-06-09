import type { WikiPage } from './types'

export const dashboardPage: WikiPage = {
  slug: 'dashboard',
  title: 'Dashboard',
  roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  sections: [
    {
      heading: 'Dein persönliches Cockpit',
      body: 'Das Dashboard zeigt dir auf einen Blick die wichtigsten Kennzahlen für deine Rolle. Staffhub Manager und Admins sehen KPIs zu Vakanzen, Beauftragungen und Monatsmarge. Agenturen sehen den Status ihrer eigenen Einreichungen. Controller sehen die Abrechnungsübersicht.',
    },
    {
      heading: 'KPI-Karten (Manager & Admin)',
      body: 'Die drei Karten oben zeigen: aktive Vakanzen (offene Stellen), aktive Beauftragungen (laufende Einsätze) und die Monatsmarge in Euro. Ein Klick auf eine Karte führt direkt zur jeweiligen Übersicht.',
    },
    {
      heading: 'Neueste Vakanzen',
      body: 'Die Tabelle "Neueste Vakanzen" listet die zuletzt angelegten offenen Stellen mit Titel und Erstelldatum. So siehst du auf einen Blick was neu dazugekommen ist, ohne die Vakanzen-Übersicht öffnen zu müssen.',
    },
    {
      heading: 'Pool-Pipeline (Manager & Admin)',
      body: 'Der Pipeline-Bereich zeigt wie viele Ressourcen sich aktuell in welchem Status befinden — von "Gespielt" bis "Running". Das gibt einen schnellen Überblick über den Fortschritt aller eingereichten Profile über alle Vakanzen hinweg.',
    },
    {
      heading: 'Meine Einreichungen (Agentur)',
      body: 'Als Agentur siehst du hier den aktuellen Status aller deiner eingereichten Profile: welche geprüft werden, welche im Interview-Prozess sind, und welche bereits beauftragt wurden.',
    },
    {
      heading: 'Warnhinweise',
      body: 'Das Dashboard warnt dich aktiv bei: Vakanzen ohne eingereichte Profile (älter als 7 Tage) und Beauftragungen die in den nächsten 30 Tagen auslaufen. So verpasst du keine wichtigen Fristen.',
    },
  ],
}
