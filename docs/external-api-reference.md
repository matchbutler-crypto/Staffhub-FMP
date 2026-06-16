# Staffhub External API — Referenz

**Base URL:** `https://<your-domain>/api/external/v1`  
**Auth:** Header `X-API-Key: <key>`

---

## Konfiguration

### Umgebungsvariablen (`.env.local`)

```env
EXTERNAL_API_KEY=staffhub-backoffice-dev-key-2026
SUPABASE_SERVICE_ROLE_KEY=<dein-supabase-service-role-key>
NEXT_PUBLIC_SUPABASE_URL=<deine-supabase-url>
```

> **Hinweis:** `EXTERNAL_API_KEY` vor Produktionseinsatz durch einen sicheren, zufälligen Key ersetzen (z.B. `openssl rand -hex 32`).

---

## Authentifizierung

Jeder Request muss den Header enthalten:

```
X-API-Key: staffhub-backoffice-dev-key-2026
```

Bei fehlendem oder falschem Key → `401 Unauthorized`

```json
{ "error": "Nicht autorisiert" }
```

---

## Endpunkte

### Vakanzen

#### `GET /vakanzen`
Liste aller Vakanzen.

```bash
curl https://<domain>/api/external/v1/vakanzen \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026"
```

**Response `200`:**
```json
{
  "vakanzen": [
    {
      "id": "uuid",
      "vakanz_nr": 42,
      "branche": "IT",
      "kunde": "ACME GmbH",
      "rolle": "Frontend Engineer",
      "status": "Offen",
      "published": true,
      "published_at": "2026-06-16T10:00:00Z",
      "startdatum": "2026-07-01",
      "enddatum": "2026-12-31",
      "fte_anzahl": 1,
      "arbeitsmodell": "Remote",
      "erfahrungslevel": "Senior",
      "created_at": "2026-06-16T09:00:00Z",
      "updated_at": "2026-06-16T09:00:00Z"
    }
  ]
}
```

---

#### `POST /vakanzen`
Neue Vakanz anlegen.

```bash
curl -X POST https://<domain>/api/external/v1/vakanzen \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "branche": "IT",
    "rolle": "Backend Engineer",
    "beschreibung": "Node.js Projekt für Fintech-Kunde",
    "skills": ["Node.js", "TypeScript", "PostgreSQL"],
    "skills_nice_have": ["Redis", "Kubernetes"],
    "erfahrungslevel": "Senior",
    "startdatum": "2026-08-01",
    "enddatum": "2026-12-31",
    "fte_anzahl": 1,
    "auslastung": 100,
    "arbeitsmodell": "Hybrid",
    "onsite_anteil": 40,
    "budget_intern": 850,
    "kunde": "Fintech GmbH",
    "standort": "Frankfurt",
    "ansprechpartner": "Max Muster",
    "teamgroesse": 5,
    "weitere_kommentare": "Deutsch erforderlich"
  }'
```

**Pflichtfelder:**
| Feld | Typ | Werte |
|------|-----|-------|
| `branche` | string | frei |
| `rolle` | string | frei |
| `beschreibung` | string | frei |
| `skills` | string[] | min. 1, max. 20 |
| `erfahrungslevel` | enum | `"Junior"` `"Mid"` `"Senior"` `"Expert"` |
| `startdatum` | string | `YYYY-MM-DD` |
| `enddatum` | string | `YYYY-MM-DD` |
| `fte_anzahl` | number | min. 0.1 |
| `arbeitsmodell` | enum | `"Remote"` `"Hybrid"` `"Onsite"` |
| `budget_intern` | number | EK-Tagesrate in € |

**Response `201`:**
```json
{
  "vakanz": {
    "id": "uuid",
    "vakanz_nr": 43,
    "rolle": "Backend Engineer",
    "status": "Offen",
    "created_at": "2026-06-16T10:00:00Z"
  }
}
```

---

#### `PATCH /vakanzen/:id`
Vakanz bearbeiten. Body: selbe Felder wie POST (alle Pflichtfelder müssen mitgeschickt werden).

```bash
curl -X PATCH https://<domain>/api/external/v1/vakanzen/uuid \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{ "rolle": "Senior Backend Engineer", "budget_intern": 900, ... }'
```

**Response `200`:**
```json
{
  "vakanz": {
    "id": "uuid",
    "vakanz_nr": 43,
    "rolle": "Senior Backend Engineer",
    "status": "Offen",
    "updated_at": "2026-06-16T11:00:00Z"
  }
}
```

---

#### `PATCH /vakanzen/:id/publish`
Vakanz veröffentlichen oder zurückziehen.

```bash
# Veröffentlichen
curl -X PATCH https://<domain>/api/external/v1/vakanzen/uuid/publish \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{ "published": true }'

# Zurückziehen
curl -X PATCH https://<domain>/api/external/v1/vakanzen/uuid/publish \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{ "published": false }'
```

**Response `200`:**
```json
{ "published": true }
```

**Fehler `422`** wenn Vakanz-Status `"Besetzt"`:
```json
{ "error": "Besetzte Vakanzen können nicht veröffentlicht werden" }
```

---

### Kandidaten

#### `GET /vakanzen/:id/kandidaten`
Alle vorgeschlagenen Kandidaten für eine Vakanz, inkl. Tagesrate und KI-Matching-Score.

```bash
curl https://<domain>/api/external/v1/vakanzen/uuid/kandidaten \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026"
```

**Response `200`:**
```json
{
  "kandidaten": [
    {
      "link_id": "uuid",
      "status": "Gespielt",
      "name": "Anna Beispiel",
      "agentur": "Agentur GmbH",
      "ek_tagesrate": 850,
      "matching_score": 87
    }
  ]
}
```

**Status-Werte:** `Gespielt` · `Interview geplant` · `Zugesagt` · `Beauftragt` · `Abgesagt` · `Abgelehnt` · `Zurückgezogen`

---

#### `PATCH /vakanzen/:id/kandidaten/:linkId`
Kandidaten annehmen oder ablehnen.

```bash
# Annehmen
curl -X PATCH https://<domain>/api/external/v1/vakanzen/uuid/kandidaten/link-uuid \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{ "status": "Zugesagt" }'

# Ablehnen
curl -X PATCH https://<domain>/api/external/v1/vakanzen/uuid/kandidaten/link-uuid \
  -H "X-API-Key: staffhub-backoffice-dev-key-2026" \
  -H "Content-Type: application/json" \
  -d '{ "status": "Abgelehnt" }'
```

**Erlaubte Werte:** `"Zugesagt"` (annehmen) oder `"Abgelehnt"` (ablehnen)

**Response `200`:**
```json
{
  "link": {
    "id": "link-uuid",
    "status": "Zugesagt",
    "updated_at": "2026-06-16T12:00:00Z"
  }
}
```

---

## Fehlercodes

| Status | Bedeutung |
|--------|-----------|
| `400` | Ungültiger Body oder fehlende Pflichtfelder |
| `401` | Key fehlt oder falsch |
| `404` | Vakanz oder Kandidaten-Link nicht gefunden |
| `422` | Logikfehler (z.B. besetzte Vakanz veröffentlichen) |
| `500` | Datenbankfehler |

Alle Fehler als: `{ "error": "Beschreibung" }`

---

## Lokale Entwicklung

```bash
# Dev-Server starten
npm run dev

# API-Key für lokale Entwicklung (aus .env.local)
KEY="staffhub-backoffice-dev-key-2026"
BASE="http://localhost:3000/api/external/v1"

# Test
curl -H "X-API-Key: $KEY" $BASE/vakanzen | jq '.vakanzen | length'
```
