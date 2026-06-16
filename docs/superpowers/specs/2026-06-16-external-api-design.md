# External API — Design-Dokument

**Datum:** 2026-06-16  
**Status:** Genehmigt  
**Scope:** REST-API für internes Backoffice-Tool

---

## Überblick

Staffhub erhält eine dedizierte externe REST-API unter `/api/external/v1/`, über die ein internes Backoffice-Tool Vakanzen verwalten und Kandidatenvorschläge einsehen und bearbeiten kann. Die API ist vollständig vom session-basierten internen API-Bereich getrennt und wird per globalem API-Key gesichert.

---

## Authentifizierung

### Mechanismus
- **Header:** `X-API-Key: <key>`
- **Key-Speicherung:** Umgebungsvariable `EXTERNAL_API_KEY` (serverseitig, nicht im Client exponiert)
- **Scope:** Ein globaler Key mit Admin-Rechten — kein Multi-Tenant

### Validierung
1. Die `middleware.ts` nimmt Pfade unter `/api/external/*` vom Supabase-Session-Check aus
2. Stattdessen ruft die Middleware `validateExternalApiKey(request)` auf
3. Jeder Route-Handler ruft denselben Helper nochmals auf (Defense-in-Depth)
4. Bei fehlendem oder falschem Key → `401 Unauthorized`

### Supabase-Client
Alle externen Routen nutzen einen neuen `createServiceRoleClient()`-Helper (`src/lib/supabase/service-role.ts`), der den `SUPABASE_SERVICE_ROLE_KEY` verwendet. Damit werden RLS-Policies umgangen und alle Daten sind ohne Benutzerkontext zugänglich.

---

## API-Endpunkte

Basis-URL: `/api/external/v1`

### Vakanzen

| Method | Pfad | Beschreibung |
|--------|------|--------------|
| `GET` | `/vakanzen` | Liste aller Vakanzen inkl. Status und `published`-Flag |
| `POST` | `/vakanzen` | Neue Vakanz anlegen (selbes Zod-Schema wie intern) |
| `PATCH` | `/vakanzen/[id]` | Vakanz-Felder bearbeiten |
| `PATCH` | `/vakanzen/[id]/publish` | Veröffentlichen/zurückziehen `{ published: boolean }` |

### Kandidaten

| Method | Pfad | Beschreibung |
|--------|------|--------------|
| `GET` | `/vakanzen/[id]/kandidaten` | Alle vorgeschlagenen Kandidaten für eine Vakanz |
| `PATCH` | `/vakanzen/[id]/kandidaten/[linkId]` | Status eines Kandidaten setzen |

#### GET `/vakanzen/[id]/kandidaten` — Response-Beispiel
```json
[
  {
    "link_id": "uuid",
    "status": "Vorgeschlagen",
    "name": "Max Mustermann",
    "agentur": "Agentur GmbH",
    "tagessatz": 850,
    "matching_score": 87
  }
]
```

#### PATCH `/vakanzen/[id]/kandidaten/[linkId]` — Request-Body
```json
{ "status": "Angenommen" }
```
Erlaubte Werte: `"Angenommen"`, `"Abgelehnt"`

---

## Datenfluss

```
Backoffice-Tool
  → X-API-Key Header
  → middleware.ts  (Session-Check überspringen, Key validieren)
  → Route Handler unter /api/external/v1/
  → validateExternalApiKey(req)  [Defense-in-Depth]
  → createServiceRoleClient()
  → Supabase (ohne RLS)
  → JSON-Antwort
```

---

## Fehlerbehandlung

Alle Fehler werden als `{ "error": "<Meldung>" }` mit passendem HTTP-Status zurückgegeben.

| Status | Wann |
|--------|------|
| `401` | Key fehlt oder ungültig |
| `400` | Ungültiger Request-Body (Zod-Fehler) |
| `404` | Vakanz oder Kandidaten-Link nicht gefunden |
| `422` | Logikfehler (z.B. besetzte Vakanz veröffentlichen) |
| `500` | Supabase-Datenbankfehler |

---

## Datenbankbezug

- **Vakanzen:** Tabelle `vakanzen_data` — selbe Felder wie interne API
- **Kandidaten:** Tabelle `ressource_vakanz_links` — `status`-Feld mit Werten `Vorgeschlagen`, `Angenommen`, `Abgelehnt`
- **Matching-Score:** Feld `ki_match_score` auf `ressource_vakanz_links` oder `ressourcen`

---

## Neue Dateien

```
src/lib/supabase/service-role.ts          — Service-Role-Client-Helper
src/lib/external-api-auth.ts              — validateExternalApiKey()-Helper
src/app/api/external/v1/vakanzen/
  route.ts                                — GET + POST
  [id]/route.ts                           — PATCH
  [id]/publish/route.ts                   — PATCH publish
  [id]/kandidaten/route.ts                — GET
  [id]/kandidaten/[linkId]/route.ts       — PATCH status
```

### Geänderte Dateien
```
src/middleware.ts                         — /api/external/* aus Session-Check ausschließen
.env.local / .env                         — EXTERNAL_API_KEY hinzufügen
```

---

## Nicht im Scope

- Rate-Limiting (internes Tool, ein Caller)
- Key-Rotation-UI (Key liegt fix in der Umgebungsvariable)
- Webhooks / Event-Notifications
- Beauftragungen über externe API anlegen
