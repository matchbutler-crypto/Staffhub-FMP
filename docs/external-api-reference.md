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
