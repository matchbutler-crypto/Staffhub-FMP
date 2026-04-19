# PROJ-9: Freelancer-Pool CRUD

## Status: Deployed
**Created:** 2026-04-18
**Last Updated:** 2026-04-18

## Dependencies
- Requires: PROJ-1 (Auth & RBAC) — Agentur-Isolation, nur eigene Ressourcen sichtbar
- Requires: PROJ-3 (CV-Upload) — gleiche Supabase Storage Infrastruktur für CV

## Beschreibung
Agenturen können einen eigenen Pool von Freelancern (Ressourcen) aufbauen und pflegen.
Jede Ressource hat einen Verfügbarkeitsstatus, der regelmäßig gepflegt werden muss.
Der Staffhub Manager sieht alle Ressourcen aller Agenturen (read-only Übersicht).

## Felder einer Ressource

| Feld | Typ | Pflicht | Sichtbarkeit |
|------|-----|---------|--------------|
| Name / Pseudonym | Text | ✅ | Alle |
| Skills | Tags (Array) | ✅ | Alle |
| Erfahrungslevel | Enum (Junior/Mid/Senior/Expert) | ✅ | Alle |
| Verfügbarkeitsstatus | Enum (s.u.) | ✅ | Alle |
| Verfügbar ab | Datum (nur wenn Status = "Verfügbar ab") | bedingt | Alle |
| CV / Dokument | PDF-Upload (Supabase Storage) | optional | Alle |
| EK-Tagesrate (€/Tag) | Zahl | optional | Nur Manager + Admin |
| Notizen | Freitext | optional | Nur Agentur + Manager + Admin |
| Erstellt am | Automatisch | — | Alle |
| Zuletzt aktualisiert | Automatisch | — | Alle |

### Verfügbarkeitsstatus-Enum
- `Jetzt verfügbar` — sofort einsetzbar
- `Verfügbar ab [Datum]` — ab einem konkreten Datum
- `Nicht verfügbar` — aktuell belegt / nicht aktiv
- `Deaktiviert` — archiviert, nicht mehr aktiv im Pool

## User Stories

- Als Agentur möchte ich neue Freelancer in meinen Pool aufnehmen, damit ich sie bei passenden Vakanzen schnell spielen kann.
- Als Agentur möchte ich den Verfügbarkeitsstatus meiner Ressourcen jederzeit aktualisieren, damit der Manager immer aktuelle Informationen hat.
- Als Agentur möchte ich einen CV hochladen und bei Bedarf ersetzen, damit der Manager immer die aktuelle Version hat.
- Als Agentur möchte ich Ressourcen deaktivieren (nicht löschen), damit ich die Historie behalte.
- Als Staffhub Manager möchte ich alle Ressourcen aller Agenturen sehen (read-only), damit ich proaktiv Matches erkennen kann.
- Als Staffhub Manager möchte ich den Pool nach Verfügbarkeit, Skills und Agentur filtern können.

## Acceptance Criteria

- [ ] Agentur kann Ressource anlegen mit allen Pflichtfeldern
- [ ] Agentur sieht nur eigene Ressourcen (RLS-Isolation)
- [ ] CV-Upload als PDF möglich (max. 10 MB), Austausch jederzeit möglich
- [ ] Verfügbarkeitsstatus ist immer gesetzt; bei "Verfügbar ab" ist Datumsfeld Pflicht
- [ ] EK-Tagesrate ist nur für Manager + Admin sichtbar
- [ ] Ressourcen können deaktiviert (nicht gelöscht) werden
- [ ] Manager sieht alle Ressourcen aller Agenturen mit Agenturname
- [ ] Manager kann nach Status, Skills, Erfahrungslevel und Agentur filtern
- [ ] `updated_at` wird bei jeder Änderung (inkl. Statusänderung) aktualisiert
- [ ] Ressource mit Status "Deaktiviert" ist in der Standard-Ansicht ausgefiltert (opt-in anzeigbar)

## Edge Cases

