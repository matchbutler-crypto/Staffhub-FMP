# MagentaOS ↔ StaffHub — Bidirektionale Integration (Partner-Spec v2)

**Datum:** 2026-06-23  
**Epic:** MagentaOS #991  
**Referenz:** staffhub-webhook.md (Partner-Spec v2, von MagentaOS vorgegeben)

---

## Ziel

Wenn eine Agentur in StaffHub ein Profil auf eine Vakanz spielt, wird dieses Profil sofort per Webhook an MagentaOS übertragen. MagentaOS kann daraufhin Kandidaten reservieren, buchen oder ablehnen — der Status wird bidirektional synchronisiert und in der StaffHub-Historie dokumentiert.

---

## Funktionsübersicht

| # | Funktion | Richtung | Mechanismus | Status |
|---|----------|----------|-------------|--------|
| 1 | Vakanz anlegen | MagentaOS → StaffHub | `POST /demand/v1.0/vakanzen` | ✅ vorhanden |
| 2 | Vakanz aktualisieren / schließen | MagentaOS → StaffHub | `PATCH /demand/v1.0/vakanzen/{vakanzId}` | ❌ neu |
| 3 | Trigger „Profil vorgeschlagen" | StaffHub → MagentaOS | Webhook `profile.proposed` | ❌ neu |
| 4 | Profile zur Vakanz abfragen | MagentaOS → StaffHub | `GET /supply/v1.0/profiles?vakanz={vakanzId}` | ❌ neu |
| 5 | Trigger „Profil-Status geändert" | StaffHub → MagentaOS | Webhook `profile.updated` | ❌ neu |
| 6 | Profil reservieren / Interview | MagentaOS → StaffHub | `POST /supply/v1.0/profiles/{profileId}/reserve` | ❌ neu |
| 7 | Profil buchen | MagentaOS → StaffHub | `POST /supply/v1.0/profiles/{profileId}/book` | ❌ neu |
| 8 | Profil ablehnen | MagentaOS → StaffHub | `POST /supply/v1.0/profiles/{profileId}/cancel` | ❌ neu |

---

## Architektur

### Eingehend (MagentaOS → StaffHub)

Authentifizierung via `external_api_keys` (bestehende Infrastruktur, `validateExternalApiKey`). Neue Scopes:

| Scope | Benötigt für |
|-------|-------------|
| `demand:write` | #2 |
| `supply:read` | #4 |
| `supply:write` | #6, #7, #8 |

Bestehende Scopes (`vakanzen:create`, `vakanzen:update`, `vorschlaege:read`, `vorschlaege:update`, `profile:read`) bleiben unverändert — vollständig rückwärtskompatibel.

### Ausgehend (StaffHub → MagentaOS)

HMAC-SHA256-signierte Webhooks an MagentaOS:

```
POST https://magenta-os.vercel.app/api/integrations/staffhub/webhook
Header: x-staffhub-signature: sha256=<HMAC-SHA256(rawBody, MAGENTA_WEBHOOK_SECRET) hex>
Header: Content-Type: application/json
```

Env-Variablen:
- `MAGENTA_WEBHOOK_URL` — Ziel-URL des MagentaOS-Webhooks
- `MAGENTA_WEBHOOK_SECRET` — Shared Secret für HMAC-Signatur

Wenn `MAGENTA_WEBHOOK_URL` nicht gesetzt → silent skip. HTTP-Fehler → `console.error`, kein Retry (MagentaOS retried bei 5xx selbst laut Spec). Fire-and-forget (kein `await`).

---

## Neue Dateien

```
src/lib/magenta-webhook.ts
src/app/supply/v1.0/profiles/route.ts
src/app/supply/v1.0/profiles/[id]/reserve/route.ts
src/app/supply/v1.0/profiles/[id]/book/route.ts
src/app/supply/v1.0/profiles/[id]/cancel/route.ts
src/app/demand/v1.0/vakanzen/[id]/route.ts
```

## Geänderte Dateien

```
src/lib/external-api-auth.ts                          ← neue Scopes
src/app/api/ressourcen/[id]/spielen/route.ts          ← Webhook beim Spielen
src/app/api/ressource-links/[id]/status/route.ts      ← Webhook bei Beauftragt
src/app/api/admin/api-keys/route.ts                   ← neue Scopes sichtbar
src/app/api/admin/api-keys/[id]/route.ts              ← neue Scopes sichtbar
```

---

## Detaildesign

### `src/lib/magenta-webhook.ts`

```ts
sendProfileProposed(vakanzId: string, ressource: RessourceSnapshot): Promise<void>
sendProfileUpdated(vakanzId: string, ressource: RessourceSnapshot, status: 'BOOKED' | 'UNAVAILABLE'): Promise<void>
```

**Payloads:**

`profile.proposed` — beim Spielen (Voll-Push, kein Follow-up-Pull nötig):
```json
{
  "event": "profile.proposed",
  "vakanzId": "<vakanzId>",
  "profile": {
    "id": "<ressourceId>",
    "firstName": "<vorname>",
    "lastName": "<nachname>",
    "email": "<email_geschaeftlich>",
    "phone": "<telefon_geschaeftlich>"
  }
}
```

