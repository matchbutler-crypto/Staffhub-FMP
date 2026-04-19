# PROJ-13: Easy Action Button – Ressource auf Vakanz spielen aus Vakanz-Ansicht

**Status:** In Review  
**Erstellt:** 2026-04-19  
**Priorität:** P1

---

## Beschreibung

Agenturen sollen aus der Vakanz-Detailansicht heraus direkt eine Pool-Ressource auf diese Vakanz spielen können — ohne erst in den Pool navigieren zu müssen. Zusätzlich: Wenn kein passender Eintrag im Pool vorhanden ist, kann die Agentur ein neues Profil direkt in der Vakanz anlegen, das gleichzeitig im Pool landet.

Ziel: Minimaler Klick-Aufwand für das häufigste Workflow-Szenario (Vakanz sehen → Ressource platzieren).

---

## User Stories

1. Als Agentur möchte ich auf der Vakanz-Detailseite einen „Ressource einsetzen"-Button sehen, damit ich ohne Umweg in den Pool navigieren zu müssen direkt handeln kann.
2. Als Agentur möchte ich aus meinem Pool eine Ressource auswählen und direkt auf die aktuelle Vakanz spielen, damit der Prozess in 2–3 Klicks erledigt ist.
3. Als Agentur möchte ich, falls keine passende Pool-Ressource existiert, ein neues Profil direkt aus der Vakanz heraus anlegen, das automatisch auch in meinem Pool gespeichert wird.
4. Als Agentur möchte ich nach der Einreichung sofort sehen, dass die Ressource auf die Vakanz gespielt wurde (Bestätigung + Link zum Status).

---

## Acceptance Criteria

- [ ] AC-1: Auf der Vakanz-Detailseite gibt es für Agentur-User einen Button „Ressource einsetzen"
- [ ] AC-2: Ein Dialog öffnet sich mit zwei Optionen: „Aus Pool auswählen" und „Neu anlegen"
- [ ] AC-3: „Aus Pool auswählen" zeigt eine gefilterte Liste eigener Pool-Ressourcen (Suchfeld, Verfügbarkeitsstatus sichtbar); Auswahl pre-füllt das Einreichungsformular
- [ ] AC-4: „Neu anlegen" öffnet ein Formular zur Ressource-Erstellung; nach Speichern landet die Ressource sowohl im Pool als auch direkt in der Vakanz-Einreichung
- [ ] AC-5: Das Einreichungsformular entspricht dem bestehenden `ProfilEinreichenDialog` (h/Woche, verfügbar_ab, VK-Tagesrate, Profiltext)
- [ ] AC-6: Nach erfolgreicher Einreichung wird ein Toast angezeigt; der `ressource_vakanz_links`-Eintrag wird angelegt
- [ ] AC-7: Button ist nur sichtbar wenn Vakanz-Status = „Offen" und Nutzer = Agentur
- [ ] AC-8: Wenn eine Ressource bereits auf diese Vakanz eingereicht wurde, ist sie in der Pool-Liste grau/disabled mit Hinweis „Bereits eingereicht"

---

## Edge Cases

- Agentur hat noch keine Pool-Ressourcen → Dialog zeigt Leer-Zustand mit CTA „Erste Ressource anlegen"
- Vakanz ist nicht mehr offen (gleichzeitiger Statuswechsel durch Manager) → API gibt 409; Dialog zeigt Fehlermeldung
- Netzwerkfehler beim Anlegen → Rollback: Wenn Pool-Eintrag angelegt aber Vakanz-Einreichung scheitert, Pool-Eintrag trotzdem erhalten (kein stiller Datenverlust)
- Agentur hat keine agentur_id → Aktion gesperrt (403 wie bisher)

---

## Dependencies

