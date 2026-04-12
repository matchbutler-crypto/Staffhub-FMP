# PROJ-2: Vakanzen-CRUD

## Status: In Progress
**Created:** 2026-04-12
**Last Updated:** 2026-04-12

## Dependencies
- Requires: PROJ-1 (Auth & Rollenverwaltung) — für Authentifizierung, Rollenprüfung und `useUser()` Hook

---

## Übersicht

Die bestehende Vakanzen-Seite (`/vakanzen`) wird von statischen Mock-Daten auf echte Supabase-Datenbankoperationen umgestellt. Staffhub Manager und Admin können Vakanzen erstellen, bearbeiten und schließen. Agenturen haben lesenden Zugriff. Das interne Budget ist nur für Manager/Admin sichtbar. Slack-Posting (PROJ-8) ist nicht Teil dieses Features.

---

## User Stories

- Als **Staffhub Manager** möchte ich eine neue Vakanz mit allen Pflichtfeldern erstellen, damit Agenturen passende Kandidaten einreichen können.
- Als **Staffhub Manager** möchte ich eine bestehende Vakanz bearbeiten (alle Felder), damit ich Anforderungen aktualisieren kann.
- Als **Staffhub Manager** möchte ich den Status einer Vakanz ändern (z.B. Offen → In Auswahl → Besetzt), damit der aktuelle Stand transparent ist.
- Als **Staffhub Manager** möchte ich eine Vakanz per Bestätigungsdialog schließen, damit ich nicht versehentlich schließe.
- Als **Admin** möchte ich dieselben CRUD-Rechte wie der Staffhub Manager haben.
- Als **Agentur** möchte ich alle offenen und laufenden Vakanzen lesen können, damit ich entscheiden kann, zu welcher ich Profile einreiche.
- Als **Agentur** möchte ich das interne Budget einer Vakanz NICHT sehen, da dies vertrauliche Kalkulation ist.
- Als **beliebiger User** möchte ich Vakanzen nach Status und Freitext filtern können, damit ich schnell die relevanten finde.

---

## Acceptance Criteria

### Daten laden
- [ ] Die Vakanzen-Tabelle zeigt Daten aus der Supabase `vakanzen`-Tabelle (keine Mock-Daten mehr)
- [ ] Jede Zeile zeigt die Anzahl eingereichter Profile (COUNT aus `kandidaten_profile` verknüpft über `vakanz_id`)
- [ ] Die Seite zeigt einen Lade-Indikator (Skeleton oder Spinner) während Daten geladen werden
- [ ] Fehler beim Laden zeigt eine verständliche Fehlermeldung (kein leerer Bildschirm)

### Vakanz erstellen (Manager/Admin)
- [ ] "Neue Vakanz"-Button ist nur für Manager und Admin sichtbar
- [ ] Das Formular enthält alle Pflichtfelder laut PRD §3.2.1: Titel, Rolle, Beschreibung, Skills (Tag-Input), Erfahrungslevel, Startdatum, Laufzeit, Auslastung (%), Arbeitsmodell, Status (default: Offen)
- [ ] Optionale Felder: Standort, Internes Budget (€)
- [ ] Alle Pflichtfelder werden validiert — leere Felder blockieren das Speichern
- [ ] Nach erfolgreichem Speichern erscheint die neue Vakanz sofort in der Tabelle (optimistic update oder re-fetch)
- [ ] Nach Speichern: Sheet schließt sich, Toast "Vakanz erstellt" erscheint

### Vakanz bearbeiten (Manager/Admin)
- [ ] "Bearbeiten" im Aktions-Dropdown öffnet dasselbe Formular vorausgefüllt mit den aktuellen Werten
- [ ] Alle Felder (inkl. Status) sind bearbeitbar
- [ ] Nach Speichern aktualisiert sich die Zeile in der Tabelle sofort
- [ ] Nach Speichern: Sheet schließt sich, Toast "Vakanz aktualisiert" erscheint

### Vakanz schließen (Manager/Admin)
- [ ] "Schließen" im Aktions-Dropdown öffnet einen AlertDialog
- [ ] AlertDialog-Text: "Vakanz wirklich schließen? Alle offenen Einreichungen bleiben bestehen."
- [ ] Bestätigen setzt Status auf "Geschlossen" und aktualisiert die Tabelle sofort
- [ ] Abbrechen schließt den Dialog ohne Änderung
- [ ] Toast "Vakanz geschlossen" erscheint nach Bestätigung

