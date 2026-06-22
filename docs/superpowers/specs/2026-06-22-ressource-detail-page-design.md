# Ressource-Detailseite `/ressourcen/[id]`

## Ziel

Dedizierte Detailseite für Ressourcen — analog zur Vakanz-Detailseite `/vakanzen/[id]` — ersetzt den bisherigen Sheet (Slide-in von rechts).

## Rollen & Zugang

| Rolle | Einstieg | RBAC |
|-------|----------|------|
| Admin | `/ressourcen` → Zeile anklicken | bestehend |
| Staffhub Manager | `/ressourcen` → Zeile anklicken | bestehend |
| Agentur | `/pool` → Zeile anklicken | `/ressourcen/` (Trailing-Slash, nur Sub-Paths) |

Agentur darf `/ressourcen/[id]` öffnen, aber NICHT die Liste `/ressourcen`.

## Layout

Gleiche Struktur wie `/vakanzen/[id]`:
- `SidebarProvider` + `AppSidebar` + `SidebarInset` + `SiteHeader`
- Sticky Header: Zurück-Button, Name, Badges (Verfügbarkeit, Level, Arbeitsmodell, Agentur), Skills-Chips
- EK-Tagesrate nur für Admin/Staffhub Manager sichtbar
- Bearbeiten-Button (nur Admin/Staffhub Manager) → navigiert zu `/ressourcen?edit=[id]`

## Tabs

1. **Stammdaten** — Vorname, Nachname, Titel, Namenszusatz, Firma, E-Mail, Telefon, Wohnort, Geburtsdatum, Geschlecht, Notizen
2. **Beauftragungen** — Tabelle der Beauftragungen (`GET /api/beauftragungen?ressource_id=[id]`)
3. **Gespielt** — Vakanz-Links mit Status (`GET /api/ressourcen/[id]/links`); Zeile anklicken navigiert zu Vakanz-Detail
4. **Historie** — Audit-Log (`GET /api/ressourcen/[id]/historie`)

## Navigationsänderungen

- `ressourcen/page.tsx`: Tabellenzeile → `router.push('/ressourcen/${id}')` statt Sheet
- `pool/page.tsx`: Tabellenzeile → `router.push('/ressourcen/${id}')` statt AgenturDetailSheet
- Sheet-Komponenten bleiben im Code erhalten (werden nur nicht mehr geöffnet)

## RBAC-Änderung

`src/lib/rbac.ts`:
- `isAllowedRoute()` unterstützt jetzt Trailing-Slash-Routen (nur Sub-Paths, nicht exakter Parent)
- Agentur bekommt `/ressourcen/` (mit Trailing-Slash) eingetragen
