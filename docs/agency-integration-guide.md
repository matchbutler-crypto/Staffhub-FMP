# Staffhub – Integrationsleitfaden für Agenturen

**Version:** 1.0  
**Base-URL:** `https://api.staffhub.digital`

---

## Überblick

Die Staffhub-Integration ermöglicht zwei Datenflüsse:

| Richtung | Beschreibung |
|---|---|
| **Agentur → Staffhub** | Agentur liefert Profile und Einreichungen per Inbound-Webhook oder REST API |
| **Staffhub → Agentur** | Staffhub sendet Statusänderungen und neue Positionen per Outbound-Webhook |

---

## 1. Zugangsdaten

Ihr erhaltet von uns:

- **API-Key** — `sfhub_...` (einmalig, sicher aufbewahren)
- **Inbound-Webhook-URL** — `https://api.staffhub.digital/webhooks/agency/{agentur-id}`

Alle Requests an Staffhub müssen den API-Key im Header mitführen:

```
Authorization: Bearer sfhub_...
```

---

## 2. Was ihr liefern müsst (Agentur → Staffhub)

### Option A: Inbound-Webhook (empfohlen)

Ihr sendet einen `POST`-Request an eure Inbound-Webhook-URL, sobald sich in eurem System etwas ändert. Staffhub verarbeitet den Event automatisch.

**Header:**
```
POST https://api.staffhub.digital/webhooks/agency/{agentur-id}
Authorization: Bearer sfhub_...
Content-Type: application/json
```

#### Event: `profile.upserted` — Profil anlegen oder aktualisieren

Wird bei neuem Profil UND bei Aktualisierungen gesendet. Staffhub macht einen Upsert anhand von `externalRef`.

```json
{
  "event": "profile.upserted",
  "externalRef": "AG-123",
  "firstName": "Max",
  "lastName": "Muster",
  "skills": ["Python", "AWS", "PostgreSQL"],
  "seniority": "SENIOR",
  "availability": "AVAILABLE_NOW",
  "availableFrom": null,
  "workModel": "REMOTE",
  "location": "Berlin",
  "cvBase64": "<optional: base64-codiertes PDF, max 5 MB>"
}
```

**Pflichtfelder:** `externalRef`, `firstName`, `lastName`, `skills` (min. 1), `seniority`, `availability`

**Werte `seniority`:** `JUNIOR` · `MID` · `SENIOR` · `EXPERT`

**Werte `availability`:**
- `AVAILABLE_NOW` — sofort verfügbar
- `AVAILABLE_FROM` — verfügbar ab Datum (dann `availableFrom: "YYYY-MM-DD"` Pflicht)
- `UNAVAILABLE` — nicht verfügbar

**Werte `workModel`:** `REMOTE` · `HYBRID` · `ONSITE` · `ONSHORE` · `NEARSHORE` · `OFFSHORE`

---

#### Event: `profile.deactivated` — Profil deaktivieren

Profil wird in Staffhub als nicht verfügbar markiert und kann nicht mehr eingereicht werden.

```json
{
  "event": "profile.deactivated",
  "externalRef": "AG-123"
}
```

---

#### Event: `submission.created` — Profil auf Position einreichen

Reicht ein Profil (identifiziert per `externalRef`) auf eine offene Position ein. Die `positionId` erhaltet ihr aus dem Positions-Endpunkt (siehe Abschnitt 4).

