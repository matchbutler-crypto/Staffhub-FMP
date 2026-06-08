# Matching Prompt Optimierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den KI-Matching-Prompt durch ein strukturiertes Bewertungsraster ersetzen, das konsistente Scores liefert und `skills_nice_have` einbezieht — und gleichzeitig den ungenutzten Ollama-Code entfernen.

**Architecture:** `bewerteProfilMitOpenAI` in `src/lib/openai.ts` erhält einen neuen strukturierten Prompt mit vier gewichteten Dimensionen und eine erweiterte Signatur (`skills_nice_have`). Die beiden aufrufenden Routes (`ki-match` und `ki-bewertung`) werden entsprechend angepasst. Ollama-Dateien werden gelöscht.

**Tech Stack:** TypeScript, Next.js App Router, OpenAI SDK (`gpt-4o-mini`), Vitest

---

## File Map

| Datei | Aktion |
|---|---|
| `src/lib/openai.ts` | Modify — neuer Prompt, neue Signatur |
| `src/app/api/ressourcen/[id]/ki-match/route.ts` | Modify — Query + Aufruf |
| `src/app/api/ressourcen/[id]/ki-match/route.test.ts` | Modify — Tests anpassen |
| `src/app/api/profile/[id]/ki-bewertung/route.ts` | Modify — Query + Aufruf |
| `src/lib/ollama.ts` | Delete |
| `src/lib/ollama.test.ts` | Delete |
| `src/app/api/ollama-health/route.ts` | Delete |

---

## Task 1: Ollama-Code entfernen

**Files:**
- Delete: `src/lib/ollama.ts`
- Delete: `src/lib/ollama.test.ts`
- Delete: `src/app/api/ollama-health/route.ts`

- [ ] **Step 1: Sicherstellen, dass keine anderen Dateien Ollama importieren**

```bash
grep -r "from '@/lib/ollama'" src/ --include="*.ts" --include="*.tsx"
grep -r "ollama-health" src/ --include="*.ts" --include="*.tsx"
```

Erwartete Ausgabe: Nur `src/app/api/ollama-health/route.ts` importiert aus `@/lib/ollama`. Keine anderen Treffer.

- [ ] **Step 2: Dateien löschen**

```bash
rm "src/lib/ollama.ts"
rm "src/lib/ollama.test.ts"
rm "src/app/api/ollama-health/route.ts"
```

- [ ] **Step 3: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartete Ausgabe: Keine Fehler.

- [ ] **Step 4: Tests laufen lassen**

```bash
npx vitest run
```

