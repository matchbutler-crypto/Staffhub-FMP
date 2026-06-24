# Agency API v1.0 — Design Spec

**Datum:** 2026-06-24  
**Namespace:** `agency/v1.0/`  
**Ziel:** REST API für externe Agentur-Plattformen — Positionen abrufen, Profile einreichen, Status-Benachrichtigungen empfangen.

---

## 1. Auth & DB-Erweiterungen

### Migration `015_agency_api.sql`

```sql
ALTER TABLE external_api_keys
  ADD COLUMN IF NOT EXISTS agentur_id UUID REFERENCES agenturen(id);

ALTER TABLE agenturen
  ADD COLUMN IF NOT EXISTS agency_webhook_url    TEXT,
  ADD COLUMN IF NOT EXISTS agency_webhook_secret TEXT;
```

Jeder API-Key ist auf genau eine `agentur_id` gescoped. Agentur-übergreifende Abfragen sind nicht möglich.

### Neue Permissions (`src/lib/external-api-auth.ts`)

```ts
| 'agency:positions:read'
| 'agency:profiles:write'
| 'agency:profiles:read'
```

Neue Hilfsfunktion `getAgencyIdFromKey(request): Promise<string | null>` — liest `agentur_id` aus dem validierten Key-Datensatz.

---

## 2. Endpoints

Alle Routen unter `src/app/agency/v1.0/`.  
Auth: `Bearer <api-key>` oder `x-api-key` Header (bestehende `validateExternalApiKey`).

### 2.1 Positions

#### `GET /agency/v1.0/positions`

Permission: `agency:positions:read`

Gibt alle `published=true` Vakanzen zurück. Besetzt-Vakanzen werden nach 3 Tagen ausgeblendet (analog zu Agentur-View intern).  
Keine internen Felder: kein `budget_intern`, `slack_ts`, `weitere_kommentare`.