### Rollenbasierte Sichtbarkeit
- [ ] "Neue Vakanz"-Button ist für Agentur-User ausgeblendet
- [ ] Aktions-Dropdown zeigt für Agentur-User nur "Details anzeigen" (kein Bearbeiten/Schließen)
- [ ] Spalte "Internes Budget" ist in Tabelle und Formular nur für Admin/Manager sichtbar
- [ ] RLS in Supabase: Agenturen können `vakanzen` nur lesen (SELECT), Manager/Admin können INSERT/UPDATE

### Filter & Suche
- [ ] Freitextsuche filtert nach Titel und Rolle (client-seitig, bestehende Logik beibehalten)
- [ ] Status-Filter funktioniert mit echten DB-Daten
- [ ] Kombinierter Filter (Text + Status) funktioniert korrekt

---

## Edge Cases

- **Gleichzeitige Bearbeitung**: Kein Locking für MVP — letzter Speichervorgang gewinnt. Kein Handlungsbedarf.
- **Vakanz mit vorhandenen Profilen schließen**: Erlaubt. AlertDialog weist darauf hin, dass Einreichungen bestehen bleiben.
- **Leere Vakanzen-Liste**: Leerer Zustand mit Hinweis "Noch keine Vakanzen angelegt. Klicke auf 'Neue Vakanz' um zu starten." (nur für Manager/Admin)
- **Netzwerkfehler beim Speichern**: Toast mit Fehlermeldung "Fehler beim Speichern. Bitte erneut versuchen." — Sheet bleibt offen, Daten bleiben erhalten
- **Agentur ruft API direkt auf**: RLS verhindert INSERT/UPDATE auf Datenbankebene — 403-Fehler wird zurückgegeben
- **Budget-Feld bei Agentur**: Wird weder im Frontend noch in der API-Antwort zurückgegeben (serverseitige Filterung)
- **Ungültige Auslastung**: Zahl muss zwischen 1 und 100 liegen — Validierung im Formular und API
- **Sehr langer Skills-Text**: Skills-Array wird auf max. 20 Tags begrenzt

---

## Rollenmatrix

| Aktion | Admin | Staffhub Manager | Agentur |
|--------|-------|------------------|---------|
| Vakanzen lesen | ✅ | ✅ | ✅ |
| Budget sehen | ✅ | ✅ | ❌ |
| Vakanz erstellen | ✅ | ✅ | ❌ |
| Vakanz bearbeiten | ✅ | ✅ | ❌ |
| Vakanz schließen | ✅ | ✅ | ❌ |

---

## Nicht in diesem Feature (Abgrenzung)

- **Slack-Posting** → PROJ-8
- **Profil-Einreichung zu Vakanzen** → PROJ-3
- **Profil-Zähler mit echten Daten** → kann als Teil von PROJ-2 implementiert werden, sofern `kandidaten_profile`-Tabelle bereits existiert (sie tut es)
- **Vakanz löschen** → nicht im PRD, nicht in diesem Feature

---

## Technical Requirements

- **API Routes**: `GET /api/vakanzen`, `POST /api/vakanzen`, `PUT /api/vakanzen/[id]`, `PATCH /api/vakanzen/[id]/status`
- **Validierung**: Zod-Schemas auf allen schreibenden Endpunkten
- **Auth-Check**: Jede API Route prüft Session via Supabase SSR-Client
- **RLS**: Supabase RLS erlaubt SELECT für alle, INSERT/UPDATE nur für Manager/Admin
- **Budget-Filterung**: `budget_intern` wird serverseitig aus API-Antwort für Agentur-Rolle entfernt

---

## Tech Design (Solution Architect)

### Übersicht

Die bestehende `/vakanzen`-Seite bleibt strukturell erhalten — TanStack Table, Filter, Sidebar. Es wird lediglich die Datenquelle ausgetauscht (Mock → Supabase API) und drei neue Interaktionen ergänzt (Erstellen/Bearbeiten/Schließen). Kein Rewrite, sondern ein gezieltes Upgrade.

---

### Komponenten-Struktur

