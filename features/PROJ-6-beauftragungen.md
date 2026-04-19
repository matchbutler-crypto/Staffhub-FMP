# PROJ-6: Beauftragungen + Margenberechnung

## Status: Deployed
**Created:** 2026-04-13
**Last Updated:** 2026-04-13

## Dependencies
- Requires: PROJ-3 (Profil-Einreichung) — Beauftragung entsteht wenn Profil-Status = "Beauftragt"
- Requires: PROJ-5 (Status-Workflow) — Status-Änderung triggert Beauftragung

---

## Übersicht

Wenn ein Kandidaten-Profil den Status „Beauftragt" erhält, kann der Staffhub Manager eine Beauftragung anlegen. Diese enthält Einkaufspreis (intern), Margenaufschlag und berechnet automatisch Verkaufspreis und Marge. Die Agentur-Übersicht zeigt alle aktiven Beauftragungen.

---

## Acceptance Criteria

- [ ] Manager kann zu einem Profil (Status = "Beauftragt") eine Beauftragung anlegen
- [ ] Felder: Einkaufspreis (€/Tag), Margenaufschlag (€), Startdatum, Stunden/Woche
- [ ] Verkaufspreis wird automatisch berechnet: Einkaufspreis + Margenaufschlag
- [ ] Marge (€ und %) wird automatisch berechnet
- [ ] Einkaufspreis und Marge sind NUR für Manager/Admin sichtbar, nicht für Agentur
- [ ] Übersichtsseite `/agenturen` zeigt alle aktiven Beauftragungen
- [ ] Beauftragung kann bearbeitet werden (Einkaufspreis, Margenaufschlag, Stunden)
- [ ] Beauftragung kann als "Beendet" markiert werden

---

## Tech Design

### Datenmodell

**Tabelle `beauftragungen`:**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `profil_id` | UUID → kandidaten_profile | Das beauftragte Profil |
| `agentur_id` | UUID → agenturen | Die Agentur |
| `einkaufspreis` | Decimal | Agentur-Preis €/Tag (nur intern) |
| `margenaufschlag` | Decimal | Aufschlag in € |
| `verkaufspreis` | Decimal | Computed: Einkaufspreis + Margenaufschlag |
| `startdatum` | Date | Beauftragungsbeginn |
| `stunden_woche` | Integer | Wochenstunden |
| `aktiv` | Boolean | true = aktiv, false = beendet |
| `created_at` | Timestamp | Automatisch |
| `updated_at` | Timestamp | Automatisch |

### API-Routen

| Methode | Route | Wer | Was |
|---------|-------|-----|-----|
| `GET` | `/api/beauftragungen` | Manager/Admin | Alle aktiven Beauftragungen |
| `POST` | `/api/beauftragungen` | Manager/Admin | Neue Beauftragung anlegen |
| `PUT` | `/api/beauftragungen/[id]` | Manager/Admin | Beauftragung bearbeiten |
| `PATCH` | `/api/beauftragungen/[id]/beenden` | Manager/Admin | Beauftragung beenden |

### RLS
- Beauftragungen: Nur Manager/Admin haben Zugriff (kein Agentur-Zugriff)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
