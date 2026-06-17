# API-Verwaltung im Admin Panel — Design Spec

**Datum:** 2026-06-17  
**Status:** Genehmigt

---

## Ziel

Ablösung des einzelnen `EXTERNAL_API_KEY`-Umgebungsvariablen-Ansatzes durch eine datenbankbasierte API-Key-Verwaltung. Admins können im Admin Panel mehrere Keys anlegen, ihnen granulare Berechtigungen per Checkbox zuweisen, und Keys jederzeit deaktivieren oder löschen. Gleichzeitig wird der externe API-Endpunkt-Scope auf alle von Backoffice-Systemen benötigten Ressourcen erweitert.

---

## Berechtigungen

6 Berechtigungen, die pro Key individuell via Checkbox vergeben werden:

| Permission | Beschreibung | Betroffene Endpunkte |
|---|---|---|
| `vakanzen:read` | Vakanzen lesen | GET /vakanzen, GET /vakanzen/{id} |
| `vakanzen:create` | Vakanz erstellen | POST /vakanzen |
| `vakanzen:update` | Vakanz aktualisieren | PATCH /vakanzen/{id} |
| `vorschlaege:read` | Vorschläge lesen | GET /vakanzen/{id}/vorschlaege |
| `vorschlaege:update` | Vorschlag-Status setzen | PATCH /vakanzen/{id}/vorschlaege/{matchId} |
| `profile:read` | Profile/Entwickler lesen | GET /profiles, GET /profiles/{id} |

---

## Datenbank

Neue Supabase-Tabelle `external_api_keys`:

```sql
create table external_api_keys (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  key_hash     text        not null unique,
  permissions  text[]      not null default '{}',
  aktiv        boolean     not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
```

- `key_hash`: SHA-256 des generierten Keys (Klartext wird nie persistiert)
- `last_used_at`: wird bei jedem authentifizierten Request asynchron aktualisiert
- RLS: Tabelle ist nur über Service Role Client zugänglich

---

## Key-Format

Generiertes Format beim Anlegen: `sfhub_` + 32 zufällige Hex-Zeichen  
Beispiel: `sfhub_a3f8c2e1b7d94f0e2a5c8b1d3e6f9a2b`

Der Klartext-Key wird **einmalig** nach dem Anlegen im Admin Panel angezeigt (Copy-Button). Danach ist nur noch der Name und die letzten 8 Zeichen sichtbar (`sfhub_••••••••`). Dieser Flow ist nicht umkehrbar.

---

## Backend

### Auth-Logik (`/lib/external-api-auth.ts`)

Wird umgebaut von Env-Var-Vergleich zu DB-Lookup:

1. Key aus `x-api-key`-Header lesen
2. SHA-256 des Keys berechnen
3. `external_api_keys` nach `key_hash` abfragen (Service Role Client)
4. Prüfen: Eintrag vorhanden, `aktiv = true`
5. Prüfen: gefordertes Permission-Flag ist in `permissions`-Array
6. Bei Erfolg: `last_used_at` aktualisieren (fire-and-forget)
7. Rückgabe: `null` (OK) oder `NextResponse` mit 401/403

Signatur:
```ts
validateExternalApiKey(request: NextRequest, requiredPermission: string): Promise<NextResponse | null>
```

### Admin API-Routen (`/api/admin/api-keys/`)

| Methode | Pfad | Aktion |
|---|---|---|
| GET | /api/admin/api-keys | Alle Keys auflisten (ohne key_hash) |
| POST | /api/admin/api-keys | Key anlegen — gibt Klartext einmalig zurück |
| PATCH | /api/admin/api-keys/[id] | Key aktivieren/deaktivieren oder Berechtigungen ändern |
| DELETE | /api/admin/api-keys/[id] | Key löschen |

Alle Routen: nur für eingeloggte Admins (bestehender RBAC-Check via Session).

### Externe API-Routen (`/api/external/v1/`)

Alle Routen unter dieser Basis. Versionsstrategie: Major-Version im Pfad, Breaking Changes → `/v2/`.

