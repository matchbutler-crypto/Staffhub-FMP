# PROJ-1: Auth & Rollenverwaltung

## Status: Planned
**Created:** 2026-04-12
**Last Updated:** 2026-04-12

## Dependencies
- None (Basis-Feature, alle anderen Features setzen PROJ-1 voraus)

---

## Übersicht

Login-System via Supabase Auth (Email/Passwort). Kein Self-Signup — Accounts werden ausschließlich vom Admin angelegt. Drei Rollen: Admin, Staffhub Manager, Agentur. Alle Routen außer `/login` sind geschützt. Rollenbasierter Zugriff via Next.js Middleware.

---

## User Stories

- Als **Admin** möchte ich mich mit E-Mail und Passwort einloggen, damit ich Zugang zur Plattform habe.
- Als **Admin** möchte ich, dass Nicht-eingeloggte automatisch zu `/login` weitergeleitet werden, damit unbefugter Zugriff verhindert wird.
- Als **Admin** möchte ich nach dem Login direkt auf `/dashboard` landen, damit ich sofort einen Überblick habe.
- Als **Staffhub Manager** möchte ich mich einloggen und auf alle Manager-Bereiche zugreifen können (Dashboard, Vakanzen, Profile, Agenturen, Abrechnung).
- Als **Agentur** möchte ich mich einloggen und auf meine erlaubten Bereiche zugreifen (Dashboard, Vakanzen, Meine Profile).
- Als **Agentur** möchte ich eine verständliche Fehlermeldung sehen, wenn ich versuche eine Seite aufzurufen, für die ich keine Berechtigung habe.
- Als **eingeloggter User** möchte ich mich ausloggen können, damit meine Session beendet wird.
- Als **eingeloggter User** möchte ich in der Sidebar meinen Namen und meine Rolle sehen, damit ich weiß, mit welchem Account ich eingeloggt bin.

---

## Acceptance Criteria

### Login
- [ ] `/login` zeigt ein Formular mit E-Mail und Passwort
- [ ] Falsche Credentials zeigen eine verständliche Fehlermeldung ("E-Mail oder Passwort falsch")
- [ ] Leere Felder werden clientseitig validiert (required)
- [ ] Nach erfolgreichem Login wird der User zu `/dashboard` weitergeleitet
- [ ] Ein bereits eingeloggter User, der `/login` aufruft, wird direkt zu `/dashboard` weitergeleitet

### Routenschutz
- [ ] Alle Routen außer `/login` sind ohne aktive Session nicht erreichbar
- [ ] Nicht eingeloggte User werden zu `/login` weitergeleitet (mit `?redirectTo=<ursprüngliche URL>`)
- [ ] Nach Login wird der User zur `redirectTo`-URL geleitet (falls vorhanden), sonst zu `/dashboard`

### Rollenbasierter Zugriff (RBAC)
- [ ] **Admin**: Zugriff auf alle Routen (`/dashboard`, `/vakanzen`, `/profile`, `/agenturen`, `/abrechnung`, `/admin`, `/meine-profile`)
- [ ] **Staffhub Manager**: Zugriff auf `/dashboard`, `/vakanzen`, `/profile`, `/agenturen`, `/abrechnung` — kein Zugriff auf `/admin`, `/meine-profile`
- [ ] **Agentur**: Zugriff auf `/dashboard`, `/vakanzen`, `/meine-profile` — kein Zugriff auf `/profile`, `/agenturen`, `/abrechnung`, `/admin`
- [ ] Zugriff auf eine nicht erlaubte Route → Redirect zu `/dashboard` + Toast-Fehlermeldung "Keine Berechtigung für diesen Bereich"

### Profil-Anlage
- [ ] Beim ersten Login wird automatisch ein Eintrag in der `profiles`-Tabelle erstellt (falls noch nicht vorhanden), mit `id = auth.uid()`
- [ ] Die Rolle und Agentur-Zuordnung werden vom Admin vorab in `profiles` hinterlegt (nicht beim Login gesetzt)

### Sidebar & Navigation
- [ ] `nav-user.tsx` zeigt den Namen und die Rolle des eingeloggten Users
- [ ] Die Sidebar zeigt nur die für die Rolle erlaubten Nav-Einträge
- [ ] Logout-Button in der Sidebar beendet die Supabase-Session und leitet zu `/login` weiter

### Session-Persistenz
- [ ] Session bleibt nach Browser-Neustart bestehen (Supabase persistiert Session in localStorage)
- [ ] Abgelaufene Session → automatischer Redirect zu `/login`

---

## Edge Cases

- **Ungültige `redirectTo`-URL**: Nur relative Pfade akzeptieren (keine externen URLs) — verhindert Open Redirect
- **User ohne `profiles`-Eintrag**: Falls kein Profil existiert (Datenfehler), User wird ausgeloggt mit Hinweis "Account nicht konfiguriert — bitte Admin kontaktieren"
- **Deaktivierter Account** (`aktiv = false` in `profiles`): User kann sich einloggen (Supabase Auth kennt den `aktiv`-Status nicht), aber Middleware prüft `aktiv`-Flag und leitet zu `/login` mit Hinweis "Ihr Account wurde deaktiviert"
- **Netzwerkfehler beim Login**: Fehlermeldung "Verbindungsfehler — bitte versuche es erneut" statt leerem Fehler
- **Gleichzeitige Sessions**: Kein Limit (Supabase Standard) — kein Handlungsbedarf für MVP
- **Passwort-Reset**: Nicht im MVP-Scope (Admin kann Passwort direkt im Supabase Dashboard zurücksetzen); in PROJ-9 als Option erweiterbar

---

## Rollenmatrix

| Route | Admin | Staffhub Manager | Agentur |
|-------|-------|------------------|---------|
| `/dashboard` | ✅ | ✅ | ✅ |
| `/vakanzen` | ✅ | ✅ | ✅ (read-only) |
| `/profile` | ✅ | ✅ | ❌ |
| `/agenturen` | ✅ | ✅ | ❌ |
| `/abrechnung` | ✅ | ✅ | ❌ |
| `/admin` | ✅ | ❌ | ❌ |
| `/meine-profile` | ✅ | ❌ | ✅ |

---

## Technical Requirements

- **Kein Self-Signup**: `signUp` wird in der App nicht verwendet — Accounts nur via Admin oder Supabase Dashboard
- **Session-Handling**: Supabase SSR-Client (`@supabase/ssr`) für Server Components und Middleware
- **Middleware-Scope**: `matcher` in `middleware.ts` schließt `_next/static`, `_next/image`, `favicon.ico` aus
- **Rollen-Quelle**: Rolle wird aus `profiles.rolle` gelesen (nicht aus Supabase Auth `user_metadata`), um zentrale Verwaltung zu gewährleisten
- **Performance**: Middleware-Check < 50ms (nur DB-Lookup auf `profiles` mit Index auf `id`)
- **Sicherheit**: `redirectTo` wird gegen Whitelist relativer Pfade validiert (kein `//evil.com` möglich)

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
