# PROJ-15: Ollama Matching für Pool-Ressourcen

**Status:** Deployed  
**Erstellt:** 2026-04-19  
**Priorität:** P2

---

## Beschreibung

Erweiterung des bestehenden Ollama-KI-Matchings (PROJ-4, aktuell nur für `kandidaten_profile`) auf Pool-Ressourcen (`ressourcen`-Tabelle). Staffhub Manager und Agenturen können einen KI-Score einer Pool-Ressource gegen eine Vakanz berechnen lassen — bevor die Ressource formal eingereicht wird.

**Abgrenzung zu PROJ-4:**  
PROJ-4 bewertet `kandidaten_profile` automatisch nach dem Einreichungs-Upload. PROJ-15 bewertet `ressourcen` (Pool-Einträge) manuell auf Knopfdruck gegen beliebige Vakanzen.

---

## User Stories

1. Als Staffhub Manager möchte ich in der Pool-Übersicht sehen, wie gut eine Ressource zu einer offenen Vakanz passt (KI-Score), damit ich Agenturen gezielt ansprechen kann.
2. Als Agentur möchte ich für eine meiner Pool-Ressourcen auf Knopfdruck einen KI-Vorschau-Score gegen eine Vakanz berechnen lassen, bevor ich sie formell einreiche.
3. Als Staffhub Manager möchte ich für alle aktiven Ressourcen im Pool einen Massen-Match gegen eine Vakanz starten können, damit ich die Top-Kandidaten identifiziere.
4. Als Agentur möchte ich, wenn ich eine Ressource auf eine Vakanz spielen will, den KI-Score als Entscheidungshilfe sehen (im `ProfilEinreichenDialog`).

---

## Acceptance Criteria

- [ ] AC-1: In der Ressourcen-Detailansicht (Pool-Sheet) gibt es eine Schaltfläche „KI-Match berechnen" mit Vakanz-Auswahl
- [ ] AC-2: Die KI sendet Skills, Erfahrungslevel und Profilnotizen der Ressource gegen Vakanz-Anforderungen an lokale Ollama-Instanz
- [ ] AC-3: Ergebnis: Match-Score (0–100), Skill-Coverage (vorhanden / fehlend), Kurzbegründung, Empfehlung (Empfohlen / Bedingt / Nicht geeignet)
- [ ] AC-4: Score-Ergebnis wird im Pool-Sheet angezeigt und in der Tabelle als Badge (ähnlich PROJ-4)
- [ ] AC-5: Score wird in der Datenbank gespeichert (`ressource_ki_scores` Tabelle: ressource_id, vakanz_id, score, empfehlung, begruendung, berechnet_am)
- [ ] AC-6: Manager kann in der Pool-Übersicht nach Vakanz filtern und erhält die Ressourcen nach KI-Score sortiert
- [ ] AC-7: Im `ProfilEinreichenDialog` (PROJ-11/PROJ-13) wird ein bereits berechneter Score für diese Vakanz-Ressource-Kombination angezeigt
- [ ] AC-8: Agentur sieht nur Scores für eigene Ressourcen; Manager sieht alle

---

## Edge Cases

- Ollama-Instanz nicht erreichbar → API gibt 503 mit Hinweis; kein Score gespeichert; Retry möglich
- Ressource hat keine Skills/Notizen → Ollama bekommt reduzierte Datenbasis; Score trotzdem berechnet mit Hinweis „Unvollständige Datenbasis"
- Score bereits vorhanden (gleiche Ressource/Vakanz-Kombi) → Neuberechnung überschreibt den alten Score; Zeitstempel aktualisiert
- Massen-Match (alle Ressourcen gegen eine Vakanz) → Asynchron, Fortschrittsanzeige; max. 50 Ressourcen auf einmal

---

## Dependencies

- Requires: PROJ-4 (KI-Bewertung via Ollama) — Ollama-Infrastruktur, API-Route-Pattern, Prompt-Template
- Requires: PROJ-9 (Freelancer-Pool CRUD) — `ressourcen`-Tabelle als Datenquelle
- Recommends: PROJ-13 (Easy Action Button) — Score im Einreichungs-Dialog anzeigen

---

## Hinweis zum Datenschutz