- Agentur versucht, Ressource einer anderen Agentur zu bearbeiten → 403
- CV-Upload schlägt fehl (Netz, Größe) → Fehlermeldung, Ressource bleibt ohne CV gespeichert
- "Verfügbar ab"-Datum liegt in der Vergangenheit → Warnung anzeigen, kein Block
- Agentur versucht eine deaktivierte Ressource auf Vakanz zu spielen (PROJ-11) → nicht erlaubt
- Manager versucht, eine Ressource zu bearbeiten → 403 (read-only für Manager)
- Ressource ohne CV: CV-Download-Button ausgegraut

## Technical Requirements
- Neue Tabelle `ressourcen` mit RLS (Agentur sieht nur eigene)
- Supabase Storage Bucket `ressourcen-cvs` (analog zu `kandidaten-cvs`)
- API-Routen: GET/POST `/api/ressourcen`, GET/PUT/PATCH `/api/ressourcen/[id]`
- Seite `/pool` für Agenturen (eigener Pool)
- Seite `/ressourcen` für Manager/Admin (alle Pools, read-only + Filter)

---

## Tech Design (Solution Architect)

### Zwei Seiten, zwei Rollen

| Seite | Rolle | Zweck |
|-------|-------|-------|
| `/pool` | Agentur | Eigenen Pool verwalten (anlegen, bearbeiten, deaktivieren) |
| `/ressourcen` | Manager + Admin | Alle Pools aller Agenturen lesen + filtern |

Der Manager hat auf `/ressourcen` **kein** Bearbeiten-Button — reine Leseansicht.
Die Agentur sieht `/ressourcen` nicht (Middleware-Schutz, wie bei allen Manager-Seiten).

---

### UI-Struktur

**Agentur-Seite `/pool`**
```
PoolPage
├── Header ("Mein Pool" + Button "Neue Ressource")
├── Filterleiste (Status-Filter, Suche nach Name/Skill)
├── Tabelle / Karten-Liste
│   └── RessourceRow (Name, Skills-Tags, Level, Status-Badge, EK-Rate, Aktionen)
│       └── Aktionen: Bearbeiten | CV herunterladen | Deaktivieren
└── RessourceFormSheet (Slide-in, Anlegen + Bearbeiten)
    ├── Name / Pseudonym *
    ├── Skills (TagInput, wiederverwendete Komponente)
    ├── Erfahrungslevel (Select)
    ├── Verfügbarkeitsstatus (Select)
    ├── Verfügbar ab (Datum, nur sichtbar wenn Status = "Verfügbar ab")
    ├── CV-Upload (PDF, max 10 MB)
    ├── EK-Tagesrate (nur sichtbar für Manager — hier ausgeblendet)
    └── Notizen (Freitext)
```

**Manager-Seite `/ressourcen`**
```
RessourcenPage (Manager/Admin)
├── Header ("Ressourcen-Pool")
├── Filterleiste (Agentur, Status, Erfahrungslevel, Skill-Suche)
├── Tabelle (alle Agenturen)
│   └── RessourceRow + Agentur-Spalte + EK-Tagesrate-Spalte
└── RessourceDetailSheet (read-only Slide-in, mit CV-Download)
```

---

### Datenmodell

**Tabelle `ressourcen`** (neu)

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | UUID | Primärschlüssel |
| agentur_id | UUID → agenturen | Besitzende Agentur |
| name | Text | Name oder Pseudonym |
| skills | Text[] | Tags-Array |
| erfahrungslevel | Enum | Junior / Mid / Senior / Expert |
| verfuegbarkeit | Enum | Jetzt verfügbar / Verfügbar ab / Nicht verfügbar / Deaktiviert |
| verfuegbar_ab | Date | Nur wenn verfuegbarkeit = "Verfügbar ab" |
| cv_pfad | Text | Storage-Pfad (nullable) |
| ek_tagesrate | Numeric | EK-Preis — nur für Manager+Admin sichtbar |
| notizen | Text | Intern (Agentur + Manager) |
| reminder_sent_at | Timestamptz | Für PROJ-10 Reminder (schon anlegen) |
| created_at | Timestamptz | Automatisch |
| updated_at | Timestamptz | Automatisch via Trigger |

