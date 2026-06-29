# Inbound Agency Webhook — Design Spec

**Datum:** 2026-06-29  
**Status:** Approved

## Überblick

Agenturen können Daten aktiv per Webhook **in** Staffhub pushen, statt die REST API zu pollen. Staffhub stellt pro Agentur einen fixen Inbound-Webhook-Endpunkt bereit. Die Agentur authentifiziert sich mit ihrem bestehenden API-Key.

## Endpunkt

```
POST https://api.staffhub.digital/webhooks/agency/{agentur-id}
Authorization: Bearer sfhub_...
Content-Type: application/json
```

- Die URL ist deterministisch aus der Agentur-ID abgeleitet — kein DB-Eintrag nötig
- Auth via `validateAgencyKey(request, 'agency:profiles:write')` — identische Infrastruktur wie die REST Agency API
- `agency_webhook_secret` bleibt ausschließlich für **outbound** (Staffhub → Agentur, HMAC-SHA256)

## Events (Inbound)

### `profile.upserted`
Profil anlegen oder aktualisieren (upsert per `externalRef`).

```json
{
  "event": "profile.upserted",
  "externalRef": "AG-123",
  "firstName": "Max",
  "lastName": "Muster",
  "skills": ["Python", "AWS"],
  "seniority": "SENIOR",
  "availability": "AVAILABLE_NOW",
  "availableFrom": null,
  "workModel": "REMOTE",
  "location": "Berlin",
  "cvBase64": "<optional, base64 PDF, max 5 MB>"
}
```

Pflichtfelder: `externalRef`, `firstName`, `lastName`, `skills`, `seniority`, `availability`

Entspricht intern: `POST /agency/v1.0/profiles` (upsert-Logik wird wiederverwendet)

---

### `profile.deactivated`
Profil auf `verfuegbarkeit = Deaktiviert` setzen.

```json
{
  "event": "profile.deactivated",
  "externalRef": "AG-123"
}
```

Pflichtfeld: `externalRef`

---

### `submission.created`
Profil auf eine Position einreichen.

```json
{
  "event": "submission.created",
  "externalRef": "AG-123",
  "positionId": "uuid"
}
```

Pflichtfelder: `externalRef`, `positionId`

Entspricht intern: `POST /agency/v1.0/profiles/{id}/submit`

---

### `submission.withdrawn`
Einreichung zurückziehen (setzt Status auf `Zurückgezogen`).

```json
{
  "event": "submission.withdrawn",
  "externalRef": "AG-123",
  "positionId": "uuid"
}
```

Pflichtfelder: `externalRef`, `positionId`

## Fehlerbehandlung

| Situation | Response |
|---|---|
| Erfolg | `200 { received: true, event, processed: {...} }` |
| Unbekanntes Event | `200 { received: true, skipped: true }` — nie 4xx für unbekannte Events |
| Fehlende Pflichtfelder | `400 { error: "VALIDATION_ERROR", details: {...} }` |
| Profil gehört nicht zur Agentur | `403 { error: "FORBIDDEN" }` |
| Position nicht gefunden / geschlossen | `400 { error: "POSITION_CLOSED" / "NOT_FOUND" }` |
| Duplikat-Einreichung | `409 { error: "ALREADY_SUBMITTED" }` |
| API-Key ungültig | `401` |
| API-Key ohne `agency:profiles:write` | `403` |

## Admin UI

Im `NeuerApiKeySheet` — Übergabe-Info-Box wenn Agency-Layer aktiv:

```
INBOUND WEBHOOK
POST  https://api.staffhub.digital/webhooks/agency/{agentur-id}
Header: Authorization: Bearer <API-Key>
```

Die `agentur-id` wird zur Laufzeit aus dem gerade erstellten Key's `agentur_id` befüllt.

## Implementierung

### Neue Datei
`src/app/webhooks/agency/[id]/route.ts`

- Liest `event` aus dem Body
- Validiert via `validateAgencyKey` (Permission: `agency:profiles:write`)
- Prüft ob `agentur_id` des Keys mit `[id]` übereinstimmt (Ownership)
- Dispatcht auf Event-Handler (wiederverwendet Logik aus bestehenden Agency-REST-Routen)
- Gibt immer 200 für bekannte Events zurück

### Wiederverwendete Logik
- Upsert-Logik aus `POST /agency/v1.0/profiles`
- Submit-Logik aus `POST /agency/v1.0/profiles/{id}/submit`
- Status-Update für `submission.withdrawn` (analog zu `PATCH ressource-links/[id]/status`)

### Admin UI Änderungen
- `NeuerApiKeySheet`: Übergabe-Box um Inbound-Webhook-Sektion erweitern
- `agentur-id` aus dem API-Key-Response befüllen (`data.agentur_id`)

## Nicht in Scope
- Retry-Logik auf Agentur-Seite (liegt bei der Agentur)
- Webhook-Event-Log / Audit Trail (separates Feature)
- Rate-Limiting (bestehende Next.js-Defaults reichen für MVP)