`profile.updated` — wenn Beauftragt:
```json
{
  "event": "profile.updated",
  "vakanzId": "<vakanzId>",
  "profile": {
    "id": "<ressourceId>",
    "status": "BOOKED",
    "firstName": "<vorname>",
    "lastName": "<nachname>"
  }
}
```

---

### `GET /supply/v1.0/profiles?vakanz={vakanzId}` — Permission `supply:read`

Liefert alle `ressource_vakanz_links` der Vakanz inkl. Ressourcen-Daten.

**Status-Mapping:**

| StaffHub intern | Supply-Status |
|---|---|
| `Gespielt` | `AVAILABLE` |
| `Interview geplant` | `RESERVED` |
| `Zugesagt` | `RESERVED` |
| `Beauftragt` | `BOOKED` |
| `Abgelehnt`, `Abgesagt` | `UNAVAILABLE` |

Kontaktdaten (`email`, `phone`) nur bei `BOOKED` mitgeliefert.

**Antwort:**
```json
{
  "data": [
    {
      "id": "<ressourceId>",
      "firstName": "Anna",
      "lastName": "Beispiel",
      "email": null,
      "phone": null,
      "status": "AVAILABLE",
      "seniority": "Senior",
      "skills": ["Python"]
    }
  ]
}
```

---

### `POST /supply/v1.0/profiles/{profileId}/reserve` — Permission `supply:write`

Body: `{ "vakanzId": "<vakanzId>" }`

- Setzt Link-Status auf `Interview geplant`
- Schreibt `ressource_historie`: `Interview geplant (via MagentaOS)`, `typ: 'system'`, `erstellt_von: null`
- Antwort: `{ "id": "<profileId>", "status": "RESERVED" }`

---

### `POST /supply/v1.0/profiles/{profileId}/book` — Permission `supply:write`

Body: `{ "vakanzId": "<vakanzId>" }`

- Prüft: Wenn Link bereits `Beauftragt` → `409` (gesperrt)
- Setzt Link-Status auf `Beauftragt`
- Setzt Ressource-Verfügbarkeit auf Vakanz-Enddatum (identisch zur internen Logik)
- Schreibt `ressource_historie`: `Beauftragt (via MagentaOS)`, `typ: 'system'`, `erstellt_von: null`
- Feuert `sendProfileUpdated(..., 'BOOKED')` fire-and-forget
- Antwort: `{ "id": "<profileId>", "status": "BOOKED" }`

---

### `POST /supply/v1.0/profiles/{profileId}/cancel` — Permission `supply:write`

Body: `{ "vakanzId": "<vakanzId>" }`

- Prüft: Wenn Link `Beauftragt` → `409` (gesperrt, laut Spec nicht mehr änderbar)
- Setzt Link-Status auf `Abgelehnt`
- Schreibt `ressource_historie`: `Abgelehnt (via MagentaOS)`, `typ: 'system'`, `erstellt_von: null`
- Antwort: `{ "id": "<profileId>", "status": "UNAVAILABLE" }`

---

### `PATCH /demand/v1.0/vakanzen/{vakanzId}` — Permission `demand:write`

Gleicher Body wie `POST /demand/v1.0/vakanzen`, Teilmenge erlaubt.  
Schließen: `{ "status": "closed" }` → intern `Geschlossen`.  
Immer Update, nie Insert. Antwort: `200` mit Vakanz-Objekt.

---

### Änderungen an `spielen/route.ts`

Nach erfolgreichem Insert in `ressource_vakanz_links`:

```ts
// fire-and-forget — kein await, kein Fehler für den User
sendProfileProposed(vakanz_id, ressourceSnapshot).catch((e) => console.error('MagentaOS webhook failed:', e))
```

---

### Änderungen an `ressource-links/[id]/status/route.ts`

Nach Update auf `Beauftragt`:

```ts
// fire-and-forget
sendProfileUpdated(vakanzId, ressourceSnapshot, 'BOOKED').catch((e) => console.error('MagentaOS webhook failed:', e))
```

---

## Status-Lock-Regel

Sobald ein Link den Status `Beauftragt` hat, sind alle weiteren Status-Änderungen gesperrt — sowohl intern (bestehende Terminal-Status-Logik) als auch über die Supply-API (`/book`, `/cancel` geben `409` zurück).

---

## Historie-Einträge

| Auslöser | `ressource_historie`-Text | `typ` | `erstellt_von` |
|---|---|---|---|
| Spielen (intern) | bereits vorhanden | `system` | User-ID |
| `reserve` von MagentaOS | `Interview geplant (via MagentaOS)` | `system` | `null` |
| `book` von MagentaOS | `Beauftragt (via MagentaOS)` | `system` | `null` |
| `cancel` von MagentaOS | `Abgelehnt (via MagentaOS)` | `system` | `null` |
| Beauftragt intern → Webhook | bereits vorhanden | `system` | User-ID |

---

## Offene Punkte (vor Go-Live mit MagentaOS abstimmen)

1. `MAGENTA_WEBHOOK_URL` und `MAGENTA_WEBHOOK_SECRET` in Vercel-Env setzen
2. MagentaOS muss den StaffHub-API-Key mit Scopes `supply:read` + `supply:write` + `demand:write` erhalten
3. Name-Splitting: StaffHub speichert `name` als Vollname — `firstName`/`lastName` wird per einfachem Split (`name.split(' ', 2)`) aufgelöst. Zu bestätigen ob das für MagentaOS ausreicht.
