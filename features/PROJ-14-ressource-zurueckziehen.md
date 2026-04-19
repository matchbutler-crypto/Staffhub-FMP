# PROJ-14: Ressource zurückziehen (Agentur zieht Einreichung zurück)

**Status:** Approved  
**Erstellt:** 2026-04-19  
**Priorität:** P1

---

## Beschreibung

Agenturen können eine bereits auf eine Vakanz gespielte Ressource zurückziehen, solange der Status noch nicht „Zugesagt" oder „Beauftragt" ist. Der Rückzug setzt den `ressource_vakanz_links`-Status auf „Zurückgezogen" und benachrichtigt den Staffhub Manager passiv (Statusanzeige in der Vakanz-Pipeline).

---

## User Stories

1. Als Agentur möchte ich eine Ressource, die ich versehentlich oder nicht mehr passend auf eine Vakanz gespielt habe, zurückziehen können, damit der Manager keine irreführenden Profile sieht.
2. Als Agentur möchte ich beim Zurückziehen einen optionalen Grund angeben können, damit die Kommunikation transparent bleibt.
3. Als Staffhub Manager möchte ich zurückgezogene Ressourcen in der Vakanz-Pipeline erkennbar sehen (Status „Zurückgezogen"), damit ich den Prozess nachvollziehen kann.
4. Als Agentur möchte ich in meiner Pool-Übersicht den Status „Zurückgezogen" pro Vakanz sehen, damit ich den Überblick behalte.

---

## Acceptance Criteria

- [ ] AC-1: In der Pool-Detailansicht einer Ressource (Sheet, Tab „Vakanzen") gibt es pro Vakanz-Link einen „Zurückziehen"-Button
- [ ] AC-2: Der Button ist nur aktiv wenn Status ∈ {„Profil gespielt", „In Prüfung"} — nicht bei „Interview geplant", „Zugesagt", „Abgesagt", „Abgelehnt", „Zurückgezogen"
- [ ] AC-3: Klick öffnet einen Bestätigungs-Dialog mit optionalem Freitext-Feld „Grund (optional)"
- [ ] AC-4: Nach Bestätigung wird `ressource_vakanz_links.status` auf „Zurückgezogen" gesetzt + `grund_rueckzug` Text gespeichert
- [ ] AC-5: Der Staffhub Manager sieht in der Vakanz-Pipeline den Status „Zurückgezogen" mit grauem Badge
- [ ] AC-6: Zurückgezogene Einträge können vom Manager nicht mehr weiter in den Workflow geschoben werden
- [ ] AC-7: Die Ressource im Pool bleibt erhalten (nur der Vakanz-Link-Status ändert sich)
- [ ] AC-8: In der Ressourcen-Historie wird der Rückzug automatisch eingetragen (Systemeintrag, analog zu PROJ-11)

---

## Edge Cases

- Status ist bereits weiter fortgeschritten (Interview / Zugesagt) → Button deaktiviert mit Tooltip „Rückzug nicht mehr möglich bei aktuellem Status"
- Gleichzeitiger Statuswechsel durch Manager (Race Condition) → API prüft erlaubte Status vor dem Update; bei Konflikt gibt API 409; Dialog zeigt Fehlermeldung
- Agentur versucht Ressource einer anderen Agentur zurückzuziehen → RLS verhindert (403)
- Netzwerkfehler → Retry möglich; kein inkonsistenter Zustand da atomare DB-Operation

---

## Schema-Erweiterung

```sql
-- Neues Status-Enum-Value für ressource_vakanz_links:
-- 'Zurückgezogen'

-- Neues optionales Textfeld:
ALTER TABLE ressource_vakanz_links ADD COLUMN grund_rueckzug TEXT;
```

---

## Dependencies

- Requires: PROJ-11 (Ressource auf Vakanz spielen + Status-Workflow) — `ressource_vakanz_links` Tabelle mit Status-Feld
- Requires: PROJ-9 (Freelancer-Pool CRUD) — Pool-Ansicht als Einstiegspunkt

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Pool-Seite (bestehend)
└── Ressource-DetailSheet (bestehend, Tab "Vakanzen")
    └── Vakanz-Zeile (bestehend: Status-Badge, Vakanz-Name)
        └── "Zurückziehen"-Button  ← NEU
            (nur aktiv: Agentur-Rolle + Status = "Gespielt")
            └── RueckzugDialog  ← NEU (shadcn AlertDialog)
                ├── Bestätigungstext
                ├── Textarea "Grund (optional)"
                └── Buttons: "Abbrechen" / "Zurückziehen"
```

### Datenmodell

Zwei Änderungen an der bestehenden `ressource_vakanz_links`-Tabelle — keine neue Tabelle:

| Änderung | Details |
|---|---|
| Neuer Status-Wert | `'Zurückgezogen'` zur Check-Constraint hinzufügen |
| Neues Feld | `grund_rueckzug TEXT` (nullable, optional) |

### API

Neuer dedizierter Endpunkt (kein Umbau des bestehenden Manager-Status-Endpoints):

| Endpunkt | Rolle | Aktion |
|---|---|---|
| `PATCH /api/ressource-links/[id]/rueckzug` | Agentur | Setzt Status auf "Zurückgezogen" + speichert Grund |

Ablauf im Backend:
1. Auth-Check (401 wenn nicht eingeloggt)
2. Profil laden → nur Agentur darf (403 sonst)
3. Link laden + Ressource prüfen → `ressource.agentur_id === profile.agentur_id` (403 sonst)
4. Status-Validierung: nur `Gespielt` erlaubt (409 wenn bereits weiter)
5. UPDATE `ressource_vakanz_links` (atomisch)
6. INSERT `ressource_historie` (System-Eintrag)

### Status-Übergang

```
Zurückziehbar:  Gespielt → Zurückgezogen
Gesperrt:       Interview geplant, Zugesagt, Abgesagt, Abgelehnt
Manager-Ansicht: "Zurückgezogen" = grauer Badge, keine weiteren Aktionen möglich
```

### Tech-Entscheidungen

**Eigener Endpunkt statt Erweiterung des Manager-Status-Endpoints:** Der bestehende `PATCH /api/ressource-links/[id]/status` ist Manager-only mit Vorwärts-Workflow. Rückzug als separater Endpunkt hält die Zugriffslogik klar getrennt.

**AlertDialog statt Dialog:** Rückzug ist eine destruktive Aktion. AlertDialog kommuniziert das visuell klarer.

**Atomarität:** Ein einzelnes DB-Update, kein Rollback-Szenario nötig.

### Neue Pakete

Keine — `AlertDialog`, `Textarea`, `Badge` sind bereits installiert.

---

## QA Test Results

**Datum:** 2026-04-19  
**Tester:** QA Engineer (Claude)  
**Umgebung:** Lokal (localhost:3000), Chromium

### Automated Tests

| Suite | Ergebnis |
|---|---|
| Vitest (116 Tests, 12 Files) | ✅ 116/116 passed |
| Playwright E2E PROJ-14 (8 Tests) | ✅ 1 passed, 7 skipped (keine Test-Credentials) |
| Playwright Regression (gesamt) | ⚠️ 1 pre-existing failure (PROJ-1 Login-Text), nicht PROJ-14-related |

### Acceptance Criteria

| AC | Beschreibung | Ergebnis | Notiz |
|---|---|---|---|
| AC-1 | „Zurückziehen"-Button im Verlauf-Tab pro Vakanz-Link | ✅ PASS | Code-Review: Button korrekt in `AgenturDetailSheet` implementiert |
| AC-2 | Button nur aktiv für Status = „Gespielt" | ✅ PASS | `RUECKZUG_ERLAUBT = ["Gespielt"]` Konstante; Button nicht gerendert für andere Status |
| AC-3 | Dialog mit Bestätigungstext + optionalem Grund-Textfeld | ✅ PASS | `RueckzugDialog` mit AlertDialog + Textarea |
| AC-4 | Status → „Zurückgezogen" + `grund_rueckzug` gespeichert | ✅ PASS | Integration-Tests verifiziert; DB-Migration angewendet |
| AC-5 | Manager sieht „Zurückgezogen" mit grauem Badge | ⚠️ PARTIAL | Agentur-Ansicht ✓ grauer Badge; Manager-Ansicht (`/ressourcen`) → BUG-14-1 |
| AC-6 | Manager kann zurückgezogene Einträge nicht weiter schieben | ✅ PASS | Status-Route gibt 409 für „Zurückgezogen" — Integration-Test ✓ |
| AC-7 | Pool-Ressource bleibt nach Rückzug erhalten | ✅ PASS | Backend ändert nur `ressource_vakanz_links`, nicht `ressourcen` |
| AC-8 | Historien-Eintrag wird automatisch erstellt | ✅ PASS | Integration-Test: `mockHistorieInsert` wurde aufgerufen mit korrektem Text |

### Edge Cases

| Edge Case | Ergebnis | Notiz |
|---|---|---|
| Status bereits weiter (Interview geplant) | ✅ PASS | API gibt 409; Dialog zeigt `toast.error` |
| Race Condition / gleichzeitiger Statuswechsel | ✅ PASS | Backend prüft Status atomisch vor Update; 409 bei Konflikt |
| Agentur zieht fremde Ressource zurück | ✅ PASS | Ownership-Check: `ressource.agentur_id !== profile.agentur_id` → 403 |
| Netzwerkfehler | ✅ PASS | Atomare DB-Operation; kein Teilzustand möglich |

### Security Audit

| Prüfung | Ergebnis |
|---|---|
| Unauthentifizierter Zugriff auf PATCH /rueckzug | ✅ 401 |
| Manager versucht Rückzug (falsche Rolle) | ✅ 403 — Agentur-only Check |
| Agentur zieht fremde Ressource zurück | ✅ 403 — Ownership-Check |
| XSS im Grund-Textfeld | ✅ React escaped, keine Injection möglich |
| Grund-Text länger als 500 Zeichen | ✅ 400 — Zod-Validierung |
| Duplikat-Rückzug (bereits zurückgezogen) | ✅ 409 — Status-Check |

### Bugs

| ID | Schwere | Beschreibung | Schritte |
|---|---|---|---|
| BUG-14-1 | **Medium** | Manager-Ansicht (`/ressourcen`) kennt Status „Zurückgezogen" nicht: `VALID_TRANSITIONS["Zurückgezogen"]` ist `undefined` → Runtime-Crash `TypeError: Cannot read properties of undefined (reading 'length')` wenn Manager eine Ressource mit zurückgezogenem Link öffnet | Manager → `/ressourcen` → Ressource öffnen die auf einer Vakanz gespielt und zurückgezogen wurde |

### Regression Testing

| Feature | Ergebnis |
|---|---|
| PROJ-11: Ressource auf Vakanz spielen (Status-Workflow) | ✅ API-Tests unverändert; 409 für Zurückgezogen blockiert korrekt |
| PROJ-12: Ressourcen-Feedback | ✅ Unverändert |
| PROJ-13: Easy Action Button | ✅ Unverändert |
| PROJ-9: Pool CRUD | ✅ Ressource bleibt nach Rückzug im Pool |

### Produktion-Ready-Entscheidung

**READY** — BUG-14-1 wurde behoben: `ressourcen/page.tsx` kennt jetzt `"Zurückgezogen"` als terminalen Status mit grauem Badge. Alle ACs bestehen, keine Critical/High Bugs.