**Neue und geänderte Routen:**

| Methode | Pfad | Permission | Anmerkung |
|---|---|---|---|
| GET | /vakanzen | vakanzen:read | Vorhanden — Permission-Check ergänzen |
| POST | /vakanzen | vakanzen:create | Vorhanden — Permission-Check ergänzen |
| GET | /vakanzen/{id} | vakanzen:read | Neu |
| PATCH | /vakanzen/{id} | vakanzen:update | Neu |
| GET | /vakanzen/{id}/vorschlaege | vorschlaege:read | Neu |
| PATCH | /vakanzen/{id}/vorschlaege/{matchId} | vorschlaege:update | Neu |
| GET | /profiles | profile:read | Neu |
| GET | /profiles/{id} | profile:read | Neu |

**Bestehende `/kandidaten`-Routen** bleiben unverändert erhalten (Abwärtskompatibilität).

#### PATCH /vakanzen/{id} — aktualisierbare Felder

```ts
{
  status?: 'Offen' | 'Besetzt' | 'Storniert',
  beschreibung?: string,
  budget_intern?: number,
  skills?: string[],
  sourcing_erlaubt?: boolean,
}
```

#### GET /profiles — verfügbare Entwickler

Gibt aktive Profile zurück (gefiltert nach `aktiv = true`). Felder: `id`, `name`, `skills`, `erfahrungslevel`, `verfuegbar_ab`, `arbeitsmodell`.

#### GET /vakanzen/{id}/vorschlaege

Gibt alle Match-Vorschläge für eine Vakanz zurück inkl. Profil-Kurzinfo und aktuellem Status.

#### PATCH /vakanzen/{id}/vorschlaege/{matchId}

Setzt die Entscheidung des externen Systems: `{ status: 'Interessiert' | 'Abgelehnt' | 'In Gespräch' }`.

---

## Admin UI

### Neuer Tab „API Schlüssel" in `/app/admin/page.tsx`

Dritter Tab neben „Benutzer" und „Agenturen". Gleiches visuelles Pattern (Tabelle + Sheet rechts).

**Tabelle:**

| Spalte | Inhalt |
|---|---|
| Name | Freitext-Name des Keys |
| Key | `sfhub_••••••••` (letzte 8 Zeichen sichtbar) |
| Berechtigungen | Badges pro vergebener Permission |
| Zuletzt genutzt | Datum oder „Noch nie" |
| Status | Badge „Aktiv" / „Inaktiv" |
| Aktionen | Dropdown: Bearbeiten, Deaktivieren, Löschen |

**„Neuen Key anlegen"-Sheet:**

1. Pflichtfeld: Name (Freitext, z.B. „Backoffice Sören")
2. 6 Checkboxen mit Label und Beschreibung
3. Button „Key generieren"
4. Nach Anlegen: Einmaliges Anzeige-Modal mit Copy-Button und Hinweis „Dieser Key wird nicht erneut angezeigt."

**Bearbeiten-Sheet:**

Erlaubt Änderung von Name und Berechtigungen. Key selbst ist nicht änderbar.

**Löschen:** AlertDialog mit Bestätigung (gleiches Pattern wie Benutzer/Agenturen).

---

## Sicherheitsüberlegungen

- Key-Hash wird mit Node.js `crypto.createHash('sha256')` berechnet — kein bcrypt nötig, da Keys ausreichend Entropie haben (32 Hex-Zeichen = 128 Bit)
- `last_used_at`-Update ist fire-and-forget (kein `await`), damit API-Latenz nicht erhöht wird
- Admin-API-Routen sind durch bestehenden Session-basierten RBAC geschützt
- Externe API-Routen bleiben session-frei (kein Supabase-Cookie-Overhead)
- Env-Variable `EXTERNAL_API_KEY` kann nach Migration entfernt werden

---

## Nicht im Scope

- Rate Limiting pro Key (kann später als eigene Phase ergänzt werden)
- Key-Rotation / Ablaufdatum
- Audit-Log für API-Zugriffe
- Webhook-Unterstützung