```json
{
  "event": "submission.created",
  "externalRef": "AG-123",
  "positionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### Event: `submission.withdrawn` — Einreichung zurückziehen

```json
{
  "event": "submission.withdrawn",
  "externalRef": "AG-123",
  "positionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### Option B: REST API

Alternativ zum Webhook könnt ihr die REST API direkt aufrufen.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/agency/v1.0/profiles` | Profil anlegen / aktualisieren |
| `GET` | `/agency/v1.0/profiles` | Eigene Profile auflisten |
| `PUT` | `/agency/v1.0/profiles/{id}` | Profil aktualisieren |
| `POST` | `/agency/v1.0/profiles/{id}/submit` | Profil auf Position einreichen |
| `GET` | `/agency/v1.0/positions` | Offene Positionen abrufen |
| `GET` | `/agency/v1.0/positions/{id}` | Position-Details |
| `GET` | `/agency/v1.0/positions/{id}/submissions` | Eigene Einreichungen auf Position |

---

## 3. Was ihr empfangen müsst (Staffhub → Agentur)

Staffhub schickt Events an eure Webhook-URL, sobald sich relevante Dinge ändern. Ihr stellt uns dafür eine öffentlich erreichbare HTTPS-URL sowie ein Secret zur Verifikation bereit.

### Setup

Teilt uns mit:
- **Eure Webhook-URL** — z.B. `https://euer-system.de/webhooks/staffhub`
- **Ein selbst gewähltes Secret** — beliebiger String, min. 16 Zeichen (oder wir generieren eines für euch)

### Signatur-Verifikation

Jeder Request von Staffhub enthält den Header:
```
x-staffhub-signature: sha256=<hex>
```

Der Wert ist ein HMAC-SHA256 über den rohen Request-Body, signiert mit eurem Secret.

**Verifikation (Node.js):**
```javascript
import { createHmac } from 'crypto'

function isValid(rawBody, secret, signatureHeader) {
  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return expected === signatureHeader
}
```

**Verifikation (Python):**
```python
import hmac, hashlib

def is_valid(raw_body: bytes, secret: str, signature_header: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

### Events

#### `position.published` — Neue Position verfügbar

```json
{
  "event": "position.published",
  "position": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "Senior Backend Developer",
    "industry": "Fintech",
    "description": "...",
    "skills": ["Python", "AWS"],
    "skillsNiceToHave": ["Kubernetes"],
    "seniority": "SENIOR",
    "startDate": "2026-08-01",
    "endDate": "2026-12-31",
    "utilizationPct": 100,
    "workModel": "REMOTE",
    "location": null,
    "status": "OPEN",
    "publishedAt": "2026-06-29T10:00:00Z"
  }
}
```

---

#### `position.closed` — Position besetzt

```json
{
  "event": "position.closed",
  "positionId": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "FILLED"
}
```

---

#### `submission.status_changed` — Status einer Einreichung geändert

```json
{
  "event": "submission.status_changed",
  "positionId": "550e8400-e29b-41d4-a716-446655440000",
  "profileId": "661f9511-f30c-52e5-b827-557766551111",
  "externalRef": "AG-123",
  "status": "INTERVIEW",
  "updatedAt": "2026-06-29T14:30:00Z"
}
```

**Mögliche Status:**

| Status | Bedeutung |
|---|---|
| `SUBMITTED` | Profil eingereicht, wird geprüft |
| `INTERVIEW` | Interview wird geplant |
| `RESERVED` | Kandidat zugesagt |
| `BOOKED` | Kandidat beauftragt |
| `REJECTED` | Abgelehnt |
| `WITHDRAWN` | Zurückgezogen |

---

## 4. Datenflusskarte

```
AGENTUR                              STAFFHUB
  │                                     │
  │── profile.upserted ────────────────▶│  Profil anlegen / aktualisieren
  │── profile.deactivated ─────────────▶│  Profil deaktivieren
  │── submission.created ──────────────▶│  Kandidat auf Position einreichen
  │── submission.withdrawn ────────────▶│  Einreichung zurückziehen
  │                                     │
  │◀── position.published ──────────────│  Neue Position verfügbar
  │◀── position.closed ─────────────────│  Position besetzt
  │◀── submission.status_changed ───────│  Staffhub hat Status geändert
```

---

## 5. Fehlerbehandlung

**Inbound (eure Requests an Staffhub):**

| HTTP | Bedeutung |
|---|---|
| `200` | Erfolgreich verarbeitet |
| `400` | Pflichtfeld fehlt oder ungültiger Wert |
| `401` | API-Key fehlt oder ungültig |
| `403` | Keine Berechtigung (falscher API-Key für diese Agentur) |
| `404` | Profil oder Position nicht gefunden |
| `409` | Profil bereits auf diese Position eingereicht |
| `413` | CV-Datei größer als 5 MB |
| `500` | Interner Fehler auf Staffhub-Seite |

**Outbound (Requests von Staffhub an euch):**

- Antwortet mit `2xx` wenn der Event empfangen wurde
- Bei Fehler (Timeout, 5xx) loggen wir den Fehler — bitte sicherstellen dass euer Endpunkt zuverlässig erreichbar ist

---

## 6. Onboarding-Checkliste

- [ ] API-Key und Inbound-Webhook-URL von Staffhub erhalten
- [ ] Outbound-Webhook-URL und Secret an Staffhub übermitteln
- [ ] `profile.upserted` für alle aktiven Kandidaten initial senden (Erstbefüllung)
- [ ] Signatur-Verifikation für eingehende Events implementieren
- [ ] Test: Profil einreichen und `submission.status_changed` empfangen

---

*Bei Fragen: kontakt@staffhub.digital*