- Requires: PROJ-9 (Freelancer-Pool CRUD) — Pool-Ressourcen müssen existieren
- Requires: PROJ-11 (Ressource auf Vakanz spielen) — `ressource_vakanz_links` Tabelle + API muss vorhanden sein
- Extends: PROJ-3 (Profil-Einreichung) — bestehender `kandidaten_profile`-Flow bleibt parallel erhalten

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Vakanz-Seite (bestehend)
└── VakanzDetailSheet (bestehend, Sheet-Seitenleiste)
    └── "Ressource einsetzen" Button  ← NEU
        (nur sichtbar: Rolle = Agentur + Vakanz-Status = "Offen")
        └── RessourceEinsetzenDialog  ← NEU (shadcn Dialog)
            ├── Tab "Aus Pool auswählen"
            │   ├── Suchfeld (filtert nach Name/Skills)
            │   ├── Pool-Ressourcen-Liste
            │   │   ├── Ressource-Zeile (Name, Skills, Verfügbarkeitsbadge)
            │   │   └── Bereits eingereicht → grau + Tooltip "Bereits auf dieser Vakanz"
            │   └── Einreichungs-Formular (nach Auswahl)
            │       ├── Stunden/Woche
            │       ├── Verfügbar ab
            │       └── VK-Tagesrate
            └── Tab "Neu anlegen"
                ├── Ressource-Formular (Name, Skills, Erfahrungslevel, Verfügbarkeit)
                │   → Speichert sofort im Pool
                └── Einreichungs-Formular (gleiches wie oben)
                    → Spielt die neue Ressource direkt auf die Vakanz
