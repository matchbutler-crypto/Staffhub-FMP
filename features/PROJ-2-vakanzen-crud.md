# PROJ-2: Vakanzen-CRUD

## Status: Approved
**Created:** 2026-04-12
**Last Updated:** 2026-04-13

## Implementation Notes (Backend — 2026-04-12)
- Migration erstellt: `supabase/migrations/20260412_proj2_vakanzen.sql`
  - Tabelle `vakanzen` mit allen Feldern laut PRD §3.2.1
  - RLS aktiviert: SELECT für alle authenticated, INSERT/UPDATE nur Admin/Manager
  - Trigger `vakanzen_updated_at` für automatisches `updated_at`
  - Stub-Tabelle `kandidaten_profile` für Profil-Zähler (wird in PROJ-3 erweitert)
- API-Routen erstellt:
  - `GET /api/vakanzen` — Liste mit Profil-Anzahl; `budget_intern` wird für Agentur-Rolle serverseitig entfernt
  - `POST /api/vakanzen` — Erstellen (nur Admin/Manager); Status wird immer auf "Offen" gesetzt
  - `PUT /api/vakanzen/[id]` — Bearbeiten aller Felder inkl. Status
  - `PATCH /api/vakanzen/[id]/status` — Nur Status ändern (für "Schließen"-Dialog)
- Integrationstests: 7/7 grün (`src/app/api/vakanzen/route.test.ts`)

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

**QA Re-Run:** 2026-04-12 (2. Lauf — Playwright-Config Port-Fix + neue Bugs gefunden)  
**Tester:** /qa Skill  
**Status nach QA:** In Review (1 Medium Bug offen, 1 weiterer Medium Bug neu gefunden)

---

### Testergebnisse: Acceptance Criteria

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Vakanzen-Tabelle zeigt Supabase-Daten | ✅ Pass | API implementiert, Code-Review |
| 2 | Profil-Anzahl per COUNT-JOIN | ✅ Pass | `kandidaten_profile(count)` im SELECT |
| 3 | Lade-Indikator (Skeleton/Spinner) | ✅ Pass | Im Frontend vorhanden |
| 4 | Fehlerstate bei API-Fehler | ✅ Pass | Error-Banner implementiert |
| 5 | "Neue Vakanz"-Button nur für Manager/Admin | ✅ Pass | `useUser()` Rollenprüfung |
| 6 | Formular mit allen Pflichtfeldern | ✅ Pass | Alle Felder laut PRD §3.2.1 vorhanden |
| 7 | Pflichtfeld-Validierung blockiert Speichern | ✅ Pass | Zod + react-hook-form |
| 8 | Nach Speichern: Toast + Sheet schließt sich | ✅ Pass | Implementiert |
| 9 | Bearbeiten-Formular vorausgefüllt | ✅ Pass | Reset mit vakanz-Daten |
| 10 | Vakanz schließen: AlertDialog | ✅ Pass | AlertDialog mit Bestätigungstext |
| 11 | AlertDialog-Text korrekt | ✅ Pass | "Vakanz wirklich schließen? Alle offenen Einreichungen bleiben bestehen." |
| 12 | Abbrechen schließt Dialog ohne Änderung | ✅ Pass | E2E-Test bestätigt |
| 13 | Agentur sieht kein Bearbeiten/Schließen | ✅ Pass | Rollenprüfung im Frontend |
| 14 | budget_intern nur für Admin/Manager | ✅ Pass | Serverseitige Filterung in GET |
| 15 | RLS: Agentur kann nicht INSERT/UPDATE | ✅ Pass | Supabase RLS-Policies vorhanden |
| 16 | Freitextsuche funktioniert | ✅ Pass | Bestehende Logik erhalten |
| 17 | Status-Filter mit echten Daten | ✅ Pass | Client-seitig, funktioniert mit API |
| 18 | Kombinierter Filter korrekt | ✅ Pass | Logik unverändert |

**Acceptance Criteria: 18/18 bestanden** (Code-Review + automatisierte Tests)

> Hinweis: 17 E2E-Tests sind mit `TEST_USER_REQUIRED` markiert (skipped ohne `.env.local` Credentials).  
> Vollständiger E2E-Lauf erfordert: `TEST_MANAGER_EMAIL/PASSWORD`, `TEST_AGENTUR_EMAIL/PASSWORD`, `TEST_ADMIN_EMAIL/PASSWORD`.

---

### Automatisierte Tests

| Suite | Tests | Ergebnis |
|-------|-------|---------|
| Vitest Unit (rbac.test.ts + route.test.ts) | 37 | ✅ 37/37 Pass |
| Vitest — Playwright-Specs fälschlicherweise inkludiert | 2 Files | ⚠️ PROJ-2-BUG-03 (kein echter Testfehler) |
| Playwright E2E PROJ-2 (chromium, Port 3010) | 5 aktiv / 17 skipped | ✅ 5/5 Pass |