Erwartete Ausgabe: Alle Tests grün (ollama.test.ts ist weg, keine weiteren Fehler).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove unused Ollama integration"
```

---

## Task 2: Neuer Matching-Prompt + erweiterte Signatur in `openai.ts`

**Files:**
- Modify: `src/lib/openai.ts` (Zeilen 157–238)

- [ ] **Step 1: `KI_BEWERTUNG_PROMPT` ersetzen**

In `src/lib/openai.ts` den Block ab `const KI_BEWERTUNG_PROMPT = ` (Zeile 157) durch folgenden ersetzen:

```ts
const KI_BEWERTUNG_PROMPT = `Du bist ein Recruiting-Assistent. Bewerte das Kandidaten-Profil gegen die Vakanz anhand eines strukturierten Bewertungsrasters.

VAKANZ:
Titel: {vakanz_titel}
Erfahrungslevel: {vakanz_level}
Must-have Skills: {vakanz_skills}
Nice-to-have Skills: {vakanz_nice_have}
Beschreibung: {vakanz_beschreibung}

KANDIDAT:
Erfahrungslevel: {kandidat_level}
Skills: {kandidat_skills}
Profil: {kandidat_profil}

BEWERTUNGSRASTER (berechne jeden Wert explizit):

1. Must-have Skills [0-50 Punkte]
   - Teile 50 Punkte gleichmäßig auf alle geforderten Must-have-Skills auf
   - Für jeden vorhandenen Must-have-Skill: voller Anteil
   - Für verwandte/ähnliche Skills (z.B. Vue.js statt React): halber Anteil
   - Sind keine Must-have-Skills gefordert: 50 Punkte

2. Erfahrungslevel [0-20 Punkte]
   - Exakt passend: 20 Punkte
   - Eine Stufe zu niedrig (z.B. Mid statt Senior): 10 Punkte
   - Eine Stufe zu hoch (z.B. Expert statt Senior): 18 Punkte
   - Zwei oder mehr Stufen zu niedrig: 0 Punkte
   - Stufenreihenfolge: Junior < Mid < Senior < Expert

3. Nice-to-have Skills [0-15 Punkte]
   - Teile 15 Punkte gleichmäßig auf alle Nice-to-have-Skills auf
   - Für jeden vorhandenen Nice-to-have-Skill: voller Anteil
   - Sind keine Nice-to-have-Skills definiert: 15 Punkte

4. Gesamtfitness aus Beschreibung [0-15 Punkte]
   - Profil und Beschreibung passen inhaltlich gut zusammen: 15 Punkte
   - Teilweise passend: 8 Punkte
   - Kaum passend: 0 Punkte

Addiere alle vier Werte zu einem Gesamtscore (0-100).

EMPFEHLUNG (strikt nach Score, nicht frei interpretiert):
- Score >= 65 → "Empfohlen"
- Score >= 40 → "Bedingt geeignet"
- Score < 40  → "Nicht geeignet"

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, kein Text davor/danach):
{
  "score": <Gesamtscore als Ganzzahl 0-100>,
  "empfehlung": <"Empfohlen" | "Bedingt geeignet" | "Nicht geeignet">,
  "begruendung": <2-3 Sätze auf Deutsch, was gut passt und was fehlt>,
  "skill_vorhanden": [<Must-have Skills die der Kandidat hat>],
  "skill_fehlend": [<Must-have Skills die fehlen>]
}`
```

- [ ] **Step 2: Signatur von `bewerteProfilMitOpenAI` erweitern**

Den Funktionsparameter `vakanz` anpassen — `skills_nice_have` hinzufügen:

```ts
export async function bewerteProfilMitOpenAI(
  vakanz: {
    titel: string
    beschreibung: string
    skills: string[]
    skills_nice_have: string[]
    erfahrungslevel: string
  },
  profil: {
    kandidatenname: string
    skills: string[]
    erfahrungslevel: string
    profiltext: string
  }
): Promise<KiBewertungResult> {
```

- [ ] **Step 3: Template-Replacement in der Funktion anpassen**

Den `prompt`-Block in `bewerteProfilMitOpenAI` ersetzen (war Zeilen 193–200):

```ts
  const prompt = KI_BEWERTUNG_PROMPT
    .replace('{vakanz_titel}', vakanz.titel)
    .replace('{vakanz_level}', vakanz.erfahrungslevel)
    .replace('{vakanz_skills}', vakanz.skills.join(', ') || 'Keine spezifischen Skills gefordert')
    .replace('{vakanz_nice_have}', vakanz.skills_nice_have.join(', ') || 'Keine')
    .replace('{vakanz_beschreibung}', vakanz.beschreibung.slice(0, 800))
    .replace('{kandidat_level}', profil.erfahrungslevel)
    .replace('{kandidat_skills}', profil.skills.join(', ') || 'Keine Skills angegeben')
    .replace('{kandidat_profil}', profil.profiltext.slice(0, 1500))
```

- [ ] **Step 4: `max_tokens` erhöhen**

Im `chat.completions.create`-Aufruf `max_tokens: 500` → `max_tokens: 600` setzen.

- [ ] **Step 5: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartete Ausgabe: Fehler bei den beiden Routes, die `bewerteProfilMitOpenAI` aufrufen (fehlendes `skills_nice_have`) — das ist erwartet und wird in Task 3 und 4 behoben.

- [ ] **Step 6: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: structured scoring rubric for KI matching prompt"
```

---

## Task 3: `ki-match/route.ts` — Query + Aufruf + Tests

**Files:**
- Modify: `src/app/api/ressourcen/[id]/ki-match/route.ts`
- Modify: `src/app/api/ressourcen/[id]/ki-match/route.test.ts`

- [ ] **Step 1: Vakanz-Query um `skills_nice_have` erweitern**

In `src/app/api/ressourcen/[id]/ki-match/route.ts` Zeile 104 ändern:

```ts
// vorher
.select('id, titel, rolle, beschreibung, skills, erfahrungslevel')

// nachher
.select('id, titel, rolle, beschreibung, skills, skills_nice_have, erfahrungslevel')
```

- [ ] **Step 2: `bewerteProfilMitOpenAI`-Aufruf um `skills_nice_have` erweitern**

Den Aufruf ab Zeile 120 anpassen:

```ts
    result = await bewerteProfilMitOpenAI(
      {
        titel: vakanz.titel || vakanz.rolle,
        beschreibung: vakanz.beschreibung ?? '',
        skills: vakanz.skills ?? [],
        skills_nice_have: vakanz.skills_nice_have ?? [],
        erfahrungslevel: vakanz.erfahrungslevel,
      },
      {
        kandidatenname: ressource.name,
        skills: ressource.skills ?? [],
        erfahrungslevel: ressource.erfahrungslevel,
        profiltext: ressource.notizen ?? 'Keine Notizen vorhanden',
      }
    )
```

- [ ] **Step 3: Test-Fixture `mockVakanz` um `skills_nice_have` erweitern**

In `route.test.ts` Zeile 87 `mockVakanz` ergänzen:

```ts
const mockVakanz = {
  id: VAKANZ_ID, titel: 'Senior React Dev', rolle: 'Senior React Dev',
  beschreibung: 'React Entwickler gesucht', skills: ['React', 'TypeScript'],
  skills_nice_have: ['GraphQL', 'Docker'],
  erfahrungslevel: 'Senior',
}
```

- [ ] **Step 4: Test hinzufügen — `skills_nice_have` wird an OpenAI übergeben**

In `route.test.ts` im `describe('POST ...')` Block einen neuen Test ergänzen:

```ts
  it('passes skills_nice_have to bewerteProfilMitOpenAI', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    mockProfileSelect.mockResolvedValue({ data: managerProfile })
    mockRessourceSelect.mockResolvedValue({ data: mockRessource })
    mockVakanzSelect.mockResolvedValue({ data: mockVakanz })
    mockOllama.mockResolvedValue(mockKiResult)
    mockScoreUpsert.mockResolvedValue({ data: mockScore, error: null })
    await POST(makePostRequest({ vakanz_id: VAKANZ_ID }), { params })
    expect(mockOllama).toHaveBeenCalledWith(
      expect.objectContaining({ skills_nice_have: ['GraphQL', 'Docker'] }),
      expect.any(Object)
    )
  })
```

- [ ] **Step 5: Tests laufen lassen**

```bash
npx vitest run src/app/api/ressourcen
```

Erwartete Ausgabe: Alle Tests grün, inklusive dem neuen Test.

- [ ] **Step 6: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartete Ausgabe: Nur noch Fehler in `ki-bewertung/route.ts` (wird in Task 4 behoben).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/ressourcen/[id]/ki-match/route.ts src/app/api/ressourcen/[id]/ki-match/route.test.ts
git commit -m "feat: pass skills_nice_have to ki-match endpoint"
```

---

## Task 4: `ki-bewertung/route.ts` — Query + Aufruf anpassen

**Files:**
- Modify: `src/app/api/profile/[id]/ki-bewertung/route.ts`

- [ ] **Step 1: Vakanz-Join um `skills_nice_have` erweitern**

In `src/app/api/profile/[id]/ki-bewertung/route.ts` den Supabase-Join (Zeile 58) anpassen:

```ts
  const { data: profil, error: profilError } = await supabase
    .from('kandidaten_profile')
    .select(`
      id, kandidatenname, skills, erfahrungslevel, profiltext, agentur_id,
      vakanzen!inner(titel, beschreibung, skills, skills_nice_have, erfahrungslevel)
    `)
    .eq('id', id)
    .single()
```

- [ ] **Step 2: Vakanz-Typ-Cast um `skills_nice_have` erweitern**

Den Type-Cast für `vakanz` (Zeile 76) aktualisieren:

```ts
  const vakanz = profil.vakanzen as unknown as {
    titel: string
    beschreibung: string
    skills: string[]
    skills_nice_have: string[]
    erfahrungslevel: string
  }
```

- [ ] **Step 3: `bewerteProfilMitOpenAI`-Aufruf anpassen**

Den Aufruf (Zeile 86) um `skills_nice_have` ergänzen:

```ts
    result = await bewerteProfilMitOpenAI(
      {
        titel: vakanz.titel,
        beschreibung: vakanz.beschreibung ?? '',
        skills: Array.isArray(vakanz.skills) ? vakanz.skills : [],
        skills_nice_have: Array.isArray(vakanz.skills_nice_have) ? vakanz.skills_nice_have : [],
        erfahrungslevel: vakanz.erfahrungslevel ?? '',
      },
      {
        kandidatenname: profil.kandidatenname,
        skills: Array.isArray(profil.skills) ? profil.skills : [],
        erfahrungslevel: profil.erfahrungslevel ?? '',
        profiltext: profil.profiltext ?? '',
      }
    )
```

- [ ] **Step 4: TypeScript-Check — alle Fehler müssen weg sein**

```bash
npx tsc --noEmit
```

Erwartete Ausgabe: Keine Fehler.

- [ ] **Step 5: Alle Tests laufen lassen**

```bash
npx vitest run
```

Erwartete Ausgabe: Alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/profile/[id]/ki-bewertung/route.ts
git commit -m "feat: pass skills_nice_have to ki-bewertung endpoint"
```
