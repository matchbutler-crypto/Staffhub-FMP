# External API Restructuring — Design Spec

**Datum:** 2026-06-17  
**Status:** Genehmigt

---

## Ziel

Ablösung der bisherigen `/api/external/v1/`-Routen durch eine saubere, subdomain-basierte Zwei-Layer-Struktur mit Major.Minor-Versionierung. Sören (Backoffice-Betreiber) erhält eine einheitliche Base-URL (`api.staffhub.digital`) und einen API-Key aus dem Admin Panel.

---

## Nicht im Scope

- **Sourcing-Anbieter-API** (Agenturen, die Profile einliefern) — eigener Spec, eigene Phase

---

## URL-Struktur

Das Subdomain `api.staffhub.digital` wird in Vercel als Custom Domain auf dasselbe Staffhub-Deployment konfiguriert. Pfade mappen direkt auf Next.js App-Router-Routen:

```
api.staffhub.digital/demand/v1.0/   →   src/app/demand/v1.0/
api.staffhub.digital/supply/v1.0/   →   src/app/supply/v1.0/
```

### Demand Layer — Vakanzen & Matching

| Methode | Pfad | Permission |
|---------|------|------------|
| GET | `/demand/v1.0/vakanzen` | `vakanzen:read` |
| POST | `/demand/v1.0/vakanzen` | `vakanzen:create` |
| GET | `/demand/v1.0/vakanzen/{id}` | `vakanzen:read` |
| PATCH | `/demand/v1.0/vakanzen/{id}` | `vakanzen:update` |
| PATCH | `/demand/v1.0/vakanzen/{id}/publish` | `vakanzen:update` |
| GET | `/demand/v1.0/vakanzen/{id}/vorschlaege` | `vorschlaege:read` |
| PATCH | `/demand/v1.0/vakanzen/{id}/vorschlaege/{matchId}` | `vorschlaege:update` |

### Supply Layer — Profile/Entwickler

| Methode | Pfad | Permission |
|---------|------|------------|
| GET | `/supply/v1.0/profiles` | `profile:read` |
| GET | `/supply/v1.0/profiles/{id}` | `profile:read` |

---

## Versionierungsstrategie

**Major.Minor im Pfad** — `v1.0`, `v1.1`, `v2.0` etc.

- **Minor-Erhöhung** (`v1.0` → `v1.1`): Neue Felder, neue optionale Parameter, neue Endpunkte — rückwärtskompatibel
- **Major-Erhöhung** (`v1.x` → `v2.0`): Breaking Changes — alte Major-Version bleibt parallel erreichbar bis zur Abkündigung

Demand und Supply werden unabhängig versioniert — eine Breaking Change in Vakanzen erzwingt kein neues Supply-Major.

---

## Dateistruktur

```
src/app/
  demand/
    v1.0/
      vakanzen/
        route.ts                          (GET list, POST create)
        [id]/
          route.ts                        (GET single, PATCH update)
          publish/
            route.ts                      (PATCH publish)
          vorschlaege/
            route.ts                      (GET list)
            [matchId]/
              route.ts                    (PATCH update status)
  supply/
    v1.0/
      profiles/
        route.ts                          (GET list)
        [id]/
          route.ts                        (GET single)
```

**Gelöschte Routen:**
```
src/app/api/external/v1/   ← komplett entfernen
```
inkl. Legacy `/kandidaten`-Routen — sauberer Schnitt, keine Abwärtskompatibilitäts-Shims.

---

## Auth & Permissions

Unverändert. Alle Routen rufen `validateExternalApiKey(request, permission)` aus `src/lib/external-api-auth.ts` auf. Das DB-basierte Multi-Key-System mit granularen Permissions bleibt bestehen.

---

## Middleware

`src/middleware.ts` wird um die neuen Pfade erweitert:

```ts
if (
  pathname.startsWith('/demand/') ||
  pathname.startsWith('/supply/')
) {
  return NextResponse.next({ request })
}
```

Die bisherige `/api/external/`-Ausnahme wird entfernt (da diese Routen gelöscht werden).

---

## Infrastruktur

### Vercel Custom Domain

`api.staffhub.digital` wird im Vercel-Projekt als Custom Domain eingetragen und per DNS-CNAME auf `cname.vercel-dns.com` gesetzt. Kein separates Deployment nötig — dieselbe Next.js-App bedient beide Domains.

### CORS (optional, vorerst nicht im Scope)

Da die API ausschließlich server-to-server genutzt wird (Sören's Backoffice → Staffhub), ist kein CORS-Setup erforderlich.

---

## Migration

1. Neue Routen unter `demand/v1.0/` und `supply/v1.0/` anlegen (identische Logik wie bisherige `external/v1/`)
2. Tests für alle neuen Routen schreiben
3. Alte `/api/external/v1/`-Routen und Tests löschen
4. `middleware.ts` anpassen
5. `docs/external-api-reference.md` auf neue URLs aktualisieren
6. Vercel Custom Domain konfigurieren (manueller Schritt)

---

## Sicherheitsüberlegungen

- API-Keys bleiben unverändert (SHA-256, DB-basiert, Admin Panel)
- Middleware schließt `/demand/` und `/supply/` vom Session-Cookie-Check aus
- Subdomain-Isolation: `api.staffhub.digital` kann in Vercel mit separaten Rate-Limit-Regeln belegt werden (spätere Phase)
