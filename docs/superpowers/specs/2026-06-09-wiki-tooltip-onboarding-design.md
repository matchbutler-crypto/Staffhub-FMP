# Wiki + Tooltip Onboarding — Design Spec

**Date:** 2026-06-09  
**Status:** Approved

## Overview

Add a role-filtered Wiki section to the sidebar as a persistent reference for all users. Each wiki page can optionally trigger an interactive tooltip tour (via driver.js) on the relevant app page via a "Zeig es mir" button. Wiki content is static TypeScript — updated alongside feature deploys, linkable from Release Notes.

## 1. Content Structure

Wiki content lives in `src/lib/wiki/` — one file per app area (e.g. `vakanzen.ts`, `beauftragungen.ts`, `abrechnung.ts`). A central `src/lib/wiki/index.ts` exports all pages.

```ts
type Role = 'Admin' | 'Staffhub Manager' | 'Agentur' | 'Controller'

type TourStep = {
  element: string      // CSS selector targeting the element to highlight
  title: string
  description: string
}

type WikiSection = {
  heading: string
  body: string         // plain text or minimal HTML
  tourId?: string      // optional reference to a step in the tour
}

type WikiPage = {
  slug: string         // e.g. 'vakanzen' — matches the URL /wiki/vakanzen
  title: string
  roles: Role[]        // which roles can see this page
  sections: WikiSection[]
  tour?: TourStep[]    // if defined, "Zeig es mir" button appears
}
```

## 2. Navigation

- New sidebar entry **"Wiki"** added to `ALL_NAV_SECONDARY` in `app-sidebar.tsx`
- Icon: `IconBook` from `@tabler/icons-react`
- Visible to all roles: `['Admin', 'Staffhub Manager', 'Agentur', 'Controller']`
- Positioned above "Einstellungen"

## 3. Routing

| Route | Description |
|---|---|
| `/wiki` | Overview: list of wiki pages visible to the current user's role |
| `/wiki/[slug]` | Detail: sections + optional "Zeig es mir" button |

The overview page filters `wikiPages` by `page.roles.includes(rolle)`. The detail page 404s if the slug doesn't exist or the user's role isn't in `page.roles`.

## 4. Tooltip Tour

**Library:** `driver.js` — lightweight (~7KB), framework-agnostic, styleable via CSS variables.

**Flow:**
1. User reads `/wiki/vakanzen`, sees "Zeig es mir" button (only rendered if `page.tour` is defined)
2. Button navigates to the target page with query param: `/vakanzen?tour=vakanzen`
3. Target page reads `searchParams.tour` on mount and calls `startTour(slug)`
4. A central `useTour(slug)` hook loads the `TourStep[]` for that slug and initializes driver.js

**Styling:** driver.js popover colors are overridden with the app's existing CSS variables (`--background`, `--foreground`, `--primary`, `--border`, `--radius`) — no custom color values.

**Hook signature:**
```ts
// src/hooks/use-tour.ts
function useTour(slug: string | null): void
// Reads ?tour param, finds matching WikiPage, drives driver.js
```

## 5. Release Notes Integration

Wiki pages are plain URLs — Release Notes entries can link directly:

```
Neue Funktion: Vakanz duplizieren → [Mehr erfahren](/wiki/vakanzen)
```

No special integration needed. Since wiki content is co-located with code, the wiki entry for a feature is updated in the same PR that ships the feature.

## 6. Adding New Wiki Pages

When shipping a new feature:
1. Create or update the relevant file in `src/lib/wiki/`
2. Add `TourStep[]` entries pointing to CSS selectors on the new feature's UI elements
3. Export from `src/lib/wiki/index.ts`
4. Optionally link from the Release Note

## Out of Scope

- Admin management of wiki content (content is in code, updated via deploys)
- First-login hints or onboarding flows
- Rich text editor or CMS
- Search within the wiki