```
/vakanzen (VakanzenPage)
├── SiteHeader ("Vakanzen")
├── Toolbar
│   ├── Freitextsuche (bestehend, bleibt)
│   ├── Status-Filter (bestehend, bleibt)
│   └── [Neue Vakanz]-Button  ← nur Manager/Admin sichtbar
│
├── VakanzenTabelle (TanStack Table — bestehend)
│   ├── Spalten: Titel, Rolle, Skills, Level, Start, Modell, Profile, Status
│   ├── Spalte "Budget" ← nur Manager/Admin sichtbar
│   └── Aktions-Dropdown pro Zeile
│       ├── Manager/Admin: Bearbeiten | Schließen
│       └── Agentur: Details anzeigen (read-only)
│
├── Lade-Zustand (Skeleton-Rows während API lädt)
├── Fehler-Zustand (Alert-Banner wenn API fehlschlägt)
├── Leer-Zustand (Hinweis wenn keine Vakanzen vorhanden)
│
├── VakanzFormSheet (NEU — Schiebepanel rechts)
│   ├── Modus "Erstellen": leeres Formular
│   └── Modus "Bearbeiten": vorausgefülltes Formular
│       ├── Titel*, Rolle*, Beschreibung* (Textarea)
│       ├── Skills* (Tag-Input — bestehend wiederverwenden)
│       ├── Erfahrungslevel* (Select)
│       ├── Startdatum* (Datepicker)
│       ├── Laufzeit* (Text)
│       ├── Auslastung %* (Number 1–100)
│       ├── Arbeitsmodell* (Select)
│       ├── Status* (Select — nur im Bearbeiten-Modus)
│       ├── Standort (optional)
│       └── Internes Budget € (optional — nur Manager/Admin)
│
└── VakanzSchließenDialog (NEU — AlertDialog)
    ├── Text: "Vakanz wirklich schließen? Alle offenen Einreichungen bleiben bestehen."
    ├── [Bestätigen] → Status = "Geschlossen"
    └── [Abbrechen] → kein Effekt
```

---

### Neue API-Routen

```
src/app/api/vakanzen/
  route.ts          ← GET (Liste) + POST (Erstellen)
  [id]/
    route.ts        ← PUT (Bearbeiten — alle Felder)
    status/
      route.ts      ← PATCH (nur Status ändern — für "Schließen")
```

Jede Route:
1. Prüft Session (eingeloggter User?)
2. Liest Rolle aus `profiles`
3. Prüft Berechtigung (Schreib-Operationen: nur Manager/Admin)
4. Validiert Eingabe mit Zod
5. Führt Supabase-Abfrage aus
6. Filtert `budget_intern` aus Antwort wenn Rolle = Agentur

---

### Datenspeicherung

| Was | Wo | Details |
|-----|----|---------|
| Vakanzen | Supabase `vakanzen`-Tabelle | Bereits angelegt mit PROJ-0 Migration |
| Profil-Anzahl | JOIN auf `kandidaten_profile` | COUNT per `vakanz_id` — kein eigenes Feld |
| Budget | `vakanzen.budget_intern` | Wird serverseitig herausgefiltert für Agentur-Rolle |

---

### Datenfluss

```
Seite lädt
  → GET /api/vakanzen
  → Supabase: SELECT vakanzen + COUNT(kandidaten_profile)
  → Tabelle füllt sich (vorher: Skeleton-Rows)

"Neue Vakanz" Formular abgeschickt
  → POST /api/vakanzen (mit Zod-Validierung)
  → Supabase INSERT
  → GET /api/vakanzen erneut (re-fetch)
  → Toast "Vakanz erstellt"

"Bearbeiten" Formular gespeichert
  → PUT /api/vakanzen/[id]
  → Supabase UPDATE
  → Re-fetch → Toast "Vakanz aktualisiert"

"Schließen" bestätigt
  → PATCH /api/vakanzen/[id]/status  { status: "Geschlossen" }
  → Supabase UPDATE
  → Re-fetch → Toast "Vakanz geschlossen"
```

---

### Wiederverwendung bestehender Komponenten

| Komponente | Aktion |
|------------|--------|
| `TagInput` (vakanzen/page.tsx) | Wird aus der Seite extrahiert oder direkt im Sheet wiederverwendet |
| `SkillTags` | Bleibt als Anzeige-Komponente in der Tabelle |
| Bestehende Filter-Logik | Bleibt 1:1 erhalten — funktioniert mit echten Daten genauso |
| `useUser()` aus PROJ-1 | Rolle für Sichtbarkeits-Steuerung (Button, Budget-Spalte) |
| AlertDialog | Aus `src/components/ui/alert-dialog.tsx` — kein Install nötig |
| Sheet | Aus `src/components/ui/sheet.tsx` — bereits vorhanden |

---

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| API Routes statt direktem Supabase-Client im Browser | Budget-Filterung und Rollenprüfung laufen server-seitig — nicht manipulierbar |
| Re-fetch nach Mutation (kein optimistic update) | Einfacher, korrekt für ein internes Tool mit wenigen gleichzeitigen Usern |
| Zod-Validierung auf API-Ebene | Verhindert inkonsistente Daten auch bei direkten API-Aufrufen |
| Formular als Sheet (Schiebepanel) | Bestehender UX-Pattern in der App — kein neues Muster einführen |

---

### Neue Abhängigkeiten

Keine neuen npm-Pakete nötig — alle benötigten UI-Komponenten (Sheet, AlertDialog, Select, DatePicker/Calendar) sind bereits installiert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
