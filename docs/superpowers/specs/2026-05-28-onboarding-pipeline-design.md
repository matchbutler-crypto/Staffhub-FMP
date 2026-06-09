# Design: Onboarding-Pipeline

**Datum:** 2026-05-28  
**Status:** Approved

---

## Ziel

Die bestehende Status-Pipeline für `ressource_vakanz_links` wird um Onboarding-Schritte nach „Zugesagt" und nach „Beauftragt" erweitert. Dadurch kann der Staffhub Manager den internen Beauftragungsprozess vollständig im System abbilden — von der Zusage bis hin zu „Running". Agenturen sehen alle Statuses (read-only). E-Mail-Reminder und Benachrichtigungsglocke sind nicht Teil dieses Specs (folgen separat).

---

## Nicht im Scope

- E-Mail-Reminder an Agentur (kein SMTP-Versand vorhanden)
- Benachrichtigungsglocke (eigener Spec)
- Automatische Stammdaten-Vollständigkeitsprüfung
- Neue API-Endpunkte

---

## Neue Status-Pipeline

```
Gespielt
→ Interview geplant
→ Zugesagt
→ Stammdaten anfordern          ← neu
→ Freelancer Prozess gestartet  ← neu
→ Einkauf gestartet             ← neu
→ Genehmigung gestartet         ← neu
→ Beauftragt                    (bestehende Auto-Logik bleibt: Verfügbarkeit-Lock, FTE-Count, Besetzt-Setzung)
→ Setup externe Mail & Hardware ← neu
→ Running                       ← neu
```

Terminal-Statuses (unverändert): `Abgesagt`, `Abgelehnt`, `Zurückgezogen`

**Berechtigungen:** Nur Staffhub Manager und Admin können Statuses setzen — unverändert.  
**Sichtbarkeit:** Alle Statuses (inkl. neue) sind für Agenturen sichtbar (read-only) — unverändert.  
**Forward-Only:** Die bestehende Vorwärts-Validierung greift für alle neuen Schritte.

---

## Backend-Änderungen

### 1. DB-Migration

Die `status`-Check-Constraint auf `ressource_vakanz_links` muss die neuen Werte erlauben:

```sql
ALTER TABLE ressource_vakanz_links
  DROP CONSTRAINT IF EXISTS ressource_vakanz_links_status_check;

ALTER TABLE ressource_vakanz_links
  ADD CONSTRAINT ressource_vakanz_links_status_check
  CHECK (status IN (
    'Gespielt',
    'Interview geplant',
    'Zugesagt',
    'Stammdaten anfordern',
    'Freelancer Prozess gestartet',
    'Einkauf gestartet',
    'Genehmigung gestartet',
    'Beauftragt',
    'Setup externe Mail & Hardware',
    'Running',
    'Abgesagt',
    'Abgelehnt',
    'Zurückgezogen'
  ));
```

### 2. `src/app/api/ressource-links/[id]/status/route.ts`

**`LINK_STATUS`** — 6 neue Werte ergänzen:
```ts
const LINK_STATUS = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
  'Abgesagt',
  'Abgelehnt',
] as const
```

**`STATUS_ORDER`** — vollständige Vorwärts-Reihenfolge:
```ts
const STATUS_ORDER: LinkStatus[] = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
]
```

Die gesamte Beauftragt-Auto-Logik (Verfügbarkeit, FTE-Count, Vakanz-Besetzt) bleibt **unverändert** — sie greift weiterhin nur beim Übergang `→ Beauftragt`.

---

## UI-Änderungen

### 1. `src/components/GespielteRessourcenTable.tsx`

**`LINK_STATUSES`** — Array um neue Werte erweitern (bestimmt Dropdown-Reihenfolge):
```ts
const LINK_STATUSES = [
  'Gespielt',
  'Interview geplant',
  'Zugesagt',
  'Stammdaten anfordern',
  'Freelancer Prozess gestartet',
  'Einkauf gestartet',
  'Genehmigung gestartet',
  'Beauftragt',
  'Setup externe Mail & Hardware',
  'Running',
  'Abgesagt',
  'Abgelehnt',
] as const
```

**`STATUS_CONFIG`** — neue Einträge (Icons aus `lucide-react`, bereits importiert):

