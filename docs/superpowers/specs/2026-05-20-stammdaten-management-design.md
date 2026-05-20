# Design: Ressource Stammdaten bei Beauftragt-Status

**Datum:** 2026-05-20  
**Status:** Approved  
**Feature:** Capture and manage personal data (Stammdaten) for assigned resources

---

## Ziel

Wenn eine Pool-Ressource den Status "Beauftragt" erhält, wird sie als "Stammdaten ausstehend" markiert. Die zugehörige Agentur sieht ein Banner und Badge auf der Pool-Seite und kann über ein Modal die erforderlichen Personendaten (Stammdaten) erfassen. Manager/Admin können Stammdaten aller Ressourcen bearbeiten.

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

Die 10 neuen Spalten werden **immer** mitgeliefert wenn der Aufrufer sie sehen darf:
- **Agentur-User**: Nur ihre eigenen Ressourcen (via RLS)
- **Manager/Admin**: Alle Ressourcen

Die Stammdaten-Felder werden in den gleichen `canSeePrivate`-Block wie `ek_tagesrate` und `notizen` aufgenommen.

### PATCH `/api/ressourcen/[id]`

Die bestehende PATCH-Route wird um die 10 neuen Felder in der Zod-Validierung erweitert. Alle optional/nullable.

**Authorization:**
- **Agentur**: Via RLS + zusätzliche Zod-Validierung → kann nur eigene Ressourcen updaten
- **Manager/Admin**: Keine RLS-Restriction → können alle Ressourcen updaten

```typescript
// Neue Felder im Zod-Schema:
nachname: z.string().min(1).max(200).nullable().optional(),
vorname: z.string().min(1).max(200).nullable().optional(),
geburtsdatum: z.string().date().nullable().optional(),
geschlecht: z.enum(['Männlich', 'Weiblich', 'Divers', 'Keine Angabe']).nullable().optional(),
firma: z.string().min(1).max(200).nullable().optional(),
email_geschaeftlich: z.string().email().nullable().optional(),
telefon_geschaeftlich: z.string().max(50).nullable().optional(),
wohnort: z.string().min(1).max(200).nullable().optional(),
namenszusatz: z.string().max(100).nullable().optional(),
titel: z.string().max(100).nullable().optional(),
```

---

## UI — Pool-Seite (`src/app/pool/page.tsx`)

### 1. Banner

Erscheint am oberen Rand der Pool-Seite wenn `stammdatenAusstehendCount > 0`:

```
⚠ 2 Ressourcen mit Status „Beauftragt" benötigen noch Stammdaten.
```

- Amber-Färbung (`border-amber-200 bg-amber-50 text-amber-800`)
- Keine Links/Buttons im Banner — Badge auf der Karte führt zur Aktion
- Verschwindet automatisch wenn alle Ressourcen vollständig sind

### 2. Badge auf der Ressourcenkarte

Wenn `stammdaten_ausstehend === true`: 
- Amber-Badge `"Stammdaten ausstehend"` neben dem Verfügbarkeits-Status
- Button `"Erfassen"` der das Modal öffnet

### 3. Stammdaten-Modal

Öffnet sich per `"Erfassen"`-Button. Zeigt den Namen der Ressource in der Beschreibung. Layout mit 2-Spalten Grid für kompakte Darstellung:

**Zeile 1:** Vorname, Nachname (required)  
**Zeile 2:** Geburtsdatum, Geschlecht Select (required)  
**Zeile 3:** Namenszusatz (optional), Titel (optional)  
**Zeile 4:** Firma (required, full-width)  
**Zeile 5:** E-Mail geschäftlich, Telefon geschäftlich (required)  
**Zeile 6:** Wohnort (required, full-width)  

**Validierung:**
- Alle Pflichtfelder müssen gefüllt sein → Toast error wenn nicht
- E-Mail-Format wird via Zod validiert (server-side)
- Alle Felder trimmed vor Submit

**Nach erfolgreichem Save:**
- Modal schließt
- Lokaler State wird aktualisiert
- Badge und Banner verschwinden
- Toast success

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| DB Migration | 10 neue Spalten auf `ressourcen` |
| `src/app/api/ressourcen/route.ts` | GET: neue Felder + `hat_beauftragt_link` |
| `src/app/api/ressourcen/[id]/route.ts` | PATCH: Schema + Zod validation erweitern |
| `src/app/pool/page.tsx` | Banner, Badge, Modal, State, Helpers |

---

## Randfälle

| Fall | Verhalten |
|------|-----------|
| Ressource hat mehrere Beauftragt-Links | Ein Badge reicht — Stammdaten gelten für die Ressource, nicht den Link |
| Stammdaten schon teilweise vorhanden | Modal ist pre-filled, nur fehlende Felder müssen ergänzt werden |
| Ressource verliert Beauftragt-Status | Badge und Banner verschwinden (kein Beauftragt-Link mehr) |
| Agentur versucht fremde Ressource zu updaten | Server returns 403 (RLS + Zod validation) |
| Manager/Admin editiert Stammdaten | Kein RLS-Block, kann alle updaten |

---

## Nicht in Scope

- Dashboard-Widget für Stammdaten-Ausstehend-Zähler → **Roadmap**
- Notification/Push an Agentur → **Roadmap**
- Historien-Eintrag wenn Stammdaten gespeichert werden → **Roadmap**
