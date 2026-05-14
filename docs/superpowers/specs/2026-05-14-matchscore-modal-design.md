# Matchscore im „Ressource einsetzen" Modal

**Datum:** 2026-05-14  
**Status:** Genehmigt

## Ziel

Im „Ressource einsetzen" Modal (Tab „Aus Pool auswählen") soll jede Ressource mit einem Matchscore gegen die aktuelle Vakanz angezeigt werden. Die Berechnung erfolgt rein algorithmisch (kein KI-Einsatz) auf Basis des Skill-Overlaps.

## Scope

Nur der Tab „Aus Pool auswählen" in `RessourceEinsetzenDialog`. Der Tab „Neu anlegen" ist nicht betroffen.

## Datenfluss

`RessourceEinsetzenDialog` erhält zwei neue Props:
- `vakanzSkills: string[]` — Pflicht-Skills der Vakanz
- `vakanzErfahrungslevel: string` — Erfahrungslevel der Vakanz

Diese werden in `src/app/vakanzen/page.tsx` aus dem bereits vorhandenen `ressourceEinsetzenVakanz`-Objekt übergeben. Keine API-Änderung erforderlich.

## Score-Berechnung

Verwendung der bestehenden Funktion `calculateSkillMatchScore` aus `src/lib/calculateScore.ts`:
- Case-insensitives String-Matching
- Score = (Anzahl übereinstimmender Vakanz-Skills) / (Gesamtzahl Vakanz-Skills) × 100
- Ergebnis: 0–100 %
- Wenn die Vakanz keine Skills hat: Score = 100 %

Die Berechnung erfolgt vollständig client-seitig beim Rendern des Modals.

## Layout-Änderung

Das bisherige Karten-Layout (`div.divide-y`) wird durch eine 4-spaltige Tabelle ersetzt:

| Spalte | Datenquelle | Anmerkung |
|--------|-------------|-----------|
| Name | `r.name` | Klickbare Zeile zur Auswahl |
| Rolle | `r.erfahrungslevel` | Badge mit Farbe (wie Pool-Seite) |
| Verfügbar ab | `r.verfuegbar_ab` | Deutsches Datumsformat (`de-DE`), sonst „—" |
| Matchscore | Berechnet | Badge: grün ≥70 %, gelb 40–69 %, rot <40 % |

**Sortierung:** Absteigend nach Matchscore. „Bereits eingereicht"-Ressourcen werden ausgegraut ans Ende gesetzt, ihr Score bleibt sichtbar.

## Typ-Erweiterung

`PoolRessource` in `ressource-einsetzen-dialog.tsx` bekommt `verfuegbar_ab?: string | null` (Feld wird bereits von der API geliefert, fehlte nur im TypeScript-Typ).

## Betroffene Dateien

1. `src/components/ressource-einsetzen-dialog.tsx` — Props, Typ, Score-Berechnung, Tabellen-Layout
2. `src/app/vakanzen/page.tsx` — zwei neue Props beim Dialog-Aufruf

## Nicht im Scope

- KI-basiertes Scoring
- Nice-to-have Skills (`skills_nice_have`) in der Score-Berechnung
- Änderungen am Tab „Neu anlegen"
- Änderungen an der API