Query-Parameter:
- `?limit=50` (default 50, max 200)
- `?cursor=<ISO-timestamp>` — Paginierung via `created_at`

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "role": "Senior Java Developer",
      "industry": "Finance",
      "description": "...",
      "skills": ["Java", "Spring Boot"],
      "skillsNiceToHave": ["Kubernetes"],
      "seniority": "SENIOR",
      "startDate": "2026-08-01",
      "endDate": "2026-12-31",
      "utilizationPct": 100,
      "workModel": "HYBRID",
      "location": "München",
      "status": "OPEN",
      "publishedAt": "2026-06-20T10:00:00Z"
    }
  ],
  "nextCursor": "2026-06-19T08:00:00Z"
}
```

Status-Mapping intern → API: `Offen` → `OPEN`, `Besetzt` → `FILLED`, `Geschlossen` → `CLOSED`.

#### `GET /agency/v1.0/positions/{id}`

Permission: `agency:positions:read`

Volldetail einer einzelnen Vakanz. Gleiche Feldauswahl wie oben.  
404 wenn nicht gefunden oder `published=false`.

### 2.2 Profiles

#### `POST /agency/v1.0/profiles`

Permission: `agency:profiles:write`

Legt eine neue Ressource im Pool der Agentur an. Upsert via `externalRef` — wenn bereits eine Ressource mit diesem `externalRef` + `agentur_id` existiert, wird sie aktualisiert.

Request Body:
```json
{
  "externalRef": "agentur-interne-id",
  "firstName": "Max",
  "lastName": "Mustermann",
  "skills": ["React", "TypeScript"],
  "seniority": "SENIOR",
  "availability": "AVAILABLE_NOW",
  "availableFrom": null,
  "workModel": "REMOTE",
  "location": "Berlin",
  "cvBase64": "base64-encoded-pdf-optional"
}
```

Max. Größe `cvBase64`: 5 MB (base64-encoded). Server gibt `413` wenn überschritten.

```
```

`availability` Werte: `AVAILABLE_NOW` | `AVAILABLE_FROM` | `UNAVAILABLE`  
`seniority` Werte: `JUNIOR` | `MID` | `SENIOR` | `EXPERT`

Response `201 Created`:
```json
{
  "profileId": "uuid",
  "externalRef": "agentur-interne-id",
  "created": true
}
```

Bei Upsert: `"created": false`.

#### `PUT /agency/v1.0/profiles/{id}`

Permission: `agency:profiles:write`

Aktualisiert eine bestehende Ressource. `{id}` = interne Ressourcen-UUID (aus POST-Response).  
Nur Felder der eigenen Agentur änderbar — 403 wenn `agentur_id` nicht übereinstimmt.

Partial update: alle Felder optional.

#### `GET /agency/v1.0/profiles`

Permission: `agency:profiles:read`

Listet alle Ressourcen der eigenen Agentur. Query: `?limit=50&cursor=<created_at>`.

### 2.3 Submit

#### `POST /agency/v1.0/profiles/{id}/submit`

Permission: `agency:profiles:write`

Spielt eine Ressource auf eine Vakanz (analog zur internen `spielen`-Route).  
Prüft: Ressource gehört zur Agentur, Vakanz ist `published=true` und `status=Offen`, Ressource nicht bereits auf dieser Vakanz gespielt.

Request Body:
```json
{ "positionId": "uuid" }
```

Response `201 Created`:
```json
{ "submissionId": "uuid" }
```

`submissionId` = ID des `ressource_vakanz_links`-Eintrags.

### 2.4 Polling Fallback

#### `GET /agency/v1.0/positions/{id}/submissions`

Permission: `agency:profiles:read`

Alle Einreichungen der eigenen Agentur für diese Vakanz inkl. aktuellem Status.

Response:
```json
{
  "data": [
    {
      "submissionId": "uuid",
      "profileId": "uuid",
      "externalRef": "agentur-interne-id",
      "firstName": "Max",
      "lastName": "Mustermann",
      "status": "INTERVIEW",
      "updatedAt": "2026-06-22T14:00:00Z"
    }
  ]
}
```

---

## 3. Status-Mapping

| Intern (DB) | API |
|-------------|-----|
| Gespielt | `SUBMITTED` |
| Interview geplant | `INTERVIEW` |
| Zugesagt | `RESERVED` |
| Beauftragt | `BOOKED` |
| Abgelehnt | `REJECTED` |
| Abgesagt | `WITHDRAWN` |
| Zurückgezogen | `WITHDRAWN` |

---

## 4. Webhooks (Push)

Webhook-URL + Secret pro Agentur in `agenturen.agency_webhook_url` / `agenturen.agency_webhook_secret`.  
Signatur: `x-staffhub-signature: sha256=<hmac-sha256>` — identisch zu Magenta-Webhook.

Implementierung: `src/lib/agency-webhook.ts` (analog zu `src/lib/magenta-webhook.ts`).

### Events

#### `position.published`
Trigger: Vakanz wird auf `published=true` gesetzt.  
Geht an **alle** Agenturen mit gesetzter `agency_webhook_url`.

```json
{
  "event": "position.published",
  "position": { "id", "role", "startDate", "endDate", "seniority", "skills", "workModel", "location" }
}
```

#### `position.updated`
Trigger: Felder einer veröffentlichten Vakanz ändern sich (Skills, Datum, Arbeitsmodell etc.).  
Geht an **alle** Agenturen.

```json
{
  "event": "position.updated",
  "position": { "id", "role", "startDate", "endDate", "seniority", "skills", "workModel", "location" }
}
```

#### `position.closed`
Trigger: Vakanz-Status wechselt zu `Besetzt` oder `Geschlossen`.  
Geht an **alle** Agenturen.

```json
{
  "event": "position.closed",
  "positionId": "uuid",
  "reason": "FILLED"
}
```

`reason`: `FILLED` | `CANCELLED`

#### `submission.status_changed`
Trigger: `ressource_vakanz_links.status` ändert sich.  
Geht **nur an die Agentur der Ressource** (`ressourcen.agentur_id`).

```json
{
  "event": "submission.status_changed",
  "positionId": "uuid",
  "profileId": "uuid",
  "externalRef": "agentur-interne-id",
  "status": "BOOKED",
  "updatedAt": "2026-06-24T09:00:00Z"
}
```

### Trigger-Punkte im Code

| Code-Stelle | Webhook |
|-------------|---------|
| `demand/v1.0/vakanzen/[id]/publish/route.ts` | `position.published` |
| `api/vakanzen/[id]` PATCH/PUT (intern, wenn `published=true` + Felder geändert) | `position.updated` |
| Status-Update auf Vakanz → Besetzt/Geschlossen | `position.closed` |
| `api/ressource-links/[id]/status/route.ts` | `submission.status_changed` |
| `agency/v1.0/profiles/[id]/submit` | `submission.status_changed` (initial: SUBMITTED) |

---

## 5. Dateistruktur

```
src/
  app/
    agency/
      v1.0/
        positions/
          route.ts              # GET /agency/v1.0/positions
          [id]/
            route.ts            # GET /agency/v1.0/positions/{id}
            submissions/
              route.ts          # GET /agency/v1.0/positions/{id}/submissions
        profiles/
          route.ts              # POST + GET /agency/v1.0/profiles
          [id]/
            route.ts            # PUT /agency/v1.0/profiles/{id}
            submit/
              route.ts          # POST /agency/v1.0/profiles/{id}/submit
  lib/
    agency-webhook.ts           # sendPositionPublished, sendPositionUpdated, sendPositionClosed, sendSubmissionStatusChanged
migrations/
  015_agency_api.sql
```

---

## 6. Nicht im Scope

- CV-Upload via URL (nur Base64 im POST-Body, analog zu bestehender CV-Route)
- Agentur-Self-Service für Webhook-URL (Admin setzt das manuell in DB)
- Rate Limiting (existiert noch nicht systemweit)
- Pagination via keyset ist ausreichend, kein GraphQL/Cursor-basiertes Relay