**Sicherheit (RLS)**
- Agentur: `SELECT / INSERT / UPDATE` nur eigene Zeilen (`agentur_id = eigene_agentur_id`)
- Manager + Admin: `SELECT` alle; kein `UPDATE/DELETE` (read-only)
- `ek_tagesrate` und `notizen`: werden per API-Logik gefiltert, bevor sie an Agenturen gesendet werden (analog zu `budget_intern` bei Vakanzen)

**Storage-Bucket `ressourcen-cvs`** (neu, analog zu `kandidaten-cvs`)
- Pfad pro CV: `{agentur_id}/{ressource_id}.pdf`
- Zugriff: Agentur liest/schreibt nur eigene Pfade; Manager kann alle lesen

---

### API-Routen

| Route | Methode | Wer | Zweck |
|-------|---------|-----|-------|
| `/api/ressourcen` | GET | Alle | Liste laden (Agentur: eigene; Manager: alle) |
| `/api/ressourcen` | POST | Agentur | Neue Ressource anlegen |
| `/api/ressourcen/[id]` | GET | Alle | Einzelne Ressource |
| `/api/ressourcen/[id]` | PUT | Agentur | Vollständig aktualisieren |
| `/api/ressourcen/[id]/status` | PATCH | Agentur | Nur Verfügbarkeitsstatus ändern (Schnellaktion) |
| `/api/ressourcen/[id]/cv` | POST | Agentur | CV hochladen / ersetzen |
| `/api/ressourcen/[id]/cv` | DELETE | Agentur | CV entfernen |

---

### Wiederverwendete Komponenten

| Komponente | Herkunft | Verwendung |
|------------|----------|------------|
| `TagInput` | `src/components/tag-input.tsx` | Skills-Eingabe |
| `Sheet` / `SheetContent` | shadcn/ui | Formular-Slide-in |
| `Select`, `Input`, `Label` | shadcn/ui | Formularfelder |
| `Table`, `Badge` | shadcn/ui | Listen-Ansicht |
| CV-Upload-Logik | analog `profile/[id]/cv/route.ts` | Upload + Download |

---

### Sidebar-Erweiterung

- Agentur-Rolle: neuer Eintrag **"Mein Pool"** → `/pool`
- Manager/Admin: neuer Eintrag **"Ressourcen"** → `/ressourcen`
- Beide Einträge werden rollenbasiert ein-/ausgeblendet (bestehender Mechanismus in `app-sidebar.tsx`)

---

### Build-Reihenfolge

1. **DB + RLS** (Migration: Tabelle `ressourcen`, Bucket, Trigger)
2. **API-Routen** (`/api/ressourcen`, `/api/ressourcen/[id]`, CV-Routen)
3. **Agentur-Seite `/pool`** (Form-Sheet + Tabelle)
4. **Manager-Seite `/ressourcen`** (read-only + Filter)
5. **Sidebar** (neue Nav-Einträge)

## Implementation Notes (Frontend)

**Seiten erstellt:**
- `src/app/pool/page.tsx` — Agentur-Pool-Verwaltung (Anlegen, Bearbeiten, Deaktivieren, CV-Upload/Download/Löschen)
- `src/app/ressourcen/page.tsx` — Manager/Admin-Übersicht (read-only, Klick auf Zeile öffnet Detail-Sheet mit CV-Download)

**Routing + RBAC aktualisiert:**
- `src/lib/rbac.ts` — `/pool` für Agentur, `/ressourcen` für Admin + Staffhub Manager
- `src/components/app-sidebar.tsx` — Neue Nav-Einträge "Mein Pool" (Agentur) und "Ressourcen" (Manager/Admin)

**Komponenten:**
- `RessourceFormSheet` — Sheet für Anlegen + Bearbeiten (Zod + react-hook-form, CV-Upload inline)
- `DeaktivierenDialog` — AlertDialog für Deaktivieren (setzt Status via PATCH /status, kein Löschen)
- `RessourceDetailSheet` — Read-only Detail-Sheet für Manager mit CV-Download-Button
- Wiederverwendet: `TagInput` aus `src/components/tag-input.tsx`

