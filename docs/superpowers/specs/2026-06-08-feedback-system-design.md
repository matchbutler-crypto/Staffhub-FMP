# Feedback-System Design

**Datum:** 2026-06-08  
**Status:** Genehmigt

## Überblick

Eigenes In-App-Feedback-System als Ersatz für BugDrop. Nutzer können über einen floating Button einen Screenshot der aktuellen Seite erstellen, Markierungen einzeichnen und eine Beschreibung hinterlassen. Admins verwalten eingehende Feedbacks in einem Kanban-Board in der Seitenleiste.

## Architektur & Datenfluss

```
Nutzer klickt Floating Button
  → FeedbackModal öffnet sich
  → html-to-image macht Screenshot der aktuellen Seite
  → Nutzer zeichnet Markierungen auf Canvas-Overlay
  → Nutzer gibt Beschreibung + Kategorie ein
  → POST /api/feedback
      → Screenshot → Supabase Storage Bucket "feedback-screenshots"
      → Metadaten → Supabase Tabelle "feedbacks"

Admin öffnet /feedback (Sidebar)
  → GET /api/feedback (Admin-only)
  → Kanban mit 4 Spalten: Backlog / In Progress / Review / Done
  → Drag & Drop via @dnd-kit → PATCH /api/feedback/[id] (Status-Update)
  → Klick auf Karte → Screenshot + Annotationen in Vollansicht
```

## Datenbank

### Tabelle: `feedbacks`

```sql
create table feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  beschreibung text not null,
  kategorie text not null check (kategorie in ('Bug', 'Idee', 'Sonstiges')),
  status text not null default 'backlog'
    check (status in ('backlog', 'in_progress', 'review', 'done')),
  screenshot_url text,
  annotations jsonb default '[]',  -- [{x, y, width, height, color}]
  seite_url text,
  created_at timestamptz default now()
);

-- RLS: Nutzer können nur eigene Feedbacks erstellen
-- Admins können alle lesen und Status ändern
```

### Supabase Storage

- Bucket: `feedback-screenshots` (privat, signed URLs für Admin-Ansicht)

## Komponenten

### Einreichung (alle eingeloggten Nutzer)

| Komponente | Datei | Beschreibung |
|---|---|---|
| `FeedbackButton` | `src/components/feedback/feedback-button.tsx` | Floating Button fixed bottom-right, `IconBug` (Tabler), rendert im Root-Layout |
| `FeedbackModal` | `src/components/feedback/feedback-modal.tsx` | Dialog mit State-Machine: `screenshot → annotate → form → sending` |
| `AnnotationCanvas` | `src/components/feedback/annotation-canvas.tsx` | Canvas-Overlay über Screenshot, Maus-Events für farbige Rechtecke |

**FeedbackButton** ersetzt den BugDrop `<Script>` Tag im Root-Layout.

### Admin-Ansicht

| Komponente | Datei | Beschreibung |
|---|---|---|
| `FeedbackPage` | `src/app/feedback/page.tsx` | Route, Redirect wenn nicht Admin |
| `FeedbackKanban` | `src/components/feedback/feedback-kanban.tsx` | 4-Spalten-Grid mit `@dnd-kit/core` |
| `FeedbackCard` | `src/components/feedback/feedback-card.tsx` | Karte: Kategorie-Badge, Beschreibung (truncated), URL, Datum, Screenshot-Thumbnail |
| `FeedbackDetailSheet` | `src/components/feedback/feedback-detail-sheet.tsx` | Sheet bei Klick: Screenshot + Annotationen als SVG-Overlay |

### Sidebar

Neuer Eintrag in `ALL_NAV_SECONDARY` in `src/components/app-sidebar.tsx`:

```ts
{ title: 'Feedback', url: '/feedback', icon: IconBug, roles: ['Admin'] }
```

## API Routes

| Route | Methode | Auth | Beschreibung |
|---|---|---|---|
| `/api/feedback` | `POST` | Eingeloggt | Screenshot + Metadaten speichern |
| `/api/feedback` | `GET` | Admin | Alle Feedbacks abrufen |
| `/api/feedback/[id]` | `PATCH` | Admin | Status-Update |

## Abhängigkeiten (neu)

- `html-to-image` — Screenshot-Erstellung client-side
- `@dnd-kit/core` + `@dnd-kit/sortable` — Drag & Drop im Kanban

## Edge Cases

| Fall | Verhalten |
|---|---|
| Screenshot schlägt fehl (cross-origin) | Hinweis im Modal, Einreichung trotzdem möglich |
| Keine Annotation | Leeres Array, kein Fehler |
| Nicht-Admin ruft `/feedback` auf | Redirect zu `/dashboard` |
| Drag & Drop API-Fehler | Optimistisches Update zurückrollen + Toast |
| Großes Screenshot | Vor Upload auf max. 1920px Breite skalieren |

## Entfernen von BugDrop

- `<Script>` Tag und `import Script from 'next/script'` aus `src/app/layout.tsx` entfernen
