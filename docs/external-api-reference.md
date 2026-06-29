# Staffhub External API — Referenz

**Base URL Demand:** `https://api.staffhub.digital/demand/v1.0`  
**Base URL Supply:** `https://api.staffhub.digital/supply/v1.0`  
**Auth:** Header `X-API-Key: <key>`

---

## Authentifizierung

API-Keys werden im Admin Panel unter „API Schlüssel" verwaltet. Jeder Key hat granulare Berechtigungen pro Endpunkt-Gruppe.

Jeder Request muss den Header enthalten:

```
X-API-Key: sfhub_<dein-key>
```

| Status | Bedeutung |
|--------|-----------|
| `401` | Key fehlt, ungültig oder deaktiviert |
| `403` | Key gültig, aber fehlende Berechtigung für diesen Endpunkt |

---

## Berechtigungen

| Permission | Endpunkte |
|---|---|
| `vakanzen:read` | GET /vakanzen, GET /vakanzen/{id} |
| `vakanzen:create` | POST /vakanzen |
| `vakanzen:update` | PATCH /vakanzen/{id}, PATCH /vakanzen/{id}/publish |
| `vorschlaege:read` | GET /vakanzen/{id}/vorschlaege |
| `vorschlaege:update` | PATCH /vakanzen/{id}/vorschlaege/{matchId} |
| `profile:read` | GET /profiles, GET /profiles/{id} |

---

## Demand API — `api.staffhub.digital/demand/v1.0`

### `GET /vakanzen`
Liste aller Vakanzen. Permission: `vakanzen:read`

```bash
curl https://api.staffhub.digital/demand/v1.0/vakanzen \
  -H "X-API-Key: sfhub_..."
```

Response `200`: `{ "vakanzen": [{ "id", "vakanz_nr", "branche", "kunde", "rolle", "status", "published", ... }] }`

---

### `POST /vakanzen`
Neue Vakanz anlegen. Permission: `vakanzen:create`

Pflichtfelder: `branche`, `rolle`, `beschreibung`, `skills` (min. 1), `erfahrungslevel` (Junior/Mid/Senior/Expert), `startdatum` (YYYY-MM-DD), `enddatum` (YYYY-MM-DD), `fte_anzahl` (min. 0.1), `arbeitsmodell` (Remote/Hybrid/Onsite), `budget_intern`

Response `201`: `{ "vakanz": { "id", "vakanz_nr", "rolle", "status", "created_at" } }`

---

### `GET /vakanzen/{id}`
Einzelne Vakanz. Permission: `vakanzen:read`

Response `200`: `{ "vakanz": { alle Felder } }`  
Response `404`: Vakanz nicht gefunden

---

### `PATCH /vakanzen/{id}`
Vakanz aktualisieren. Permission: `vakanzen:update`

Optionale Felder: `status` (Offen/Besetzt/Storniert), `beschreibung`, `budget_intern`, `skills`, `sourcing_erlaubt`

Response `200`: `{ "vakanz": { "id", "status", "updated_at", ... } }`

---

### `PATCH /vakanzen/{id}/publish`
Vakanz veröffentlichen/zurückziehen. Permission: `vakanzen:update`

Body: `{ "published": true | false }`  
Response `200`: `{ "published": true }`  
Response `422`: Besetzte Vakanz kann nicht veröffentlicht werden

---

### `GET /vakanzen/{id}/vorschlaege`
Vorgeschlagene Profile für eine Vakanz. Permission: `vorschlaege:read`

Response `200`: `{ "vorschlaege": [{ "match_id", "status", "name", "agentur", "ek_tagesrate", "matching_score" }] }`

Status-Werte: `Gespielt` · `Interview geplant` · `Zugesagt` · `Beauftragt` · `Abgesagt` · `Abgelehnt` · `Zurückgezogen`

---

### `PATCH /vakanzen/{id}/vorschlaege/{matchId}`
Entscheidung zum Vorschlag setzen. Permission: `vorschlaege:update`

Body: `{ "status": "Zugesagt" | "Abgelehnt" }`  
Response `200`: `{ "vorschlag": { "id", "status", "updated_at" } }`

---

## Supply API — `api.staffhub.digital/supply/v1.0`

### `GET /profiles`
Alle verfügbaren Entwickler. Permission: `profile:read`

```bash
curl https://api.staffhub.digital/supply/v1.0/profiles \
  -H "X-API-Key: sfhub_..."
```