Kandidatendaten (Skills, Notizen) der Ressource werden nur an die **lokale** Ollama-Instanz gesendet — kein Cloud-AI-Service. Gleiches Prinzip wie PROJ-4.

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Pool-Seite (bestehend)
└── Ressource-DetailSheet (bestehend, Tab "Details")
    └── KI-Match-Bereich  ← NEU
        ├── Vakanz-Select (Dropdown: offene Vakanzen)
        ├── "KI-Match berechnen"-Button
        └── Score-Karte (Score-Badge, Empfehlung, Begründung, Skill-Coverage)
            (zeigt letzten gespeicherten Score für diese Vakanz-Kombi)

Pool-Seite - Tabelle (bestehend)
└── KI-Score-Badge in Zeile  ← NEU (wenn Vakanz-Filter aktiv + Score vorhanden)

RessourceEinsetzenDialog (PROJ-13, bestehend)
└── Score-Hinweis-Badge  ← NEU (wenn Score für diese Vakanz vorhanden)
```

### Datenmodell

Neue Tabelle `ressource_ki_scores` (keine Änderung an bestehenden Tabellen):

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | UUID | Primary Key |
| `ressource_id` | UUID → ressourcen | Foreign Key, CASCADE DELETE |
| `vakanz_id` | UUID → vakanzen_data | Foreign Key, CASCADE DELETE |
| `score` | INTEGER (0–100) | KI-Match-Score |
| `empfehlung` | TEXT (Enum) | Empfohlen / Bedingt geeignet / Nicht geeignet |
| `begruendung` | TEXT | 2–4 Sätze Begründung |
| `skill_vorhanden` | TEXT[] | Geforderte Skills die vorhanden sind |
| `skill_fehlend` | TEXT[] | Geforderte Skills die fehlen |
| `model` | TEXT | Ollama-Modell-Name |
| `berechnet_am` | TIMESTAMPTZ | Zeitstempel der Berechnung |
| `berechnet_von` | UUID → auth.users | Wer hat berechnet |
| UNIQUE | (ressource_id, vakanz_id) | Neuberechnung überschreibt via UPSERT |

### API

| Endpunkt | Methode | Rolle | Aktion |
|---|---|---|---|
| `/api/ressourcen/[id]/ki-match` | POST | Agentur (eigene) / Manager | Berechnet Score via Ollama, speichert via UPSERT |
| `/api/ressourcen/[id]/ki-match` | GET | Agentur (eigene) / Manager | Letzten Score für optionale `?vakanz_id=` abrufen |

### Tech-Entscheidungen

**`bewerteProfilMitOllama()` direkt wiederverwenden:** Die bestehende Ollama-Funktion aus PROJ-4 erhält Vakanz-Anforderungen + Ressourcen-Daten — exakt das gleiche Interface. Kein neuer Ollama-Code nötig.

**UPSERT statt INSERT:** `ON CONFLICT (ressource_id, vakanz_id) DO UPDATE` — Neuberechnung überschreibt alten Score automatisch.

**Massen-Match (AC-6) als Frontend-Loop:** Manager wählt Vakanz → Frontend iteriert Ressourcen und ruft sequenziell `/ki-match` auf. Kein separater Batch-Endpunkt nötig für MVP.

**Score in Tabelle nur mit Vakanz-Kontext:** KI-Score-Badge in Pool-Tabellenzeile erscheint nur wenn Vakanz-Filter aktiv ist.

### Neue Pakete

Keine — Ollama-Infrastruktur aus PROJ-4 bereits vorhanden.

---

## QA Test Results

**Datum:** 2026-04-19
**Tester:** QA Engineer (Claude)
**Umgebung:** Lokal (localhost:3000), Chromium

### Automated Tests

| Suite | Ergebnis |
|---|---|
| Vitest (126 Tests, 13 Files) | ✅ 126/126 passed |
| Playwright E2E PROJ-15 (8 Tests) | ✅ 5 passed, 3 skipped (keine Test-Credentials) |
| Playwright Regression (gesamt) | ⚠️ 1 pre-existing failure (PROJ-1 Login-Text), nicht PROJ-15-related |

### Acceptance Criteria

| AC | Beschreibung | Ergebnis | Notiz |
|---|---|---|---|
| AC-1 | KI-Match-Bereich mit Vakanz-Select + Button im Details-Tab | ✅ PASS | Select + „KI-Match"-Button + Score-Karte implementiert |
| AC-2 | Skills, Erfahrungslevel, Notizen werden an Ollama gesendet | ✅ PASS | API-Route sendet vollständige Ressource-Daten via `bewerteProfilMitOllama()` |
| AC-3 | Score, Skill-Coverage, Begründung, Empfehlung angezeigt | ✅ PASS | Score-Karte mit Farb-Badge, Skill-Tags (grün/rot), Begründung, Zeitstempel |
| AC-4 | Score im Pool-Sheet ✅ + als Badge in Tabelle | ⚠️ PARTIAL | Sheet-Anzeige ✅; Tabellen-Badge fehlt → BUG-15-1 |
| AC-5 | Score in `ressource_ki_scores` gespeichert (UPSERT) | ✅ PASS | DB-Migration angewendet; UPSERT via `ON CONFLICT (ressource_id, vakanz_id)` |
| AC-6 | Manager kann nach Vakanz filtern + nach KI-Score sortieren | ❌ FAIL | Kein Vakanz-Filter in Pool-Tabelle, kein KI-Score-Sort → BUG-15-2 |
| AC-7 | ProfilEinreichenDialog zeigt vorhandenen Score | ❌ FAIL | Dialog wurde nicht erweitert → BUG-15-3 |
| AC-8 | Agentur sieht nur eigene Scores; Manager sieht alle | ✅ PASS | RLS-Policies + API-Ownership-Check korrekt implementiert |

### Edge Cases

| Edge Case | Ergebnis | Notiz |
|---|---|---|
| Ollama nicht erreichbar → 503 | ✅ PASS | API gibt 503 mit „Ollama nicht erreichbar"; kein Score gespeichert |
| Ressource ohne Skills/Notizen → reduzierte Datenbasis | ✅ PASS | API sendet leere Skills-Array + Fallback-Text; Score wird trotzdem berechnet |
| Score bereits vorhanden → UPSERT überschreibt | ✅ PASS | `ON CONFLICT DO UPDATE`; Zeitstempel wird aktualisiert |
| Massen-Match (AC-6 Basis) | ⚠️ N/A | Nicht testbar ohne Vakanz-Filter-UI (BUG-15-2) |
| Frontend 503-Erkennung | ⚠️ LOW | `err.message.includes("503")` schlägt nie an; Fehlermeldung kommt trotzdem via else-Branch → BUG-15-4 |

### Security Audit

| Prüfung | Ergebnis |
|---|---|
| Unauthentifizierter GET | ✅ 401 |
| Unauthentifizierter POST | ✅ 401 |
| Agentur matched fremde Ressource | ✅ 403 — Ownership-Check im Backend |
| Ungültige UUID als vakanz_id | ✅ 400 — Zod-Validierung |
| XSS in begruendung/skill-Feldern | ✅ React escaped, keine Injection möglich |
| RLS auf ressource_ki_scores | ✅ Policies für alle Rollen implementiert |
| Kandidatendaten bleiben lokal | ✅ Nur lokale Ollama-Instanz, kein Cloud-AI |

### Regression Testing

| Feature | Ergebnis |
|---|---|
| PROJ-9: Freelancer-Pool CRUD | ✅ Pool-Seite lädt korrekt, bestehende Funktionen unverändert |
| PROJ-14: Ressource zurückziehen | ✅ Zurückziehen-Funktion unverändert |
| PROJ-12: Ressourcen-Feedback | ✅ Feedback-Tab unverändert |
| PROJ-11: Ressource auf Vakanz spielen | ✅ Status-Workflow unverändert |

### Bugs

| ID | Schwere | Beschreibung | Schritte |
|---|---|---|---|
| BUG-15-1 | **High** | KI-Score-Badge fehlt in Pool-Tabelle (AC-4 partial) | ✅ BEHOBEN: Tabellenspalte „KI-Score" erscheint wenn Vakanz-Filter aktiv |
| BUG-15-2 | **High** | Kein Vakanz-Filter + kein KI-Score-Sort in Pool-Tabelle (AC-6) | ✅ BEHOBEN: Manager-sichtbares Vakanz-Dropdown; Tabelle sortiert nach Score desc |
| BUG-15-3 | **Medium** | ProfilEinreichenDialog zeigt keinen KI-Score (AC-7) | ✅ BEHOBEN: Score-Hinweis-Badge nach Vakanz-Auswahl im Dialog |
| BUG-15-4 | **Low** | Frontend 503-Erkennung greift nicht | ✅ BEHOBEN: Prüft jetzt `res.status === 503` vor dem throw |

### Produktion-Ready-Entscheidung

**READY** — Alle Bugs behoben. Build ✅, 126/126 Tests ✅, keine Critical/High Bugs.
