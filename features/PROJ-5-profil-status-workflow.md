# PROJ-5: Profil-Status-Workflow + Kommentarfunktion

## Status: Deployed
**Created:** 2026-04-13
**Last Updated:** 2026-04-13

## Dependencies
- Requires: PROJ-1 (Auth & Rollenverwaltung)
- Requires: PROJ-3 (Profil-Einreichung) — Status-Workflow baut auf kandidaten_profile auf

---

## Übersicht

Staffhub Manager können den Status eines eingereichten Kandidaten-Profils entlang des Workflows ändern. Zusätzlich können Manager und Agenturen Kommentare zu Profilen hinterlassen (Thread-ähnlich, chronologisch).

---

## User Stories

**Als Staffhub Manager...**
- ...möchte ich den Status eines Profils auf „In Prüfung", „Präsentiert", „Interview", „Beauftragt", „Abgelehnt" oder „Archiviert" setzen.
- ...möchte ich einen Kommentar zu einem Profil hinterlassen, damit die Agentur informiert ist.
- ...möchte ich alle Kommentare chronologisch sehen.

**Als Agentur...**
- ...möchte ich den aktuellen Status meines eingereichten Profils sehen.
- ...möchte ich einen Kommentar zum Profil hinterlassen (z.B. Rückfragen).
- ...möchte ich Kommentare des Managers sehen — aber nur für meine eigenen Profile.

---

## Acceptance Criteria

### Status-Workflow
- [ ] Manager kann Status eines Profils ändern: Eingereicht → In Prüfung → Präsentiert → Interview → Beauftragt / Abgelehnt / Archiviert
- [ ] Status-Änderungen werden mit Zeitstempel gespeichert (updated_at)
- [ ] Agentur sieht den aktuellen Status in `/meine-profile`
- [ ] Status-Änderung nur durch Manager oder Admin möglich

### Kommentarfunktion
- [ ] Manager und Agentur können Kommentare zu einem Profil hinterlassen
- [ ] Kommentare sind chronologisch sortiert (älteste zuerst)
- [ ] Kommentare zeigen: Autor-Rolle, Datum, Text
- [ ] Agentur sieht nur Kommentare zu eigenen Profilen
- [ ] Manager sieht alle Kommentare aller Profile
- [ ] Kommentare können nicht gelöscht werden (Audit-Trail)
- [ ] Kommentar-Text max. 2000 Zeichen

### UI
- [ ] Auf `/profile` (Manager): Status-Dropdown direkt in der Tabellenzeile oder Detail-Ansicht
- [ ] Kommentar-Bereich auf Profil-Detail-Seite (`/profile/[id]`) oder als Sheet
- [ ] Auf `/meine-profile` (Agentur): Kommentar-Icon zeigt ob neue Kommentare vorhanden

---

## Tech Design

### Datenmodell

**Neue Tabelle `profil_kommentare`:**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `profil_id` | UUID → kandidaten_profile | Zu welchem Profil |
| `autor_id` | UUID → auth.users | Wer hat kommentiert |
| `autor_rolle` | Text | 'Staffhub Manager' / 'Agentur' / 'Admin' |
| `text` | Text (max 2000) | Kommentarinhalt |
| `created_at` | Timestamp | Automatisch |

**Erweiterung `kandidaten_profile`:** kein neues Feld nötig — `status` + `updated_at` bereits vorhanden.

### API-Routen

| Methode | Route | Wer | Was |
|---------|-------|-----|-----|
| `PATCH` | `/api/profile/[id]/status` | Manager/Admin | Status ändern |
| `GET` | `/api/profile/[id]/kommentare` | Agentur(eigen)/Manager | Kommentare laden |
| `POST` | `/api/profile/[id]/kommentare` | Agentur(eigen)/Manager | Kommentar hinzufügen |

### RLS
- `profil_kommentare` SELECT: Agentur sieht nur Kommentare zu eigenen Profilen; Manager sieht alle
- `profil_kommentare` INSERT: Authentifizierte aktive User mit gültiger Rolle
- `profil_kommentare` DELETE: Niemand (kein Löschen erlaubt)

### UI-Komponenten

```
/profile (Manager)
└── ProfilTabelle
    └── ProfilRow
        ├── StatusDropdown (Inline-Select für Status-Änderung)
        └── KommentarButton → öffnet ProfilDetailSheet

/profile/[id] (neu, Detail-Seite)
├── ProfilKopf (Kandidatenname, Vakanz, Agentur, Status)
├── ProfilDaten (alle Felder, CV-Download)
├── StatusWorkflow (visuell: aktueller Status im Ablauf)
└── KommentarThread
    ├── KommentarListe (chronologisch)
    └── KommentarFormular (Textarea + Absenden)

/meine-profile (Agentur)
└── ProfilRow
    └── KommentarBadge (Anzahl Kommentare)
```

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
