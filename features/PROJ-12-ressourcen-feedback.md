# PROJ-12: Ressourcen-Feedback

## Status: Planned
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

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
