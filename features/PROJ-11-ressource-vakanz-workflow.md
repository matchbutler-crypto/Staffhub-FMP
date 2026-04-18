# PROJ-11: Ressource auf Vakanz spielen + Status-Workflow

## Status: Planned
**Created:** 2026-04-18
**Last Updated:** 2026-04-18

## Dependencies
- Requires: PROJ-9 (Freelancer-Pool CRUD) — Ressourcen müssen existieren
- Requires: PROJ-2 (Vakanzen-CRUD) — Vakanzen müssen existieren
- Optional: PROJ-5 (Profil-Status-Workflow) — verwandter Workflow, aber unabhängige Entität

## Beschreibung
Der Staffhub Manager kann eine Pool-Ressource manuell mit einer offenen Vakanz verknüpfen ("spielen").
Dadurch entsteht eine `ressource_vakanz_verknüpfung` — keine automatische Profilerstellung.

Der Manager pflegt anschließend den Prozess-Status dieser Verknüpfung:
`Gespielt → Interview geplant (Datum) → Zugesagt / Abgesagt / Abgelehnt`

Jede Statusänderung wird automatisch in der **Ressourcen-Historie** eingetragen (System-Eintrag).
Die Agentur sieht die Statushistorie ihrer eigenen Ressourcen.

## Status-Workflow

```
Gespielt
  └─→ Interview geplant [Datum]
        ├─→ Zugesagt   (Ressource wird beauftragt)
        ├─→ Abgesagt   (Agentur/Kandidat zieht zurück)
        └─→ Abgelehnt  (Manager lehnt ab)
```

Rückschritte sind nicht erlaubt (kein "Zugesagt → Interview geplant").

## User Stories

- Als Staffhub Manager möchte ich eine Ressource aus dem Pool auf eine passende Vakanz spielen, damit ich den Prozess strukturiert verfolgen kann.
- Als Staffhub Manager möchte ich den Status der Verknüpfung jederzeit weiterschalten, damit Agentur und Manager immer den aktuellen Stand sehen.
- Als Staffhub Manager möchte ich bei "Interview geplant" ein konkretes Datum eintragen.
- Als Agentur möchte ich sehen, auf welche Vakanzen meine Ressourcen gespielt wurden und welchen Status sie haben.
- Als Agentur möchte ich die vollständige Statushistorie meiner Ressource sehen (automatische System-Einträge).
- Als Staffhub Manager möchte ich sehen, welche Ressourcen aktuell auf eine bestimmte Vakanz gespielt sind.

## Acceptance Criteria

- [ ] Manager kann aus der Ressourcen-Übersicht heraus eine Ressource auf eine offene Vakanz spielen (Vakanz-Auswahl per Dropdown/Suche)
- [ ] Verknüpfung wird in Tabelle `ressource_vakanz_links` gespeichert (Ressource-ID, Vakanz-ID, Status, created_by, Timestamps)
- [ ] Initialer Status beim Spielen ist automatisch "Gespielt"
- [ ] System schreibt automatisch Eintrag in `ressource_historie`: "Auf Vakanz [Titel] gespielt" mit Zeitstempel
- [ ] Manager kann Status weiterschalten (nur vorwärts, außer Abgesagt/Abgelehnt von jedem Status aus erreichbar)
- [ ] Bei "Interview geplant": Datumsfeld Pflicht
- [ ] Jede Statusänderung erzeugt automatischen System-Eintrag in `ressource_historie`
- [ ] Agentur sieht bei jeder Ressource: Liste der Vakanz-Verknüpfungen mit aktuellem Status
- [ ] Agentur sieht vollständige Statushistorie der Ressource (chronologisch)
- [ ] Deaktivierte Ressource kann nicht gespielt werden
- [ ] Dieselbe Ressource kann mehrfach auf verschiedene Vakanzen gespielt werden (parallele Verknüpfungen erlaubt)
- [ ] Dieselbe Ressource kann NICHT zweimal auf dieselbe Vakanz gespielt werden (wenn noch aktiv)

## Edge Cases

- Manager spielt Ressource auf geschlossene Vakanz → nicht erlaubt, Fehlermeldung
- Status-Rückschritt versucht (z.B. Zugesagt → Gespielt) → nicht erlaubt
- Ressource wird deaktiviert während sie aktiv auf einer Vakanz läuft → bestehende Verknüpfung bleibt, neue nicht mehr möglich
- Vakanz wird geschlossen während Ressource "Interview geplant" hat → Verknüpfung bleibt, Status wird nicht automatisch geändert
- Interview-Datum liegt in der Vergangenheit → Warnung, kein Block

## Technical Requirements
- Neue Tabelle `ressource_vakanz_links` (ressource_id, vakanz_id, status, interview_datum, created_by, created_at, updated_at)
- Neue Tabelle `ressource_historie` (ressource_id, typ: 'system'|'manuell', text, erstellt_von, created_at)
- RLS: Agentur sieht nur eigene Verknüpfungen; Manager sieht alle
- API: POST `/api/ressourcen/[id]/spielen`, PATCH `/api/ressource-vakanz-links/[id]/status`
- Trigger oder API-Logik: bei jeder Statusänderung → Eintrag in `ressource_historie`

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
