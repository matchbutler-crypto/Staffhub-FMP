# Staffhub External API — Referenz

**Base URL:** `https://api.staffhub.digital/api/external/v1`  
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

```json
{ "error": "Nicht autorisiert" }
{ "error": "Fehlende Berechtigung" }
```

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

## Endpunkte

### Vakanzen

#### `GET /vakanzen`
Liste aller Vakanzen.

**Permission:** `vakanzen:read`

```bash
curl https://api.staffhub.digital/api/external/v1/vakanzen \
  -H "X-API-Key: sfhub_..."
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

**Permission:** `vakanzen:create`

```bash
curl -X POST https://api.staffhub.digital/api/external/v1/vakanzen \
  -H "X-API-Key: sfhub_..." \
  -H "Content-Type: application/json" \
  -d '{
    "branche": "IT",
    "rolle": "Backend Engineer",
    "beschreibung": "Node.js Projekt für Fintech-Kunde",
    "skills": ["Node.js", "TypeScript", "PostgreSQL"],
    "erfahrungslevel": "Senior",
    "startdatum": "2026-08-01",
    "enddatum": "2026-12-31",
    "fte_anzahl": 1,
    "arbeitsmodell": "Hybrid",
    "budget_intern": 850
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

#### `GET /vakanzen/{id}`
Einzelne Vakanz lesen.

**Permission:** `vakanzen:read`

```bash
curl https://api.staffhub.digital/api/external/v1/vakanzen/uuid \
  -H "X-API-Key: sfhub_..."
```

**Response `200`:**
```json
{
  "vakanz": {
    "id": "uuid",
    "vakanz_nr": 42,
    "branche": "IT",
    "kunde": "ACME GmbH",
    "rolle": "Frontend Engineer",
    "status": "Offen",
    "beschreibung": "...",
    "skills": ["React", "TypeScript"],
    "erfahrungslevel": "Senior",
    "startdatum": "2026-07-01",
    "enddatum": "2026-12-31",
    "fte_anzahl": 1,
    "arbeitsmodell": "Remote",
    "budget_intern": 850,
    "sourcing_erlaubt": true,
    "published": true,
    "created_at": "2026-06-16T09:00:00Z",
    "updated_at": "2026-06-16T09:00:00Z"
  }
}
```

---

#### `PATCH /vakanzen/{id}`
Vakanz aktualisieren.

**Permission:** `vakanzen:update`

```bash
curl -X PATCH https://api.staffhub.digital/api/external/v1/vakanzen/uuid \
  -H "X-API-Key: sfhub_..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Besetzt",
    "budget_intern": 900
  }'
```

**Aktualisierbare Felder (alle optional):**
| Feld | Typ | Werte |
|------|-----|-------|
| `status` | enum | `"Offen"` `"Besetzt"` `"Storniert"` |
| `beschreibung` | string | frei |
| `budget_intern` | number | EK-Tagesrate in € |
| `skills` | string[] | max. 20 |
| `sourcing_erlaubt` | boolean | |

**Response `200`:**
```json
{
  "vakanz": {
    "id": "uuid",
    "status": "Besetzt",
    "updated_at": "2026-06-16T11:00:00Z"
  }
}
```

---

#### `PATCH /vakanzen/{id}/publish`
Vakanz veröffentlichen oder zurückziehen.

**Permission:** `vakanzen:update`

```bash
curl -X PATCH https://api.staffhub.digital/api/external/v1/vakanzen/uuid/publish \
  -H "X-API-Key: sfhub_..." \
  -H "Content-Type: application/json" \
  -d '{ "published": true }'
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

### Vorschläge

#### `GET /vakanzen/{id}/vorschlaege`
Vorgeschlagene Profile für eine Vakanz lesen.

**Permission:** `vorschlaege:read`

```bash
curl https://api.staffhub.digital/api/external/v1/vakanzen/uuid/vorschlaege \
  -H "X-API-Key: sfhub_..."
```

**Response `200`:**
```json
{
  "vorschlaege": [
    {
      "match_id": "uuid",
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

#### `PATCH /vakanzen/{id}/vorschlaege/{matchId}`
Entscheidung zum vorgeschlagenen Profil setzen.

**Permission:** `vorschlaege:update`

```bash
# Annehmen
curl -X PATCH https://api.staffhub.digital/api/external/v1/vakanzen/uuid/vorschlaege/match-uuid \
  -H "X-API-Key: sfhub_..." \
  -H "Content-Type: application/json" \
  -d '{ "status": "Zugesagt" }'

# Ablehnen
curl -X PATCH https://api.staffhub.digital/api/external/v1/vakanzen/uuid/vorschlaege/match-uuid \
  -H "X-API-Key: sfhub_..." \
  -H "Content-Type: application/json" \
  -d '{ "status": "Abgelehnt" }'
```

**Erlaubte Werte:** `"Zugesagt"` · `"Abgelehnt"`

**Response `200`:**
```json
{
  "vorschlag": {
    "id": "match-uuid",
    "status": "Zugesagt",
    "updated_at": "2026-06-16T12:00:00Z"
  }
}
```

---

### Kandidaten (Legacy)

#### `GET /vakanzen/{id}/kandidaten`
Alias für `/vorschlaege` — bleibt aus Abwärtskompatibilität erhalten.

```bash
curl https://api.staffhub.digital/api/external/v1/vakanzen/uuid/kandidaten \
  -H "X-API-Key: sfhub_..."
```

**Permission:** `vorschlaege:read` — Response-Format analog zu `/vorschlaege`, Feld heißt `kandidaten`.

---

#### `PATCH /vakanzen/{id}/kandidaten/{linkId}`
Alias für `/vorschlaege/{matchId}` — bleibt aus Abwärtskompatibilität erhalten.

**Permission:** `vorschlaege:update`

---

### Profile

#### `GET /profiles`
Alle verfügbaren Profile/Entwickler abrufen.

**Permission:** `profile:read`

```bash
curl https://api.staffhub.digital/api/external/v1/profiles \
  -H "X-API-Key: sfhub_..."
```

**Response `200`:**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "name": "Max Mustermann",
      "skills": ["React", "TypeScript", "Node.js"],
      "erfahrungslevel": "Senior",
      "verfuegbar_ab": "2026-07-01",
      "verfuegbarkeit": "Verfügbar ab",
      "arbeitsmodell": "Remote"
    }
  ]
}
```

**`verfuegbarkeit`-Werte:** `"Jetzt verfügbar"` · `"Verfügbar ab"` · `"Nicht verfügbar"`  
(Deaktivierte Profile werden nicht zurückgegeben.)

---

#### `GET /profiles/{id}`
Profil-Details eines einzelnen Entwicklers.

**Permission:** `profile:read`

```bash
curl https://api.staffhub.digital/api/external/v1/profiles/uuid \
  -H "X-API-Key: sfhub_..."
```

**Response `200`:** Gleiche Felder wie in der Listansicht, für ein einzelnes Profil.

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

Alle Fehler als: `{ "error": "Beschreibung" }`

---

## Lokale Entwicklung

```bash
# Dev-Server starten
npm run dev

BASE="http://localhost:3000/api/external/v1"
KEY="sfhub_<dein-lokaler-key>"  # Im Admin Panel anlegen

# Vakanzen abrufen
curl -H "X-API-Key: $KEY" $BASE/vakanzen | jq '.vakanzen | length'

# Profile abrufen
curl -H "X-API-Key: $KEY" $BASE/profiles | jq '.profiles | length'
```