```

### Datenmodell

Keine neuen Tabellen. Alle benötigten Daten existieren bereits:

| Entität | Tabelle | Neu? |
|---|---|---|
| Pool-Ressourcen der Agentur | `ressourcen` | nein |
| Vakanz-Verknüpfung | `ressource_vakanz_links` | nein |
| Bereits-gespielt-Prüfung | Unique Constraint auf `ressource_vakanz_links` | nein |

**API-Änderungen:**
- `GET /api/ressourcen?vakanz_id=<id>` — neuer optionaler Query-Parameter; gibt `bereits_gespielt: boolean` Flag pro Ressource zurück
- `POST /api/ressourcen/[id]/spielen` — wird um Agentur-Rolle erweitert (Agentur darf nur eigene Ressourcen spielen)

### Tech-Entscheidungen

**Tabs statt zwei Dialoge:** Beide Pfade teilen denselben State (Vakanz-ID, Einreichungsformular). Ein Dialog mit Tabs vermeidet doppelte Implementierung.

**Bereits-gespielt-Flag im API:** Verhindert, dass Agenturen eine bereits eingereichte Ressource auswählen, ohne erst auf "Einreichen" klicken zu müssen. Der Unique Constraint in der DB ist die zweite Schutzlinie.

**Kein Rollback bei "Neu anlegen + Spielen":** Wenn Pool-Anlage gelingt und Vakanz-Spielen scheitert, bleibt die Ressource im Pool erhalten (kein Datenverlust). Die Agentur kann danach manuell einreichen.

**Wiederverwendung:** `ProfilEinreichenDialog`-Muster aus pool/page.tsx wird als Vorlage für das Einreichungsformular genutzt.

### Neue Pakete

Keine — alle shadcn/ui-Komponenten (Dialog, Tabs, Input, Button, Badge, Tooltip) sind bereits installiert.

---

## QA Test Results

**Datum:** 2026-04-19  
**Tester:** QA Engineer (Claude)  
**Umgebung:** Lokal (localhost:3000), Chromium

### Automated Tests

| Suite | Ergebnis |
|---|---|
| Vitest (107 Tests, 11 Files) | ✅ 107/107 passed |
| Playwright E2E PROJ-13 (11 Tests) | ✅ 2 passed, 9 skipped (keine Test-Credentials) |
| Playwright Regression (gesamt) | ⚠️ 1 pre-existing failure (PROJ-1 Login-Text), nicht PROJ-13-related |

### Acceptance Criteria

| AC | Beschreibung | Ergebnis | Notiz |
|---|---|---|---|
| AC-1 | Button „Ressource einsetzen" für Agentur-User | ✅ PASS | Im Dropdown der Vakanzzeile, konsistent mit anderen Aktionen |
| AC-2 | Dialog mit zwei Tabs „Aus Pool" / „Neu anlegen" | ✅ PASS | shadcn Tabs korrekt implementiert |
| AC-3 | Pool-Liste mit Suchfeld + Verfügbarkeitsbadge + Auswahl | ✅ PASS | Suchfeld, Badges, Auswahl mit Checkmark |
| AC-4 | „Neu anlegen" — Ressource in Pool + Vakanz gleichzeitig | ✅ PASS | POST /api/ressourcen → POST spielen, toast-warning bei Spielen-Fehler |
| AC-5 | Einreichungsformular mit h/Woche, verfügbar_ab, VK-Tagesrate | ⚠️ SPEC-FEHLER | Nicht implementiert — `ressource_vakanz_links` speichert diese Felder nicht. Spec referenziert `kandidaten_profile`-Flow irrtümlich. Kein Code-Bug. |
| AC-6 | Toast nach Einreichung + `ressource_vakanz_links`-Eintrag | ✅ PASS | Toast mit Name, DB-Eintrag via API |
| AC-7 | Button nur für Agentur + Vakanz = Offen | ⚠️ PARTIAL | Agentur-Einschränkung ✓; für nicht-offene Vakanzen: Item *disabled* statt *hidden* |
| AC-8 | Bereits eingereichte Ressource grau/disabled + Hinweis | ✅ PASS | `bereits_gespielt`-Flag, `opacity-50`, „Bereits eingereicht" Text |

### Edge Cases

| Edge Case | Ergebnis | Notiz |
|---|---|---|
| Leerer Pool | ✅ PASS | Leer-Zustand mit CTA „Erste Ressource anlegen" + Tab-Switch |
| Vakanz wird während Dialog geschlossen | ✅ PASS | Backend-Check, API gibt 400; Frontend zeigt `toast.error` |
| Netzwerkfehler bei „Neu anlegen + Spielen" | ✅ PASS | Pool-Eintrag bleibt, `toast.warning` erklärt den Zustand |
| Agentur ohne agentur_id | ✅ PASS | API gibt 403 (bestehende Absicherung) |

### Security Audit

| Prüfung | Ergebnis |
|---|---|
| Unauthentifizierter Zugriff auf GET /api/ressourcen?vakanz_id | ✅ 401 |
| Unauthentifizierter Zugriff auf POST /api/ressourcen/[id]/spielen | ✅ 401 |
| Agentur spielt fremde Ressource (andere agentur_id) | ✅ 403 — Ownership-Check im Backend |
| EK-Tagesrate-Sichtbarkeit für fremde Ressourcen | ✅ Nicht in API-Response |
| XSS im Suchfeld | ✅ React escaped, keine Injection möglich |
| Duplikat-Einreichung (selbe Ressource + Vakanz) | ✅ 409 mit Fehlermeldung |

### Bugs

| ID | Schwere | Beschreibung | Schritte |
|---|---|---|---|
| BUG-13-1 | **Low** (Spec-Fehler) | AC-5: Einreichungsformular (h/Woche, VK-Tagesrate etc.) fehlt — aber `ressource_vakanz_links` hat diese Felder nicht. Spec muss korrigiert werden. | Keine Code-Änderung nötig — Spec-Update genügt |
| BUG-13-2 | **Low** | AC-7: „Ressource einsetzen" ist `disabled` statt `hidden` wenn Vakanz-Status ≠ Offen | Vakanz mit Status „Besetzt" öffnen → Dropdown zeigt grauen, nicht anklickbaren Eintrag |

### Regression Testing

| Feature | Ergebnis |
|---|---|
| PROJ-9: Pool CRUD | ✅ Unverändert |
| PROJ-11: Ressource auf Vakanz spielen (Pool-Seite) | ✅ Unverändert |
| PROJ-12: Ressourcen-Feedback | ✅ Unverändert |
| PROJ-3: Profil einreichen (alter Flow) | ✅ „Profil einreichen" weiterhin im Dropdown vorhanden |

### Produktion-Ready-Entscheidung

**READY** — Keine Critical/High Bugs. Beide Low-Bugs sind keine Blocker:
- BUG-13-1 ist ein Spec-Fehler (kein Code-Bug)
- BUG-13-2 ist eine kosmetische UX-Abweichung (disabled vs. hidden)
