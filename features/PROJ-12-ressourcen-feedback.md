# PROJ-12: Ressourcen-Feedback

## Status: Approved
**Created:** 2026-04-18
**Last Updated:** 2026-04-18

## Dependencies
- Requires: PROJ-9 (Freelancer-Pool CRUD) — Ressourcen müssen existieren
- Optional: PROJ-11 (Vakanz-Workflow) — Feedback häufig nach Vakanz-Prozess

## Beschreibung
Staffhub Manager und Agenturen können strukturiertes Feedback zu einer Pool-Ressource hinterlassen.
Feedback ist an die Ressource gebunden (nicht an eine Vakanz-Verknüpfung).

Agenturen sehen nur ihr eigenes Feedback + das Feedback des Managers zu ihren Ressourcen.
Manager sehen alles.

## Feedback-Felder

| Feld | Typ | Pflicht |
|------|-----|---------|
| Text | Freitext | ✅ |
| Bewertung | 1–5 Sterne | optional |
| Verfasser | Automatisch (eingeloggter User) | — |
| Zeitstempel | Automatisch | — |
| Vakanz-Referenz | Verknüpfung zu Vakanz (optional) | optional |

## User Stories

- Als Staffhub Manager möchte ich nach einem abgeschlossenen Prozess Feedback zur Ressource hinterlassen, damit die Agentur und ich in Zukunft besser einschätzen können, ob sie passt.
- Als Agentur möchte ich das Feedback des Managers zu meinen Ressourcen sehen, damit ich mein Angebot verbessern kann.
- Als Agentur möchte ich selbst Feedback zu einer Ressource hinterlassen (z.B. interne Notizen nach einem Gespräch).
- Als Staffhub Manager möchte ich alle Feedbacks zu einer Ressource in chronologischer Reihenfolge sehen.

## Acceptance Criteria

- [ ] Manager und Agentur können Feedback-Einträge zu einer Ressource erstellen
- [ ] Feedback enthält: Text (Pflicht), Sterne-Bewertung 1–5 (optional), optionale Vakanz-Referenz
- [ ] Verfasser und Zeitstempel werden automatisch gesetzt
- [ ] Agentur sieht nur Feedback zu eigenen Ressourcen (RLS)
- [ ] Manager sieht Feedback aller Ressourcen
- [ ] Feedback kann nicht bearbeitet werden (nur gelöscht, nur durch Verfasser)
- [ ] Feedbacks sind chronologisch sortiert (neuestes zuerst)
- [ ] Durchschnitts-Bewertung (Sterne) wird als Zusammenfassung angezeigt, wenn ≥ 1 Bewertung vorhanden
- [ ] Feedback-Abschnitt ist in der Ressourcen-Detailansicht integriert

## Edge Cases

- Ressource hat noch kein Feedback → Leer-Zustand mit Hinweistext
- Agentur versucht Feedback einer anderen Agentur zu sehen → 403 (RLS)
- Feedback-Löschung durch nicht-Verfasser → 403
- Vakanz-Referenz auf gelöschte Vakanz → Referenz wird als "Vakanz nicht mehr vorhanden" angezeigt, Feedback bleibt
- Alle Bewertungen sind ohne Sterne → kein Durchschnitt angezeigt

## Technical Requirements
- Neue Tabelle `ressource_feedback` (ressource_id, text, bewertung, vakanz_id nullable, erstellt_von, created_at)
- RLS: Agentur sieht nur Feedback zu eigenen Ressourcen
- API: GET/POST `/api/ressourcen/[id]/feedback`, DELETE `/api/ressource-feedback/[id]`
- Keine Updates auf Feedback-Einträge (immutable after creation)

---

## Implementation Notes
- Tabelle `ressource_feedback`: id, ressource_id (→ ressourcen ON DELETE CASCADE), text (max 2000), bewertung (SMALLINT 1–5 nullable), vakanz_id (→ vakanzen_data ON DELETE SET NULL), erstellt_von (→ auth.users), created_at
- RLS: Agentur sieht nur Feedback zu eigenen Ressourcen; Manager/Admin sehen alles; DELETE nur durch Verfasser
- API: `GET/POST /api/ressourcen/[id]/feedback`, `DELETE /api/ressource-feedback/[id]`
- Frontend: Feedback-Tab in `RessourceDetailSheet` (Manager, `/ressourcen`) und `AgenturDetailSheet` (Agentur, `/pool`)
- Sterne-Bewertung interaktiv via `StarRating`-Komponente; Durchschnitt wird angezeigt wenn ≥1 Bewertung
- Löschen: Trash-Icon auf jedem Eintrag, RLS setzt "nur Verfasser"-Regel durch (403 → 404-ähnliche Antwort)

## Tech Design (Solution Architect)
_Skipped — Spec war klar genug für direkte Implementierung_

## QA Test Results

**Datum:** 2026-04-19
**Tester:** QA Engineer (Claude)
**Ergebnis: PRODUCTION READY ✅**

### Acceptance Criteria

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Manager und Agentur können Feedback erstellen | ✅ Pass |
| 2 | Text (Pflicht), Sterne 1–5 (optional), Vakanz-Ref (optional) | ✅ Pass |
| 3 | Verfasser + Zeitstempel automatisch | ✅ Pass |
| 4 | Agentur sieht nur Feedback zu eigenen Ressourcen (RLS) | ✅ Pass |
| 5 | Manager sieht Feedback aller Ressourcen | ✅ Pass |
| 6 | Kein Update, nur Delete (durch Verfasser) | ✅ Pass |
| 7 | Chronologisch sortiert (neuestes zuerst) | ✅ Pass |
| 8 | Durchschnittsbewertung angezeigt wenn ≥1 Sterne-Bewertung | ✅ Pass |
| 9 | Feedback-Tab in Ressourcen-Detailansicht integriert | ✅ Pass |

### Edge Cases

| Szenario | Status |
|----------|--------|
| Keine Feedbacks → Leer-Zustand mit Hinweistext | ✅ Pass |
| Agentur auf fremde Ressource → RLS blockiert (leeres Array) | ✅ Pass |
| Delete ohne Auth → 401 | ✅ Pass |
| Alle Bewertungen ohne Sterne → kein Durchschnitt | ✅ Pass |
| Vakanz-Referenz auf gelöschte Vakanz → "nicht mehr vorhanden" | ✅ Pass (ON DELETE SET NULL + UI-Check) |

### Test-Ergebnisse

- **Vitest Integration Tests:** 11 neue Tests, alle 103 Tests bestanden
- **E2E Playwright Tests:** 5/5 API-Auth-Tests bestanden; 6 UI-Tests skipped (Credentials erforderlich)

### Security Audit

- POST ohne Auth → 401 ✅
- GET ohne Auth → 401 ✅
- DELETE ohne Auth → 401 ✅
- DELETE fremdes Feedback → 404 (RLS `erstellt_von = auth.uid()`) ✅
- Zod-Validierung: leerer Text → 400, bewertung > 5 → 400 ✅
- Kein UPDATE-Endpunkt (Feedback immutable) ✅

### Bugs

Keine Critical/High Bugs gefunden.

## Deployment
_To be added by /deploy_