Response `200`: `{ "profiles": [{ "id", "name", "skills", "erfahrungslevel", "verfuegbar_ab", "verfuegbarkeit", "arbeitsmodell" }] }`

`verfuegbarkeit`-Werte: `"Jetzt verfügbar"` · `"Verfügbar ab"` · `"Nicht verfügbar"`

---

### `GET /profiles/{id}`
Profil-Details. Permission: `profile:read`

Response `200`: `{ "profile": { alle Felder } }`  
Response `404`: Profil nicht gefunden

---

## Fehlercodes

| Status | Bedeutung |
|--------|-----------|
| `400` | Ungültiger Body oder fehlende Pflichtfelder |
| `401` | Key fehlt, ungültig oder deaktiviert |
| `403` | Key gültig, aber fehlende Berechtigung |
| `404` | Ressource nicht gefunden |
| `422` | Logikfehler (z.B. besetzte Vakanz veröffentlichen) |
| `500` | Datenbankfehler |

Alle Fehler: `{ "error": "Beschreibung" }`

---

---

## Agency API — `api.staffhub.digital/agency/v1.0`

Diese API ist für externe Personalvermittlungsagenturen. Der API-Key muss einer Agentur zugeordnet sein (`agentur_id`). Keys werden im Admin-Panel unter „Agenturen → API-Key erstellen" generiert.

**Berechtigungen für Agency-Keys:**

| Permission | Endpunkte |
|---|---|
| `agency:positions:read` | GET /positions, GET /positions/{id}, GET /positions/{id}/submissions |
| `agency:profiles:read` | GET /profiles, GET /positions/{id}/submissions |
| `agency:profiles:write` | POST /profiles, PUT /profiles/{id}, POST /profiles/{id}/submit |

---

### `GET /positions`
Alle aktuell veröffentlichten offenen Positionen. Permission: `agency:positions:read`

Query-Parameter: `limit` (max 200, default 50), `cursor` (Pagination)

```bash
curl https://api.staffhub.digital/agency/v1.0/positions \
  -H "X-API-Key: sfhub_..."
```

Response `200`:
```json
{
  "data": [{
    "id": "uuid",
    "role": "Senior Backend Developer",
    "industry": "Fintech",
    "description": "...",
    "skills": ["Python", "AWS"],
    "skillsNiceToHave": ["Kubernetes"],
    "seniority": "SENIOR",
    "startDate": "2026-07-01",
    "endDate": "2026-12-31",
    "utilizationPct": 100,
    "workModel": "REMOTE",
    "location": null,
    "status": "OPEN",
    "publishedAt": "2026-06-01T10:00:00Z"
  }],
  "nextCursor": "2026-05-30T..."
}
```

`status`-Werte: `OPEN` · `FILLED` · `CLOSED`  
`seniority`-Werte: `JUNIOR` · `MID` · `SENIOR` · `EXPERT`  
`workModel`-Werte: `REMOTE` · `HYBRID` · `ONSITE` · `ONSHORE` · `NEARSHORE` · `OFFSHORE`

---

### `GET /positions/{id}`
Einzelne Position. Permission: `agency:positions:read`

Response `200`: `{ "position": { ...alle Felder wie oben... } }`  
Response `404`: Position nicht gefunden oder nicht veröffentlicht

---

### `GET /positions/{id}/submissions`
Alle Einreichungen der eigenen Agentur auf diese Position. Permission: `agency:profiles:read`

Response `200`:
```json
{
  "data": [{
    "submissionId": "uuid",
    "profileId": "uuid",
    "externalRef": "AG-123",
    "firstName": "Max",
    "lastName": "Muster",
    "status": "SUBMITTED",
    "updatedAt": "2026-06-15T..."
  }]
}
```

`status`-Werte: `SUBMITTED` · `INTERVIEW` · `RESERVED` · `BOOKED` · `REJECTED` · `WITHDRAWN`

---

### `POST /profiles`
Profil anlegen oder aktualisieren (Upsert per `externalRef`). Permission: `agency:profiles:write`

```json
{
  "externalRef": "AG-123",
  "firstName": "Max",
  "lastName": "Muster",
  "skills": ["Python", "FastAPI", "PostgreSQL"],
  "seniority": "SENIOR",
  "availability": "AVAILABLE_NOW",
  "availableFrom": null,
  "workModel": "REMOTE",
  "location": "Berlin",
  "cvBase64": "<base64-encoded PDF, max 5 MB>"
}
```

