# Vakanz-Audit-Log — Design Spec

**Datum:** 2026-06-29  
**Status:** Genehmigt

## Ziel

Alle Vakanz-Ereignisse (Erstellung, Status-Änderung, Publish/Unpublish, Bearbeitung) in einem Audit-Log erfassen, das Admin im bestehenden Aktivitäts-Log sieht — gemischt mit den Ressource-Logs, nach Datum sortiert.

---

## 1. Datenbank

### Migration `migrations/019_vakanz_historie.sql`

```sql
CREATE TABLE vakanz_historie (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vakanz_id    UUID        NOT NULL REFERENCES vakanzen(id) ON DELETE CASCADE,
  text         TEXT        NOT NULL,
  typ          TEXT        NOT NULL DEFAULT 'system'
                           CHECK (typ IN ('system', 'manuell')),
  erstellt_von UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vakanz_historie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin liest vakanz_historie"
  ON vakanz_historie FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND rolle = 'Admin' AND aktiv = true
    )
  );
```

---

## 2. Backend

### `src/lib/log-vakanz-historie.ts` (neu)

Analoger Helper zu `log-historie.ts`. Parameter: `vakanzId`, `text`, `typ`, `erstelltVon`. Schreibt via `adminClient` (Service Role) damit RLS den Insert nicht blockiert.

### Logging in 4 Routen

| Route | Trigger | Log-Text |
|---|---|---|
| `POST /api/vakanzen` | Nach erfolgreichem Insert | `"Vakanz erstellt: [rolle]"` |
| `PATCH /api/vakanzen/[id]/status` | Alten Status vorher laden, nach Update | `"Status geändert: [alt] → [neu]"` |
| `PATCH /api/vakanzen/[id]/publish` | Alten `published`-Wert vorher laden, nach Update | `"Veröffentlicht"` oder `"Veröffentlichung aufgehoben"` |
| `PUT /api/vakanzen/[id]` | Diff vor/nach Update | Einzelne Einträge pro geändertem Feld |

### Diff-Felder für `PUT /api/vakanzen/[id]`

Folgende Felder werden verglichen (old vs. new), je Änderung ein Log-Eintrag:

- `rolle` → `"Rolle geändert: [alt] → [neu]"`
- `status` → `"Status geändert: [alt] → [neu]"`
- `branche` → `"Branche geändert: [alt] → [neu]"`
- `kunde` → `"Kunde geändert: [alt] → [neu]"`
- `erfahrungslevel` → `"Erfahrungslevel geändert: [alt] → [neu]"`
- `arbeitsmodell` → `"Arbeitsmodell geändert: [alt] → [neu]"`
- `startdatum` → `"Startdatum geändert: [alt] → [neu]"`
- `enddatum` → `"Enddatum geändert: [alt] → [neu]"`
- `budget_intern` → `"EK-Budget geändert: [alt] → [neu]"`
- `fte_anzahl` → `"FTE geändert: [alt] → [neu]"`
- `auslastung` → `"Auslastung geändert: [alt]% → [neu]%"`
- `standort` → `"Standort geändert: [alt] → [neu]"`
- `skills` → `"Skills aktualisiert: +X, -Y"` (Diff wie bei Ressourcen)
- `skills_nice_have` → `"Nice-Have-Skills aktualisiert: +X, -Y"`

### `GET /api/admin/logs` — Erweiterung

- Queryt zusätzlich `vakanz_historie` mit Join auf `vakanzen(id, titel, vakanz_nr)` und Profiles separat (wie bei Ressourcen)
- Merged beide Arrays im Server, sortiert nach `created_at` desc
- Limit: 500 Einträge gesamt (beide Tabellen zusammen)
- Jeder Eintrag erhält `source: 'ressource' | 'vakanz'`
- Response-Shape bleibt kompatibel, neue Felder werden addiert

---

## 3. Admin-UI (`src/app/admin/logs/page.tsx`)

- Spalte "Ressource" → umbenannt zu **"Referenz"**
- `source === 'ressource'`: Link zu `/ressourcen/[id]` mit `ressource_code — name` (wie bisher)
- `source === 'vakanz'`: Link zu `/vakanzen/[id]` mit `vakanz_nr — titel`
- Kein neuer Filter

---

## Nicht in Scope

- Demand-API-Routen (`/app/demand/v1.0/vakanzen/*`) — separate Agency-API, kein Admin-Kontext
- Slack-Route (`/api/vakanzen/[id]/slack`) — technisches Event, kein Business-Audit
- Rückwirkende Befüllung historischer Daten