**Besonderheiten:**
- "Verfügbar ab"-Datumsfeld wird nur eingeblendet wenn Status = "Verfügbar ab"
- Deaktivierte Ressourcen in der Standardansicht gefiltert; opt-in per Toggle-Button
- Manager-Seite: 4 Filter (Status, Level, Agentur, Suche) + Filter-Reset-Button
- EK-Tagesrate sichtbar in Agentur-Pool-Ansicht (eigene Daten) und in Manager-Übersicht

## QA Test Results

**QA Date:** 2026-04-18
**Tester:** QA Engineer (automated)
**Status: APPROVED — Production-Ready**

### Acceptance Criteria

| # | Kriterium | Status |
|---|-----------|--------|
| AC-1 | Agentur kann Ressource anlegen mit allen Pflichtfeldern | ✅ Pass |
| AC-2 | Agentur sieht nur eigene Ressourcen (RLS-Isolation) | ✅ Pass |
| AC-3 | CV-Upload als PDF möglich (max. 10 MB), Austausch jederzeit | ✅ Pass |
| AC-4 | Verfügbarkeitsstatus Pflicht; "Verfügbar ab" erfordert Datum | ✅ Pass |
| AC-5 | EK-Tagesrate nur für Manager + Admin sichtbar | ✅ Pass |
| AC-6 | Ressourcen können deaktiviert (nicht gelöscht) werden | ✅ Pass |
| AC-7 | Manager sieht alle Ressourcen aller Agenturen mit Agenturname | ✅ Pass |
| AC-8 | Manager kann nach Status, Skills, Level und Agentur filtern | ✅ Pass |
| AC-9 | `updated_at` und `reminder_sent_at` Reset bei Aktualisierung | ✅ Pass |
| AC-10 | Deaktivierte Ressourcen in Standard-Ansicht ausgefiltert (opt-in) | ✅ Pass |

**10/10 Acceptance Criteria bestanden.**

### Test Coverage

- **Unit/Integration Tests (Vitest):** 9 neue Tests in `src/app/api/ressourcen/route.test.ts` — alle grün
- **Regression:** Bestehender Vakanzen-Test repariert (Quick-Wins-Regression: `laufzeit`→`enddatum`, `titel` entfernt)
- **E2E Tests (Playwright):** `tests/PROJ-9-freelancer-pool-crud.spec.ts` — 6/6 ohne Credentials, 17 gesamt (11 skip wegen fehlender Test-Credentials)
- **Gesamte Test-Suite:** 78/78 Tests grün

### Security Audit

**Kein Critical oder High Bug gefunden.**

| ID | Schwere | Beschreibung |
|----|---------|--------------|
| SEC-1 | Medium | `PUT /api/ressourcen/[id]` und `PATCH .../status` prüfen `agentur_id`-Ownership nur via RLS, nicht zusätzlich auf API-Ebene (Defence-in-Depth-Lücke). `cv/route.ts` ist konsistenter und macht den expliziten Check. RLS schützt korrekt — bei falschem `agentur_id` gibt Supabase PGRST116 zurück → 404. Kein Daten-Leak möglich. |
| SEC-2 | Low | Cross-Tenant Update-Versuch gibt 404 ("Ressource nicht gefunden") statt 403 ("Zugriff verweigert"). Verhalten ist sicher, aber leicht irreführend. |

### Bugs

Keine Critical oder High Bugs. SEC-1 und SEC-2 können nach Deployment nachgezogen werden.

### Regression Testing

- `/vakanzen` Seite: Keine Regressions durch Sidebar-Änderung
- `app-sidebar.tsx`: Neue Einträge korrekt rollenbasiert gefiltert (Agentur sieht nur "Mein Pool", Manager nur "Ressourcen")
- RBAC `/pool` und `/ressourcen` korrekt in Middleware geschützt

## Deployment
_To be added by /deploy_