---

### Bugs gefunden

#### PROJ-2-BUG-01 — ✅ Behoben
**Titel:** Middleware gibt 307 Redirect statt 401 JSON für unauthentifizierte API-Requests  
**Severity:** Medium  
**Beschreibung:** `src/middleware.ts` interceptiert alle Routen inkl. `/api/*`. Bei fehlender Session gibt sie 307 Redirect zu `/login` zurück statt `401 { error: "..." }`. Für Browser-Clients kein Problem, für API-Clients (curl, externe Services) unerwartet.  
**Steps to reproduce:**
```bash
curl -i --max-redirs 0 http://localhost:3010/api/vakanzen
# Erwartet: 401 { "error": "Nicht authentifiziert" }
# Erhalten:  307 Location: /login
```
**Fix:** In `middleware.ts` prüfen ob `pathname.startsWith('/api/')` → bei fehlender Session `NextResponse.json({ error: '...' }, { status: 401 })` zurückgeben statt Redirect. (Identischer Fix wie in resplan-Projekt bereits umgesetzt.)  
**Workaround:** Browser-Clients werden korrekt zu /login weitergeleitet — kein Blocker für interne Nutzung.

#### PROJ-2-BUG-02 — Low (offen)
**Titel:** `startdatum` wird nicht als gültiges Datum validiert  
**Severity:** Low  
**Beschreibung:** Zod-Schema validiert `startdatum` nur als `z.string().min(1)`. Werte wie `"abc"` bestehen die Validierung, scheitern aber beim Supabase INSERT mit einem DB-Error statt einer sauberen 400-Antwort.  
**Fix:** `z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum (YYYY-MM-DD)')` oder `z.coerce.date()`.

#### PROJ-2-BUG-03 — ✅ Behoben
**Titel:** Vitest inkludiert Playwright-Specs aus `tests/` — 2 Test-Files als "failed" gemeldet  
**Severity:** Medium  
**Beschreibung:** `vitest.config.ts` hat kein `exclude`-Pattern für `tests/`. Vitest versucht `tests/PROJ-1-auth.spec.ts` und `tests/PROJ-2-vakanzen-crud.spec.ts` als Unit-Tests auszuführen, was wegen `test.describe()` (Playwright-Syntax) fehlschlägt. `npm test` meldet irreführend "2 failed" — obwohl alle echten Unit-Tests (37/37) grün sind.  
**Fix:** In `vitest.config.ts` unter `test:` hinzufügen: `exclude: ['tests/**', 'node_modules/**']`.

#### PROJ-2-BUG-04 — ✅ Behoben (Infrastruktur-Fix)
**Titel:** `playwright.config.ts` verwendete Port 3000 — Konflikt mit resplan-Projekt  
**Severity:** High (vor Fix)  
**Beschreibung:** Beide Projekte (resplan + StaffHub FMP) nutzten `baseURL: http://localhost:3000`. Bei gleichzeitig laufendem resplan-Server liefen FMP-E2E-Tests gegen das falsche Projekt.  
**Fix (umgesetzt):** `playwright.config.ts` auf Port 3010 geändert (`PORT=3010 npm run dev`, `baseURL: http://localhost:3010`). Mobile Safari Project entfernt (nur chromium für lokales Testing).

---

### Security Audit

| Bereich | Status | Anmerkung |
|---------|--------|-----------|
| Authentifizierung | ✅ Sicher | `getUser()` auf allen API Routes |
| Autorisierung | ✅ Sicher | Rollenprüfung in jeder Route + Supabase RLS als 2. Ebene |
| SQL Injection | ✅ Sicher | Supabase parameterisierte Queries |
| Input Injection (XSS) | ✅ Sicher | JSON-only Responses, kein HTML-Rendering |
| budget_intern Leakage | ✅ Sicher | Serverseitige Filterung — nicht über Client manipulierbar |
| CSRF | ✅ Sicher | HttpOnly Session-Cookies + SameSite |
| Open Redirect | ✅ Sicher | `isSafeRedirect()` validiert alle redirectTo-Parameter (Unit-Tests) |
| Sensitive Daten in Fehlermeldungen | ✅ Sicher | Generische Fehlermeldungen ohne Stack-Traces |
| Rate Limiting | ⚠️ Nicht implementiert | Akzeptiert für internes MVP-Tool |
| Unauthentifizierte API-Calls | ⚠️ 307 statt 401 | PROJ-2-BUG-01 — Medium, kein Sicherheits-Blocker |

---

### Produktionsreife-Entscheidung

**READY** — Keine Critical oder High Bugs. PROJ-2-BUG-01 + BUG-03 behoben. BUG-02 (Low) bleibt offen, kein Deployment-Blocker.

## Deployment
_To be added by /deploy_