| Status | Tailwind-Klassen | Icon |
|---|---|---|
| Stammdaten anfordern | `bg-amber-50 text-amber-700 border-amber-200` / dot `bg-amber-400` | `FileText` |
| Freelancer Prozess gestartet | `bg-blue-50 text-blue-700 border-blue-200` / dot `bg-blue-400` | `UserCheck` |
| Einkauf gestartet | `bg-blue-50 text-blue-700 border-blue-200` / dot `bg-blue-400` | `ShoppingCart` |
| Genehmigung gestartet | `bg-blue-50 text-blue-700 border-blue-200` / dot `bg-blue-400` | `ClipboardCheck` |
| Setup externe Mail & Hardware | `bg-purple-50 text-purple-700 border-purple-200` / dot `bg-purple-400` | `Settings` |
| Running | `bg-green-50 text-green-700 border-green-200` / dot `bg-green-400` | `Play` |

**Dropdown-Logik:** Die bestehende Einschränkung, dass `Zugesagt` und `Beauftragt` nicht im Dropdown erscheinen dürfen (Zeile 246), wird auf alle Terminal- und Sonderstatuses angepasst. `Running` und `Zurückgezogen` werden ebenfalls aus dem normalen Dropdown ausgeschlossen — `Running` wird nur über den nächsten Schritt nach `Setup externe Mail & Hardware` erreichbar.

### 2. `src/app/ressourcen/[id]/page.tsx` — Beauftragungen-Tab

Der Beauftragungen-Tab zeigt `status` als Badge. Die Fallback-Logik in `getStatusConfig` (FALLBACK_STATUS) deckt unbekannte Status bereits ab — neue Statuses werden trotzdem explizit in die STATUS_CONFIG aufgenommen, damit sie korrekt eingefärbt erscheinen.

Eine eigene `STATUS_CONFIG`-Konstante (analog zu `GespielteRessourcenTable`) wird in `page.tsx` ergänzt oder in eine gemeinsame Datei `src/lib/link-status-config.ts` extrahiert, falls beide Dateien dieselbe Config brauchen.

---

## Geteilte Status-Config (Empfehlung)

Da `GespielteRessourcenTable.tsx` und `ressourcen/[id]/page.tsx` dieselben Status-Farben benötigen, wird die Konfiguration in eine eigene Datei extrahiert:

**`src/lib/link-status-config.ts`**
```ts
export const LINK_STATUS_ORDER = [ /* vollständige Reihenfolge */ ] as const
export type LinkStatusValue = typeof LINK_STATUS_ORDER[number]

export const LINK_STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  'Gespielt':                      { color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400',    label: 'Gespielt' },
  'Interview geplant':             { color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-400', label: 'Interview geplant' },
  'Zugesagt':                      { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Zugesagt' },
  'Stammdaten anfordern':          { color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400',   label: 'Stammdaten anfordern' },
  'Freelancer Prozess gestartet':  { color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400',    label: 'Freelancer Prozess gestartet' },
  'Einkauf gestartet':             { color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400',    label: 'Einkauf gestartet' },
  'Genehmigung gestartet':         { color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400',    label: 'Genehmigung gestartet' },
  'Beauftragt':                    { color: 'bg-teal-50 text-teal-700 border-teal-200',      dot: 'bg-teal-400',    label: 'Beauftragt' },
  'Setup externe Mail & Hardware': { color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400', label: 'Setup ext. Mail & HW' },
  'Running':                       { color: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-400',   label: 'Running' },
  'Abgesagt':                      { color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400', label: 'Abgesagt' },
  'Abgelehnt':                     { color: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-400',    label: 'Abgelehnt' },
  'Zurückgezogen':                 { color: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400',   label: 'Zurückgezogen' },
}

export const LINK_STATUS_FALLBACK = { color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-300', label: '' }

export function getLinkStatusConfig(status: string | null | undefined) {
  return LINK_STATUS_CONFIG[status ?? ''] ?? LINK_STATUS_FALLBACK
}
```

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| DB Migration | Neue `status`-Check-Constraint |
| `src/app/api/ressource-links/[id]/status/route.ts` | `LINK_STATUS` + `STATUS_ORDER` erweitern |
| `src/lib/link-status-config.ts` | Neu — geteilte Status-Config |
| `src/components/GespielteRessourcenTable.tsx` | `LINK_STATUSES`, `STATUS_CONFIG`, Dropdown-Logik — Config aus `link-status-config.ts` importieren |
| `src/app/ressourcen/[id]/page.tsx` | Status-Badges in Beauftragungen-Tab — Config aus `link-status-config.ts` importieren |
