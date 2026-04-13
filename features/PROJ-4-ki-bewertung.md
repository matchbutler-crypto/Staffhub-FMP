# PROJ-4: KI-Bewertung via Ollama

**Status:** In Progress  
**Erstellt:** 2026-04-13  
**Priorität:** P0 (MVP)

---

## Beschreibung

Automatische KI-Bewertung von Kandidaten-Profilen gegen Vakanz-Anforderungen via lokaler Ollama-Instanz. Kein Cloud-AI, Kandidatendaten bleiben lokal.

---

## User Stories

1. Als Staffhub Manager möchte ich nach jedem Profil-Upload automatisch einen KI-Score sehen, damit ich schnell die Eignung einschätzen kann.
2. Als Staffhub Manager möchte ich die KI-Bewertung manuell neu starten können, wenn sich die Vakanz geändert hat.
3. Als Agentur möchte ich den KI-Score meines eingereichten Profils sehen, damit ich weiß, wie gut es passt.
4. Als Staffhub Manager möchte ich die vollständige KI-Analyse (Skill-Coverage, Begründung) aufklappen können.

---

## Acceptance Criteria

- [ ] AC-1: Nach Profil-Upload wird KI-Bewertung automatisch getriggert (async, non-blocking)
- [ ] AC-2: KI gibt Match-Score (0–100), Empfehlung, Begründung und Skill-Coverage zurück
- [ ] AC-3: Score und Empfehlung werden als Badge in der Profilliste angezeigt
- [ ] AC-4: Vollständige KI-Analyse im Profil-Detail aufklappbar (Accordion)
- [ ] AC-5: Manager kann KI-Bewertung manuell re-triggern (Button im Profil-Detail)
- [ ] AC-6: Score-Historie: jede Bewertung wird gespeichert (Zeitstempel + Modell)
- [ ] AC-7: Agentur kann KI-Score für eigene Profile sehen

---

## Tech Design

### Neue Tabelle: `ki_bewertungen`

```sql
id, profil_id (FK), score (0-100), empfehlung (Enum), begruendung (TEXT),
skill_coverage (JSONB: {vorhanden: [], fehlend: []}), model (TEXT), created_at
```

### API-Routen

- `POST /api/profile/[id]/ki-bewertung` — Triggert Ollama-Auswertung, speichert in DB, gibt Ergebnis zurück
- `GET /api/profile/[id]/ki-bewertung` — Gibt die letzte Bewertung zurück

### Ollama-Integration

- URL: `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- Modell: `OLLAMA_MODEL` (default: `llama3.2`)
- Format: JSON-Output via structured prompt
- Timeout: 60s (Ollama kann langsam sein)
- Fallback: Bei Ollama nicht erreichbar → Fehler zurückgeben (kein Crash)

### Auto-Trigger

- Nach POST /api/profile: Fire-and-forget (nicht awaited) → Profilanlage bleibt schnell
- Agentur sieht Score sobald Ollama fertig ist (beim nächsten Seitenaufruf)

### Dependencies

- Keine neuen npm-Pakete (native fetch)
- Neue Env-Vars: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

---

## Dependencies

- Requires: PROJ-3 (Profil-Einreichung) — Profile und Vakanzen müssen existieren
