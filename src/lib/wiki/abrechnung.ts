import type { WikiPage } from './types'

export const abrechnungPage: WikiPage = {
  slug: 'abrechnung',
  title: 'Abrechnung',
  roles: ['Admin', 'Staffhub Manager', 'Controller'],
  sections: [
    {
      heading: 'Wie funktioniert die Abrechnung?',
      body: 'Die Abrechnung basiert auf aktiven Beauftragungen. Für jeden laufenden Monat entsteht automatisch ein Zeitnachweis pro Beauftragung. Admins und Manager sehen alle Details inkl. Einkaufspreis, Verkaufspreis und Marge. Controller sehen die aggregierten Beträge ohne Margendetails.',
    },
    {
      heading: 'Monatsauswahl',
      body: 'Über den Monatsfilter oben wählst du den Abrechnungszeitraum. Standardmäßig ist der aktuelle Monat ausgewählt. Du kannst beliebige vergangene Monate aufrufen.',
    },
    {
      heading: 'Zeitnachweise',
      body: 'Jede Zeile in der Tabelle entspricht einem Zeitnachweis einer Beauftragung. Du siehst Kandidatenname, Agentur, Projektname, Stunden pro Woche, Einkaufspreis (EK), Verkaufspreis (VK) und die berechnete Marge in Prozent.',
    },
    {
      heading: 'Zeitnachweis hochladen & verwalten',
      body: 'Über das Drei-Punkte-Menü (⋮) eines Eintrags kannst du einen Zeitnachweis als Datei hochladen, einen vorhandenen herunterladen oder löschen. Hochgeladene Nachweise sind mit einem Icon markiert.',
    },
    {
      heading: 'Abrechnung sperren',
      body: 'Ein gesperrter Monat kann nicht mehr bearbeitet werden. Admins können einen Monat über das Schloss-Symbol sperren und entsperren. Gesperrte Monate sind mit einem roten Schloss markiert.',
    },
    {
      heading: 'Export',
      body: 'Die Abrechnung des ausgewählten Monats kann als CSV exportiert werden — über den Export-Button oben rechts. Die CSV enthält alle Spalten der Tabelle und lässt sich in Excel oder ähnlichen Tools weiterverarbeiten.',
    },
    {
      heading: 'Gesamtsumme',
      body: 'Die Fußzeile der Tabelle zeigt die Summen aller Einträge im ausgewählten Monat: Gesamt-EK, Gesamt-VK und die kumulierte Marge.',
    },
  ],
}
