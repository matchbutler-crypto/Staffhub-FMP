# Matching Prompt Optimierung — Design Spec
_Datum: 2026-06-08_

## Problem

Der bestehende `KI_BEWERTUNG_PROMPT` in `src/lib/openai.ts` liefert zu viele "Nicht geeignet"-Bewertungen, auch für Kandidaten die gut zur Vakanz passen. Ursachen:

- Das Modell interpretiert fehlende Skills zu streng, ohne Gewichtung
- `skills_nice_have` der Vakanz wird nicht an das Modell übergeben — es gibt keine Unterscheidung zwischen Pflicht- und Wunsch-Skills
- Die `empfehlung`-Kategorien haben keine definierten Schwellenwerte, das Modell entscheidet frei
- Beschreibungs-Limit (500 Zeichen) ist zu kurz für vollständigen Kontext
- Ollama-Integration ist toter Code (alle produktiven Calls laufen über OpenAI)

---

## Ziel

- Genauere und konsistentere Scores durch ein strukturiertes Bewertungsraster mit fixen Gewichten
- `skills_nice_have` fließt in die Bewertung ein (Bonus, kein Pflichtkriterium)
- `empfehlung` wird deterministisch aus dem Score abgeleitet, nicht frei vom Modell gewählt
- Ollama-Code vollständig entfernt

---

## Design

### 1. Neuer Matching-Prompt (`KI_BEWERTUNG_PROMPT`)

Das Modell bewertet vier Dimensionen explizit und summiert den Score:

| Dimension | Max. Punkte | Regel |
|---|---|---|
| Must-have Skills | 50 | Anteilig je vorhandenem Skill; verwandte Skills = halber Treffer; keine Must-haves gefordert = volle 50 Pkt |
| Erfahrungslevel | 20 | Exakt: 20 / eine Stufe drunter: 10 / eine Stufe drüber: 18 / zwei+ Stufen drunter: 0 |
| Nice-to-have Skills | 15 | Anteilig je vorhandenem Nice-to-have; keine Nice-to-haves = volle 15 Pkt |
| Gesamtfitness (Beschreibung) | 15 | Gut: 15 / Teilweise: 8 / Kaum: 0 |

Empfehlung wird vom Modell nach fixen Schwellenwerten gesetzt (nicht frei interpretiert):
- `>= 65` → `"Empfohlen"`
- `>= 40` → `"Bedingt geeignet"`
- `< 40` → `"Nicht geeignet"`

`skill_vorhanden` und `skill_fehlend` beziehen sich nur auf Must-have-Skills.

### 2. Route-Änderung (`ki-match/route.ts`)

Die Vakanz-Query wird um `skills_nice_have` erweitert:

```ts
.select('id, titel, rolle, beschreibung, skills, skills_nice_have, erfahrungslevel')
```

Das Feld wird als `skills_nice_have: vakanz.skills_nice_have ?? []` an `bewerteProfilMitOpenAI` übergeben.

### 3. Signatur-Erweiterung (`bewerteProfilMitOpenAI`)

```ts
vakanz: {
  titel: string
  beschreibung: string
  skills: string[]
  skills_nice_have: string[]  // neu
  erfahrungslevel: string
}
```

### 4. Token-/Limit-Anpassungen

| Parameter | Vorher | Nachher |
|---|---|---|
| `vakanz.beschreibung` Limit | 500 Zeichen | 800 Zeichen |
| `profil.profiltext` Limit | 1000 Zeichen | 1500 Zeichen |
| `max_tokens` | 500 | 600 |

`temperature` bleibt 0.3.

### 5. Ollama-Entfernung

Folgende Dateien werden gelöscht:
- `src/lib/ollama.ts`
- `src/lib/ollama.test.ts`
- `src/app/api/ollama-health/route.ts`

Der `/api/profile/[id]/ki-bewertung` endpoint wird ebenfalls auf die neue `bewerteProfilMitOpenAI`-Signatur angepasst (nur Signatur, keine Logikänderung).

---

## Betroffene Dateien

| Datei | Änderungstyp |
|---|---|
| `src/lib/openai.ts` | Prompt + Signatur ändern |
| `src/app/api/ressourcen/[id]/ki-match/route.ts` | Query + Aufruf anpassen |
| `src/app/api/profile/[id]/ki-bewertung/route.ts` | Signatur-Anpassung |
| `src/lib/ollama.ts` | Löschen |
| `src/lib/ollama.test.ts` | Löschen |
| `src/app/api/ollama-health/route.ts` | Löschen |

---

## Nicht im Scope

- Kein zweistufiges Matching (Ansatz C verworfen)
- Kein Umbau der DB-Struktur
- Kein UI-Änderung an `KiBewertungDisplay`
- Kein Caching der Scores
