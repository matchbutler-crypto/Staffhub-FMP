# Bug-Reporting & Admin Kanban — Design Spec
_2026-06-29_

## Überblick

In-App Bug-Reporting-System mit Freitext + annotiertem Screenshot sowie einem Admin-Kanban-Board zur Bearbeitung. Kein Feedback zurück an den Melder. Vollständig getrennt vom bestehenden `ideen`-System.

---

## 1. Datenmodell

### Tabelle `bug_reports`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `beschreibung` | text NOT NULL | Freitext des Melders |
| `screenshot_url` | text | Supabase Storage URL (nullable) |
| `seite_url` | text NOT NULL | `window.location.href` zum Zeitpunkt der Meldung |
| `status` | text NOT NULL default `'offen'` | `offen` / `in_bearbeitung` / `erledigt` |
| `melder_id` | uuid FK → profiles(id) | |
| `melder_rolle` | text NOT NULL | Snapshot der Rolle zum Zeitpunkt |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | |

### Supabase Storage

Bucket: `bug-screenshots`, **private** (kein public access).  
Admin liest via signed URL (60 min TTL).  
Pfad: `{melder_id}/{uuid}.png`

### RLS-Policies

- **INSERT**: Alle aktiven, eingeloggten User (alle Rollen)
- **SELECT**: Nur Admin-Rolle
- **UPDATE**: Nur Admin-Rolle (nur `status` und `updated_at`)

---

## 2. Bug-Report-Widget

### Platzierung

Client-Komponente `BugReportWidget` wird im Root-Layout (`src/app/layout.tsx`) unterhalb von `{children}` eingehängt. Sichtbarkeit über `useUser` Context — nur für authentifizierte User rendern.

### UI-Flow

**Floating Button**
- Position: fixed, rechts unten (bottom-6, right-6)
- Icon: `IconBug` (Tabler Icons)
- z-index hoch genug um über Sidebar zu liegen

**Modal — Schritt 1: Beschreibung**
- Textarea, Pflichtfeld, min. 10 Zeichen
- Button „Screenshot aufnehmen" → Schritt 2
- Button „Ohne Screenshot senden" → direkt abschicken

**Modal — Schritt 2: Screenshot + Annotation**
1. Modal blendet sich kurz aus (opacity 0, 100ms delay)
2. `html2canvas(document.body)` erfasst aktuellen Viewport
3. Modal wieder einblenden, Screenshot als Canvas anzeigen
4. **Annotation-Toolbar** (oben):
   - Pfeil-Tool (default)
   - Rechteck-Tool
   - Farbe: Rot (fest, kein Farbpicker)
   - Undo (letztes Shape entfernen)
   - Fertig
5. Canvas-Interaktion: mousedown → mousemove → mouseup zeichnet Shape
6. „Fertig" → Screenshot-Vorschau klein im Modal, Button „Neu aufnehmen"

**Absenden**
1. Canvas `toDataURL('image/png')` → Base64
2. Upload via `supabase.storage.from('bug-screenshots').upload(path, blob)`
3. URL + Beschreibung + `seite_url` → `POST /api/bugs`
4. Toast: „Bug gemeldet, danke!" — Modal schließt

---

## 3. API-Routen

### `POST /api/bugs`
- Auth: alle aktiven eingeloggten Rollen
- Body: `{ beschreibung: string, screenshot_url?: string, seite_url: string }`
- Validierung via Zod (min. 10 Zeichen Beschreibung, URL-Format)
- Schreibt `melder_id` + `melder_rolle` aus Session-Profil
- Response: 201 + neues Objekt

### `GET /api/bugs`
- Auth: nur Admin
- Query-Params: `status` (optional, filtert Spalte)
- Joined: `melder:profiles(name, rolle)`
- Response: Array sortiert nach `created_at` DESC

### `PATCH /api/bugs/[id]`
- Auth: nur Admin
- Body: `{ status: 'offen' | 'in_bearbeitung' | 'erledigt' }`
- Setzt auch `updated_at = now()`
- Response: 200 + aktualisiertes Objekt

Keine DELETE-Route. Bugs bleiben dauerhaft.

---

## 4. Admin Kanban Board

### Route

`/admin/bugs` — nur Admin (RBAC bereits in Middleware)

### Layout

3 Spalten horizontal: **Offen** / **In Bearbeitung** / **Erledigt**  
Responsive: auf Mobile scrollbar horizontal.

### Bug-Card

- Beschreibungsvorschau (2 Zeilen, `line-clamp-2`)
- Melder-Name + Rolle + Datum (relativ: „vor 2 Stunden")
- Seite-URL als klickbarer Link (`target="_blank"`)
- Screenshot-Thumbnail 80×60px (klickbar → Vollbild-Overlay)
- Spalten-Badge mit Anzahl Cards

### Drag & Drop

Library: `@dnd-kit/core` + `@dnd-kit/sortable`  
Bei Drop auf andere Spalte → `PATCH /api/bugs/[id]` mit neuem Status → optimistisches UI-Update.

### Detail Slide-over

Klick auf Card öffnet Sheet (Shadcn) von rechts:
- Volle Beschreibung
- Großes Screenshot (signed URL, 60 min)
- Seite-URL
- Melder + Zeitstempel
- Status-Select zum Ändern

### Sidebar-Navigation

Eintrag „Bugs" unter `/admin` in der Sidebar (nur für Admin sichtbar — bereits durch RBAC gehandhabt).

---

## 5. Abhängigkeiten

| Package | Grund |
|---|---|
| `html2canvas` | DOM → Canvas Screenshot |
| `@dnd-kit/core` | Drag & Drop Kanban |
| `@dnd-kit/utilities` | Hilfsfunktionen für DnD |

---

## 6. Out of Scope

- Keine Benachrichtigungen an Melder
- Kein Zuschneiden des Screenshots
- Keine Priorisierung / Labels
- Kein Löschen von Bugs
- Keine GitHub-Integration