Pflichtfelder: `externalRef`, `firstName`, `lastName`, `skills` (min. 1), `seniority`, `availability`  
`availability`-Werte: `AVAILABLE_NOW` · `AVAILABLE_FROM` · `UNAVAILABLE`  
Bei `AVAILABLE_FROM` muss `availableFrom` (ISO-Datum) gesetzt sein.

Response `201` (neu angelegt): `{ "profileId": "uuid", "externalRef": "AG-123", "created": true }`  
Response `200` (aktualisiert): `{ "profileId": "uuid", "externalRef": "AG-123", "created": false }`  
Response `413`: CV größer als 5 MB

---

### `GET /profiles`
Eigene Profile der Agentur. Permission: `agency:profiles:read`

Query-Parameter: `limit` (max 200, default 50), `cursor`

Response `200`:
```json
{
  "data": [{
    "profileId": "uuid",
    "externalRef": "AG-123",
    "name": "Max Muster",
    "skills": ["Python"],
    "seniority": "SENIOR",
    "availability": "AVAILABLE_NOW",
    "availableFrom": null,
    "workModel": "REMOTE",
    "location": "Berlin"
  }],
  "nextCursor": null
}
```

---

### `PUT /profiles/{id}`
Profil aktualisieren. Permission: `agency:profiles:write`

Alle Felder optional (nur geänderte Felder senden):
```json
{
  "firstName": "Max",
  "lastName": "Muster",
  "skills": ["Python", "Go"],
  "seniority": "EXPERT",
  "availability": "AVAILABLE_FROM",
  "availableFrom": "2026-08-01",
  "workModel": "HYBRID",
  "location": "München",
  "cvBase64": "<base64-encoded PDF>"
}
```

Response `200`: `{ "profileId": "uuid" }`  
Response `403`: Profil gehört nicht zur eigenen Agentur  
Response `404`: Profil nicht gefunden

---

### `POST /profiles/{id}/submit`
Profil auf eine Position einreichen. Permission: `agency:profiles:write`

```json
{ "positionId": "uuid" }
```

Response `201`: `{ "submissionId": "uuid" }`  
Response `400`: Position bereits besetzt/geschlossen oder Ressource deaktiviert  
Response `403`: Profil gehört nicht zur eigenen Agentur  
Response `404`: Profil oder Position nicht gefunden  
Response `409`: Profil bereits auf diese Position eingereicht

---

## Agency Webhooks (Outbound — Staffhub sendet an Agentur)

Staffhub sendet Events per `POST` an die konfigurierte Webhook-URL der Agentur. Jeder Request enthält den Header `x-staffhub-signature: sha256=<HMAC-SHA256>` zur Verifikation.

**HMAC-Verifikation (Node.js-Beispiel):**
```javascript
import { createHmac } from 'crypto'

function isValid(body, secret, signature) {
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  return expected === signature
}
```

### Events

**`position.published`** — Vakanz wurde veröffentlicht:
```json
{ "event": "position.published", "position": { ...alle Positionsfelder... } }
```

**`position.closed`** — Vakanz wurde besetzt:
```json
{ "event": "position.closed", "positionId": "uuid", "reason": "FILLED" }
```

**`submission.status_changed`** — Status einer Einreichung hat sich geändert:
```json
{
  "event": "submission.status_changed",
  "positionId": "uuid",
  "profileId": "uuid",
  "externalRef": "AG-123",
  "status": "RESERVED",
  "updatedAt": "2026-06-15T10:00:00Z"
}
```

`status`-Werte: `SUBMITTED` · `INTERVIEW` · `RESERVED` · `BOOKED` · `REJECTED` · `WITHDRAWN`

**Webhook-URL und Webhook-Secret** werden im Admin-Panel unter „Admin → Agenturen → Bearbeiten" konfiguriert.

---

## Lokale Entwicklung

```bash
npm run dev

KEY="sfhub_<dein-lokaler-key>"   # Im Admin Panel anlegen

curl -H "X-API-Key: $KEY" http://localhost:3000/demand/v1.0/vakanzen | jq '.vakanzen | length'
curl -H "X-API-Key: $KEY" http://localhost:3000/supply/v1.0/profiles | jq '.profiles | length'
```

---

## Vercel Custom Domain (einmaliger Setup-Schritt)

`api.staffhub.digital` im Vercel-Projekt als Custom Domain eintragen und DNS-CNAME auf `cname.vercel-dns.com` setzen. Kein separates Deployment nötig.
