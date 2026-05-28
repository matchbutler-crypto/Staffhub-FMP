# Design: Ressourcen-Historienfeed

**Datum:** 2026-05-28  
**Status:** Approved

---

## Ziel

Ein vierter Tab „Historie" in der Ressourcen-Detailansicht (`/ressourcen/[id]`), der alle Änderungen und manuellen Notizen chronologisch als Timeline anzeigt. Admins und Staffhub Manager können manuelle Einträge hinzufügen; Agenturen haben nur Leserechte.

---

## Bestehende Infrastruktur (kein Schema-Change nötig)

- **Tabelle:** `ressource_historie` mit Spalten `id`, `ressource_id`, `link_id`, `typ` (`system` | `manuell`), `text`, `created_at`, `erstellt_von`
- **Join:** `profiles!erstellt_von(id, name, rolle)`
- **API GET:** `GET /api/ressourcen/[id]/historie` — bereits vollständig implementiert
- **API POST:** `POST /api/ressourcen/[id]/historie` — bereits vorhanden, muss auf Manager eingeschränkt werden
- **Helper:** `src/lib/log-historie.ts` → `logHistorie()` — bereits in CV-Upload und Feedback genutzt

---

## Änderungen am Backend

### 1. `PATCH /api/ressourcen/[id]` (Stammdaten-Schnellbearbeitung)
Nach erfolgreichem DB-Update `logHistorie` aufrufen:
```ts
await logHistorie({
  ressourceId: id,
  text: 'Stammdaten aktualisiert',
  typ: 'system',
  erstelltVon: user.id,
  supabase,
})
```

### 2. `PUT /api/ressourcen/[id]` (Vollständige Stammdaten-Bearbeitung)
Gleiche Ergänzung wie PATCH.

### 3. `POST /api/ressourcen/[id]/historie` — Berechtigungseinschränkung
Aktuell können auch Agentur-Nutzer manuelle Einträge erstellen. Das muss eingeschränkt werden:
```ts
const isManager = auth.profile.rolle === 'Admin' || auth.profile.rolle === 'Staffhub Manager'
if (!isManager) {
  return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
}
```
Die bestehende Eigentümlichkeits-Prüfung für Agenturen entfällt damit vollständig.

---

## UI-Änderungen (`src/app/ressourcen/[id]/page.tsx`)

### Neues Interface
```ts
interface HistorieEintrag {
  id: string
  typ: 'system' | 'manuell'
  text: string
  created_at: string
  profiles: { id: string; name: string; rolle: string } | null
}
```

### Datenladen
`loadData()` in der Hauptkomponente wird um einen dritten parallelen Fetch erweitert:
```ts
fetch(`/api/ressourcen/${params.id}/historie`)
```
Ergebnis wird in `useState<HistorieEintrag[]>([])` gehalten.

### Neue Komponente `HistorieTab`
Props: `{ eintraege: HistorieEintrag[]; isManager: boolean; ressourceId: string; onEintragAdded: () => void }`

**Layout:**
- Oben (nur für Manager): Textarea + „Notiz speichern"-Button
- Darunter: vertikale Timeline, neueste oben
- Leerer Zustand: „Noch keine Einträge vorhanden."

**Timeline-Eintrag:**
- **System-Einträge:** kleiner grauer Punkt (●), `text` in normaler Schrift, `erstellt_von` + Datum in `text-muted-foreground`
- **Manuelle Einträge:** Stift-Icon (Tabler `IconPencil`), leicht hervorgehobener Hintergrund (`bg-muted/30`), sonst gleich

### Tab-Registrierung
```tsx
{ id: "historie", label: "Historie", icon: IconClock }
```
Wird als vierter Tab nach „Zeitnachweis" eingefügt.

---

## Berechtigungen

| Aktion | Agentur | Admin / Staffhub Manager |
|---|---|---|
| Historie lesen | ✓ | ✓ |
| Manuelle Notiz hinzufügen | ✗ | ✓ |

---

## Nicht im Scope

- Automatisches Tracking von Beauftragungsstatus-Wechseln (bereits via `ressource-links/status` route getrackt)
- Löschen oder Bearbeiten von Historieneinträgen
- Paginierung (API gibt max. 200 Einträge zurück — ausreichend)
