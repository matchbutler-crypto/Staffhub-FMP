# Feature Toggles per Agentur — Design

**Datum:** 2026-06-24  
**Status:** Approved

## Ziel

Admin kann Features pro Agentur aktivieren/deaktivieren. Agentur-User sehen nur freigegebene Features. Bei Aktivierung kann Admin eine Release Note hinterlegen, die Agentur-Usern als Notification Badge angezeigt wird.

---

## Datenmodell

### Migration `010_feature_toggles.sql`

```sql
-- Feature-State pro Agentur
ALTER TABLE agenturen
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}';

-- Release Notes (eine pro Feature-Release)
CREATE TABLE release_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key  TEXT NOT NULL,
  titel        TEXT NOT NULL,
  beschreibung TEXT,
  released_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pro User gelesen/ungelesen
CREATE TABLE release_note_reads (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  release_note_id UUID NOT NULL REFERENCES release_notes(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, release_note_id)
);
```

### Feature-Keys

Typisierte Konstante in `src/lib/features.ts`:

```ts
export const FEATURE_KEYS = ['abrechnung', 'zeitnachweise'] as const
export type FeatureKey = typeof FEATURE_KEYS[number]
```

Neues Feature = neuen Key ergänzen + optionale Release Note einfügen.

---

## Admin-UI

### Neuer Tab „Feature Toggles"

Vierter Tab in der bestehenden `Tabs`-Komponente in `src/app/admin/page.tsx`.

Zeigt Tabelle aller Agenturen mit Spalten: Name, aktive Features (Badge-Count), Aktionen.

### `FeatureToggleSheet`

- Öffnet via Menüpunkt „Feature Toggles" im Agentur-Aktions-Dropdown
- Zeigt alle bekannten `FEATURE_KEYS` als Switch-Rows
- Jede Row: Feature-Name, Beschreibung, Switch
- Beim Aktivieren (off → on): optionales Textfeld für Release-Note-Titel und -Beschreibung
- Speichern:
  - `PATCH /api/admin/agenturen/:id` mit `{ features: { abrechnung: true, ... } }`
  - Falls Release-Note-Text ausgefüllt: `POST /api/admin/release-notes` mit `{ feature_key, titel, beschreibung }`

### Neue Agentur anlegen

`NeueAgenturSheet` bekommt optionalen Abschnitt „Features freigeben" — Checkbox-Liste, Standard alle deaktiviert. Keine Release Notes beim Anlegen.

---

## Feature-Gating in der App

### Hook `useFeatures()`

```ts
// src/hooks/useFeatures.ts
const { enabled } = useFeatures()
enabled('abrechnung') // true | false
```

Liest `agenturen.features` aus dem Session-Context (einmalige DB-Abfrage beim Login via `agentur_id` des Profils).

**Rollen-Ausnahme:** Admin, Staffhub Manager, Controller → alle Features immer aktiv, kein Gating.

### Sidebar & Routing

- `AppSidebar`: Sidebar-Einträge für feature-geschützte Bereiche prüfen `enabled(key)`. Eintrag fehlt wenn deaktiviert.
- Seitenrouten: direkter URL-Aufruf bei deaktiviertem Feature → Redirect auf `/dashboard`.

---

## Release Notes & Notification Badge

### Badge

- In `AppSidebar` — kleines rotes Badge mit Anzahl ungelesener Notes
- Nur für Agentur-User
- Klick öffnet Sheet „Was ist neu"

### Ungelesen-Berechnung

```
ungelesen = release_notes
  WHERE feature_key IN (aktivierte Features der Agentur)
  AND id NOT IN (release_note_reads WHERE user_id = current_user)
```

API: `GET /api/release-notes` — gibt Notes + Read-Status für aktuellen User.

### „Was ist neu"-Sheet

- Chronologisch, neueste oben
- Pro Item: Feature-Badge, Titel, Beschreibung, Datum, „Gelesen"-Button
- „Alle gelesen"-Button oben
- Gelesen-markieren: `POST /api/release-notes/:id/read` → Insert `release_note_reads`, optimistisches UI-Update

---

## API-Routen Übersicht

| Method | Route | Beschreibung |
|--------|-------|--------------|
| PATCH | `/api/admin/agenturen/:id` | Features-JSONB aktualisieren |
| POST | `/api/admin/release-notes` | Release Note anlegen (Admin) |
| GET | `/api/release-notes` | Notes + Read-Status (Agentur-User) |
| POST | `/api/release-notes/:id/read` | Als gelesen markieren |

---

## Erweiterbarkeit

Neues Feature hinzufügen:
1. Key zu `FEATURE_KEYS` in `src/lib/features.ts` ergänzen
2. Feature-Label/Beschreibung in `FEATURE_META` ergänzen
3. `useFeatures()` in betroffenen Komponenten nutzen
4. Optional: Release Note via Admin-UI anlegen
