# PROJ-1: Auth & Rollenverwaltung

## Status: In Progress
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

### Übersicht

Die Authentifizierung läuft vollständig über **Supabase Auth** (Email/Passwort). Der Schutz aller Routen erfolgt zentral in einer **Next.js Middleware** — einer einzigen Datei, die bei jedem Request ausgeführt wird, bevor die Seite gerendert wird. Die Rolle des Users wird aus der `profiles`-Datenbanktabelle gelesen.

---

### Neue Dateien & Komponenten

```
middleware.ts                          ← NEU: Routenschutz + RBAC (läuft serverseitig vor jeder Seite)
src/
  lib/
    supabase/
      server.ts                        ← NEU: Supabase-Client für Server Components
      middleware.ts                    ← NEU: Supabase-Client speziell für Middleware
  app/
    login/
      page.tsx                         ← NEU: Login-Seite (Email + Passwort Formular)
    (protected)/
      layout.tsx                       ← NEU: Wrapper für alle geschützten Seiten (prüft Auth)
      dashboard/page.tsx               ← VERSCHOBEN (von src/app/dashboard/)
      vakanzen/page.tsx                ← VERSCHOBEN
      profile/page.tsx                 ← VERSCHOBEN
      agenturen/page.tsx               ← VERSCHOBEN
      abrechnung/page.tsx              ← VERSCHOBEN
      admin/page.tsx                   ← VERSCHOBEN
      meine-profile/page.tsx           ← VERSCHOBEN
  components/
    app-sidebar.tsx                    ← ANGEPASST: Zeigt nur rollenerlaubte Nav-Einträge
    nav-user.tsx                       ← ANGEPASST: Echter Name, Rolle, Logout-Button
  context/
    user-context.tsx                   ← NEU: Stellt User + Rolle client-seitig bereit
```

---

### Wie die einzelnen Teile zusammenspielen

#### 1. Middleware (Torwächter)
Die Middleware sitzt vor **jeder** Seite. Bei jedem Request prüft sie:

1. Hat der User eine gültige Session? → Nein → Weiterleitung zu `/login?redirectTo=<aktuelle URL>`
2. Ruft ein eingeloggter User `/login` auf? → Weiterleitung zu `/dashboard`
3. Hat der User die nötige Rolle für diese Route? → Nein → Weiterleitung zu `/dashboard` (Unauthorized-Flag wird als URL-Parameter übergeben)
4. Ist der Account deaktiviert (`aktiv = false`)? → Weiterleitung zu `/login?error=deactivated`

Die Middleware liest die Rolle einmalig aus `profiles` und entscheidet anhand der Rollenmatrix.

#### 2. Login-Seite (`/login`)
- Einfaches Formular: E-Mail + Passwort + Submit-Button
- Clientseitige Validierung (Felder dürfen nicht leer sein)
- Bei Fehler: Fehlermeldung direkt unter dem Formular
- Kein "Registrieren"-Link (kein Self-Signup)
- Nach erfolgreichem Login: Weiterleitung zu `redirectTo` oder `/dashboard`

#### 3. Route-Gruppierung `(protected)`
Alle geschützten Seiten werden in einer Route-Gruppe zusammengefasst. Diese Gruppe hat ein eigenes Layout, das die Sidebar + Header einbindet. Die Login-Seite liegt **außerhalb** dieser Gruppe — sie hat kein Sidebar-Layout.

```
src/app/
  login/page.tsx          ← kein Sidebar-Layout
  (protected)/
    layout.tsx            ← Sidebar + Header für alle geschützten Seiten
    dashboard/page.tsx
    vakanzen/page.tsx
    ...
```

#### 4. User Context
Damit alle Client-Komponenten (Sidebar, Nav-User) auf den eingeloggten User zugreifen können, ohne bei jeder Komponente neu die DB abzufragen, wird der User einmalig im `(protected)/layout.tsx` aus der DB geladen und über einen React Context weitergegeben.

```
Layout lädt User aus DB
    ↓
UserContext stellt { name, rolle, agentur_id } bereit
    ↓
app-sidebar.tsx liest Rolle → zeigt erlaubte Nav-Einträge
nav-user.tsx liest Name + Rolle → zeigt User-Info + Logout
```

#### 5. Rollenbasierte Sidebar-Navigation
Die Sidebar-Komponente erhält die Rolle aus dem Context und filtert die Nav-Einträge:

| Rolle | Sichtbare Nav-Einträge |
|-------|----------------------|
| Admin | Dashboard, Vakanzen, Profile, Agenturen, Abrechnung, Admin |
| Staffhub Manager | Dashboard, Vakanzen, Profile, Agenturen, Abrechnung |
| Agentur | Dashboard, Vakanzen, Meine Profile |

#### 6. Logout
Der Logout-Button in `nav-user.tsx` ruft Supabase `signOut()` auf und leitet zu `/login` weiter. Die Middleware schützt danach automatisch alle Routen.

---

### Datenspeicherung

| Was | Wo | Warum |
|-----|----|-------|
| Session (JWT Token) | Browser `localStorage` | Supabase Standard — bleibt nach Browser-Neustart bestehen |
| User-Profil (Name, Rolle) | Supabase `profiles`-Tabelle | Zentrale Verwaltung, RLS-geschützt |
| Aktiv-Status | `profiles.aktiv` (Boolean) | Ermöglicht Deaktivierung ohne Supabase Auth zu berühren |

---

### Neue Abhängigkeit

| Paket | Zweck |
|-------|-------|
| `@supabase/ssr` | Supabase-Client für Next.js Server Components und Middleware (Cookie-basiertes Session-Handling statt localStorage) |

---

### Sicherheitsüberlegungen

- **`redirectTo`-Validierung**: Nur Pfade, die mit `/` beginnen und keine `//` oder externe Domains enthalten, werden akzeptiert
- **Rolle wird server-seitig geprüft**: Die Middleware läuft auf dem Server — ein User kann seine Rolle nicht im Browser manipulieren
- **RLS als zweite Verteidigungslinie**: Auch wenn jemand die Middleware umgeht, verhindert die Datenbank-RLS unautorisierten Datenzugriff
- **Kein Self-Signup**: `signUp()` wird nirgendwo in der App aufgerufen

## Implementation Notes

### Implementierte Dateien
- `middleware.ts` — Routenschutz + RBAC + Deaktivierungs-Check (alle Routen außer /login)
- `src/lib/supabase/server.ts` — Supabase SSR-Client für Server Components
- `src/context/user-context.tsx` — UserProvider + useUser Hook (client-seitig)
- `src/app/login/page.tsx` — Login-Formular (Email/Passwort, kein Self-Signup)
- `src/components/app-sidebar.tsx` — Rollenbasierte Nav-Filterung via useUser
- `src/components/nav-user.tsx` — Echter Name, Rolle, Logout (signOut + redirect /login)
- `src/components/unauthorized-toast.tsx` — Toast bei ?unauthorized=1 auf /dashboard
- `src/app/layout.tsx` — UserProvider + ThemeProvider + Toaster

### Abweichungen vom Design
- Keine: Implementierung folgt dem Tech Design 1:1

### Build
- `npm run build` → ✅ 10 Routen, keine Fehler

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
