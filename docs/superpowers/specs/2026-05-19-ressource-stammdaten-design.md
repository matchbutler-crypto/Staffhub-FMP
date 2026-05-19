# Design: Ressource Stammdaten bei Beauftragt-Status

**Datum:** 2026-05-19  
**Status:** Approved

---

## Ziel

Wenn eine Pool-Ressource den Status "Beauftragt" erhält, sollen zusätzliche Personendaten (Stammdaten) für administrative Zwecke erfasst werden. Die Agentur sieht ein sichtbares To-Do in ihrer Pool-Ansicht und füllt die Daten über ein Modal aus.

---

## Betroffene Dateien

- **DB Migration** — 10 neue Spalten auf `ressourcen`
- `src/app/api/ressourcen/route.ts` — GET: neue Felder mitliefern; PATCH-Schema erweitern (existiert bereits als PUT/PATCH)
- `src/app/api/ressourcen/[id]/route.ts` — PATCH-Validierung um neue Felder erweitern
- `src/app/pool/page.tsx` — Banner, Badge, Modal

---

## Datenmodell

### Neue Spalten auf `ressourcen`

| Spalte | Typ | Pflicht |
|--------|-----|---------|
| `nachname` | text, nullable | ✓ |
| `vorname` | text, nullable | ✓ |
| `geburtsdatum` | date, nullable | ✓ |
| `geschlecht` | text, nullable | ✓ |
| `firma` | text, nullable | ✓ |
| `email_geschaeftlich` | text, nullable | ✓ |
| `telefon_geschaeftlich` | text, nullable | ✓ |
| `wohnort` | text, nullable | ✓ |
| `namenszusatz` | text, nullable | — |
| `titel` | text, nullable | — |

### Definition "Stammdaten ausstehend"

Eine Ressource gilt als **stammdaten_ausstehend** wenn:
1. Sie hat mindestens einen `ressource_vakanz_links`-Eintrag mit `status = 'Beauftragt'`
2. UND mindestens eines der 8 Pflichtfelder ist `null`

Diese Prüfung erfolgt **client-seitig** im Frontend auf Basis der bereits geladenen Daten — kein extra DB-Feld oder API-Endpunkt nötig.

---

## Backend / API

### GET `/api/ressourcen`

Die 10 neuen Spalten werden **immer** mitgeliefert wenn der Aufrufer die eigene Ressource sehen darf (Agentur: nur eigene Ressourcen via RLS). Manager sehen alle. Kein zusätzlicher Schutz nötig, da RLS die Datenzugriffsgrenze bereits setzt.

Die Stammdaten-Felder werden in den gleichen `canSeePrivate`-Block wie `ek_tagesrate` und `notizen` aufgenommen — also sichtbar für Manager und für die zugehörige Agentur.

### PATCH `/api/ressourcen/[id]`

Die bestehende PATCH-Route (oder PUT, je nach Implementierung) wird um die 10 neuen Felder in der Zod-Validierung erweitert. Alle optional/nullable. RLS schützt Schreibzugriff bereits (Agentur kann nur eigene Ressourcen bearbeiten, Manager alle).

```typescript
// Neue Felder im Zod-Schema:
nachname: z.string().nullable().optional(),
vorname: z.string().nullable().optional(),
geburtsdatum: z.string().date().nullable().optional(),
geschlecht: z.string().nullable().optional(),
firma: z.string().nullable().optional(),
email_geschaeftlich: z.string().email().nullable().optional(),
telefon_geschaeftlich: z.string().nullable().optional(),
wohnort: z.string().nullable().optional(),
namenszusatz: z.string().nullable().optional(),
titel: z.string().nullable().optional(),
```

---

## UI — Pool-Seite (`src/app/pool/page.tsx`)

### 1. Banner

Erscheint am oberen Rand der Pool-Seite wenn `stammdatenAusstehendCount > 0`:

```
⚠ 2 Ressourcen mit Status „Beauftragt" benötigen noch Stammdaten.
```

- Amber-Färbung (`bg-amber-50 border-amber-200 text-amber-800`)
- Kein Link/Button im Banner selbst — Badge auf der Karte führt zur Aktion
- Verschwindet automatisch wenn alle Ressourcen vollständig sind

### 2. Badge auf der Ressourcenkarte

Wenn `stammdaten_ausstehend === true`: kleines Amber-Badge `"Stammdaten ausstehend"` neben dem Verfügbarkeits-Status der Ressource. Dazu ein Button `"Erfassen"` der das Modal öffnet.

### 3. Stammdaten-Modal

Öffnet sich per `"Erfassen"`-Button. Felder:

- **Zeile 1:** Vorname, Nachname
- **Zeile 2:** Geburtsdatum, Geschlecht (Select: Männlich / Weiblich / Divers / Keine Angabe)
- **Zeile 3:** Namenszusatz (optional), Titel (optional)
- **Zeile 4:** Firma
- **Zeile 5:** E-Mail geschäftlich, Telefon geschäftlich
- **Zeile 6:** Wohnort

Speichert via PATCH `/api/ressourcen/[id]`. Nach Erfolg: Modal schließt, lokaler State wird aktualisiert (Badge verschwindet, Banner-Zähler sinkt).

---

## Randfälle

| Fall | Verhalten |
|------|-----------|
| Ressource hat mehrere Beauftragt-Links | Ein Badge reicht — Stammdaten gelten für die Ressource, nicht den Link |
| Stammdaten schon teilweise vorhanden | Modal ist pre-filled, nur fehlende Felder müssen ergänzt werden |
| Ressource verliert Beauftragt-Status | Badge und Banner verschwinden (kein Beauftragt-Link mehr) |
| Manager öffnet Pool einer Agentur (nicht implementiert) | Nicht in Scope |

---

## Nicht in Scope

- Dashboard-Widget für Stammdaten-Ausstehend-Zähler → **Roadmap**
- Notification-Glocke / Push-Benachrichtigung an Agentur → **Roadmap**
- Validierung ob E-Mail-Format korrekt (nur serverseitig via Zod)
- Historien-Eintrag wenn Stammdaten gespeichert werden
