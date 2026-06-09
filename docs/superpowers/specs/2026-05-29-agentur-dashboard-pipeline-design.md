# Design: Agentur-Dashboard Pipeline-Erweiterung

**Datum:** 2026-05-29  
**Status:** Approved

---

## Ziel

Das bestehende Agentur-Dashboard zeigt die Ressourcen-Pipeline und Pool-Stats nur mit den 7 alten Statuses. Nach der Onboarding-Pipeline-Erweiterung (Subsystem A) fehlen 6 neue Statuses. Die lokale Status-Konfiguration wird durch die geteilte `link-status-config.ts` ersetzt, sodass alle 13 Statuses korrekt dargestellt werden.

---

## Nicht im Scope

- Neue API-Endpunkte oder Änderungen an `src/app/api/dashboard/route.ts`
- Server-seitiger Status-Filter
- Neue Seiten oder Routen
- Änderungen an anderen Komponenten als `dashboard/page.tsx`

---

## Betroffene Datei

Nur `src/app/dashboard/page.tsx`.

---

## Änderungen

### 1. Entfernen: Lokale Status-Konfiguration

Die folgenden Elemente werden entfernt:

```ts
// Entfernen:
const LINK_STATUSES = ["Gespielt", "Interview geplant", "Zugesagt", "Beauftragt", "Abgesagt", "Abgelehnt", "Zurückgezogen"] as const
type LinkStatus = typeof LINK_STATUSES[number]
const linkStatusConfig: Record<LinkStatus, { color: string; dot: string; icon: React.ReactNode; label: string }> = { ... }
function getLinkStatusConfig(status: string) { ... }
```

### 2. Hinzufügen: Import aus `link-status-config`

```ts
import { LINK_STATUS_ORDER, getLinkStatusConfig } from "@/lib/link-status-config"
```

`LINK_STATUS_ORDER` ersetzt `LINK_STATUSES` an allen Verwendungsstellen. `getLinkStatusConfig` ersetzt die lokale Funktion.

### 3. Lokale Icons-Map beibehalten

Die geteilte `link-status-config.ts` enthält keine Icons (by design — Icons sind UI-spezifisch). Das Dashboard-eigene `LinkStatusBadge` benötigt Icons. Daher bleibt eine lokale `LINK_STATUS_ICONS`-Map:

```ts
// Bleibt lokal — Icons sind UI-spezifisch und nicht Teil der geteilten Config
const LINK_STATUS_ICONS: Record<string, React.ReactNode> = {
  "Gespielt":                      <Send className="h-3 w-3" />,
  "Interview geplant":             <CalendarClock className="h-3 w-3" />,
  "Zugesagt":                      <CheckCircle2 className="h-3 w-3" />,
  "Stammdaten anfordern":          <FileText className="h-3 w-3" />,
  "Freelancer Prozess gestartet":  <UserCheck className="h-3 w-3" />,
  "Einkauf gestartet":             <ShoppingCart className="h-3 w-3" />,
  "Genehmigung gestartet":         <ClipboardCheck className="h-3 w-3" />,
  "Beauftragt":                    <Briefcase className="h-3 w-3" />,
  "Setup externe Mail & Hardware": <Settings className="h-3 w-3" />,
  "Running":                       <Play className="h-3 w-3" />,
  "Abgesagt":                      <XCircle className="h-3 w-3" />,
  "Abgelehnt":                     <Ban className="h-3 w-3" />,
  "Zurückgezogen":                 <Undo2 className="h-3 w-3" />,
}
```

Icons für neue Statuses aus `lucide-react`: `FileText`, `UserCheck`, `ShoppingCart`, `ClipboardCheck`, `Settings`, `Play` — dieselben wie in `GespielteRessourcenTable.tsx`.

### 4. `LinkStatusBadge` anpassen

```tsx
function LinkStatusBadge({ status }: { status: string }) {
  const cfg = getLinkStatusConfig(status)  // aus shared config
  const icon = LINK_STATUS_ICONS[status] ?? null  // aus lokaler Map
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
      {icon}
      {cfg.label || status}
    </Badge>
  )
}
```

### 5. `LINK_STATUSES` → `LINK_STATUS_ORDER`

Alle Verwendungen von `LINK_STATUSES` werden durch `LINK_STATUS_ORDER` ersetzt:

- Pool-Stats-Kachel (Agentur): Zeigt Counts für alle 13 Statuses
- Filter-Buttons (Agentur + Manager): `activeLinkStatuses` leitet sich aus `LINK_STATUS_ORDER` ab
- Nebeneffekt: Manager-Dashboard-Pipeline zeigt neue Statuses korrekt

---

## Imports

Aus `lucide-react` werden hinzugefügt: `FileText`, `UserCheck`, `ShoppingCart`, `ClipboardCheck`, `Settings`, `Play` (sofern noch nicht importiert).

---

## Automatische Wirkung

| Bereich | Vorher | Nachher |
|---|---|---|
| Pool-Stats-Kachel (Agentur) | Nur 7 Statuses | Alle 13 Statuses |
| Filter-Buttons (Agentur) | Nur 7 aktive Statuses | Alle aktiven Statuses inkl. neuer |
| Status-Badges in Pipeline | 6 neue Statuses → grauer Fallback | Korrekte Farben + Icons |
| Manager-Pipeline-Filter | Nur 7 Statuses | Alle aktiven Statuses |

---

## Tests

Keine neuen Tests nötig. Die Änderung ist rein konfigurationsbasiert (import swap + icons map). Die bestehenden Vitest-Tests bleiben unverändert. TypeScript-Prüfung (`tsc --noEmit`) dient als Verifikation.
