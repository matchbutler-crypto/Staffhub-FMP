# Wiki + Tooltip Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-filtered Wiki sidebar section with static content pages and on-demand driver.js tooltip tours triggered via `?tour=<slug>` query params.

**Architecture:** Static TypeScript wiki content in `src/lib/wiki/`, a `/wiki` overview + `/wiki/[slug]` detail route, and a `useTour` hook that reads `?tour=` on mount and drives driver.js. Tour target elements get `data-tour` attributes added to existing pages.

**Tech Stack:** Next.js 14 App Router, driver.js, Tabler Icons, Tailwind CSS, shadcn/ui

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/wiki/types.ts` | Create | WikiPage, WikiSection, TourStep, Role types |
| `src/lib/wiki/dashboard.ts` | Create | Wiki content for Dashboard |
| `src/lib/wiki/vakanzen.ts` | Create | Wiki content + tour steps for Vakanzen |
| `src/lib/wiki/beauftragungen.ts` | Create | Wiki content + tour steps for Beauftragungen |
| `src/lib/wiki/abrechnung.ts` | Create | Wiki content for Abrechnung |
| `src/lib/wiki/pool.ts` | Create | Wiki content for Mein Pool (Agentur only) |
| `src/lib/wiki/ressourcen.ts` | Create | Wiki content for Ressourcen (Admin/Manager only) |
| `src/lib/wiki/index.ts` | Create | Exports all wiki pages as `wikiPages` array |
| `src/hooks/use-tour.ts` | Create | Reads `?tour=` param, drives driver.js |
| `src/app/wiki/page.tsx` | Create | `/wiki` overview — role-filtered list |
| `src/app/wiki/[slug]/page.tsx` | Create | `/wiki/[slug]` detail — sections + "Zeig es mir" button |
| `src/components/app-sidebar.tsx` | Modify | Add Wiki entry to `ALL_NAV_SECONDARY` |
| `src/app/vakanzen/page.tsx` | Modify | Add `data-tour` attributes to key elements, call `useTour` |
| `src/app/beauftragungen/page.tsx` | Modify | Add `data-tour` attributes to key elements, call `useTour` |
| `src/test/wiki.test.ts` | Create | Unit tests for wiki filtering logic |

---

## Task 1: Install driver.js + create wiki types

**Files:**
- Create: `src/lib/wiki/types.ts`

- [ ] **Step 1: Install driver.js**

```bash
npm install driver.js
```

Expected: `driver.js` appears in `package.json` dependencies.

- [ ] **Step 2: Write failing test for wiki types**

Create `src/test/wiki.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { WikiPage } from '@/lib/wiki/types'

describe('WikiPage type', () => {
  it('accepts a valid wiki page object', () => {
    const page: WikiPage = {
      slug: 'test',
      title: 'Test',
      roles: ['Admin'],
      sections: [{ heading: 'Einleitung', body: 'Text' }],
    }
    expect(page.slug).toBe('test')
    expect(page.tour).toBeUndefined()
  })

  it('accepts a wiki page with tour steps', () => {
    const page: WikiPage = {
      slug: 'vakanzen',
      title: 'Vakanzen',
      roles: ['Admin', 'Staffhub Manager', 'Agentur'],
      sections: [{ heading: 'Übersicht', body: 'Text' }],
      tour: [{ element: '[data-tour="vakanzen-header"]', title: 'Vakanzen', description: 'Hier siehst du alle Vakanzen.' }],
    }
    expect(page.tour).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run test — expect TS error (types not defined yet)**

```bash
npx vitest run src/test/wiki.test.ts
```

Expected: error about missing module `@/lib/wiki/types`

- [ ] **Step 4: Create `src/lib/wiki/types.ts`**

```ts
export type Role = 'Admin' | 'Staffhub Manager' | 'Agentur' | 'Controller'

export type TourStep = {
  element: string
  title: string
  description: string
}

export type WikiSection = {
  heading: string
  body: string
}

export type WikiPage = {
  slug: string
  title: string
  roles: Role[]
  sections: WikiSection[]
  tour?: TourStep[]
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run src/test/wiki.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/wiki/types.ts src/test/wiki.test.ts package.json package-lock.json
git commit -m "feat: install driver.js and add wiki types"
```

---

## Task 2: Create wiki content files

**Files:**
- Create: `src/lib/wiki/dashboard.ts`
- Create: `src/lib/wiki/vakanzen.ts`
- Create: `src/lib/wiki/beauftragungen.ts`
- Create: `src/lib/wiki/abrechnung.ts`
- Create: `src/lib/wiki/pool.ts`
- Create: `src/lib/wiki/ressourcen.ts`
- Create: `src/lib/wiki/index.ts`

- [ ] **Step 1: Write failing test for wiki index filtering**

Add to `src/test/wiki.test.ts`:

```ts
import { wikiPages, getWikiPagesByRole, getWikiPageBySlug } from '@/lib/wiki/index'

describe('wikiPages', () => {
  it('has at least one page per role', () => {
    const roles: Role[] = ['Admin', 'Staffhub Manager', 'Agentur', 'Controller']
    for (const role of roles) {
      const pages = getWikiPagesByRole(role)
      expect(pages.length).toBeGreaterThan(0)
    }
  })

  it('filters pages by role correctly', () => {
    const agenturPages = getWikiPagesByRole('Agentur')
    // pool is Agentur-only
    expect(agenturPages.some(p => p.slug === 'pool')).toBe(true)
    // ressourcen is not for Agentur
    expect(agenturPages.some(p => p.slug === 'ressourcen')).toBe(false)
  })

  it('finds page by slug', () => {
    const page = getWikiPageBySlug('vakanzen')
    expect(page).not.toBeNull()
    expect(page?.title).toBeTruthy()
  })

  it('returns null for unknown slug', () => {
    expect(getWikiPageBySlug('does-not-exist')).toBeNull()
  })

  it('all pages have at least one section', () => {
    for (const page of wikiPages) {
      expect(page.sections.length).toBeGreaterThan(0)
    }
  })

  it('all tour steps reference data-tour selectors', () => {
    for (const page of wikiPages) {
      for (const step of page.tour ?? []) {
        expect(step.element).toMatch(/^\[data-tour=/)
      }
    }
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/test/wiki.test.ts
```

Expected: FAIL — missing module `@/lib/wiki/index`

- [ ] **Step 3: Create `src/lib/wiki/dashboard.ts`**

```ts
import type { WikiPage } from './types'

export const dashboardPage: WikiPage = {
  slug: 'dashboard',
  title: 'Dashboard',
  roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  sections: [
    {
      heading: 'Übersicht',
      body: 'Das Dashboard zeigt dir eine Zusammenfassung aller relevanten Kennzahlen auf einen Blick. Abhängig von deiner Rolle siehst du unterschiedliche Karten und Statistiken.',
    },
    {
      heading: 'Kennzahlen',
      body: 'Die Karten zeigen aktive Vakanzen, laufende Beauftragungen und offene Abrechnungen. Klicke auf eine Karte um direkt zur jeweiligen Übersicht zu gelangen.',
    },
  ],
}
```

- [ ] **Step 4: Create `src/lib/wiki/vakanzen.ts`**

```ts
import type { WikiPage } from './types'

export const vakanzenPage: WikiPage = {
  slug: 'vakanzen',
  title: 'Vakanzen',
  roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  sections: [
    {
      heading: 'Was sind Vakanzen?',
      body: 'Vakanzen sind offene Stellen oder Projektbedarfe, die von Staffhub Managern angelegt werden. Agenturen können passende Profile für diese Vakanzen einreichen.',
    },
    {
      heading: 'Neue Vakanz anlegen',
      body: 'Admins und Staffhub Manager können über den Button "Neue Vakanz" eine neue Stelle anlegen. Dabei werden Titel, Erfahrungslevel, Arbeitsmodell, Startdatum und weitere Details hinterlegt.',
    },
    {
      heading: 'Profil einreichen (Agentur)',
      body: 'Als Agentur kannst du über das Drei-Punkte-Menü einer Vakanz ein Profil aus deinem Pool einreichen. Das Profil wird anschließend vom Staffhub Manager geprüft.',
    },
    {
      heading: 'Status einer Vakanz',
      body: 'Vakanzen durchlaufen verschiedene Status: Offen → In Prüfung → Besetzt / Geschlossen. Der aktuelle Status ist farblich markiert.',
    },
  ],
  tour: [
    {
      element: '[data-tour="vakanzen-header"]',
      title: 'Vakanzen-Übersicht',
      description: 'Hier siehst du alle Vakanzen, nach deiner Rolle gefiltert.',
    },
    {
      element: '[data-tour="vakanzen-search"]',
      title: 'Suche & Filter',
      description: 'Suche nach Titel oder filtere nach Status, Erfahrungslevel und Arbeitsmodell.',
    },
    {
      element: '[data-tour="vakanzen-new"]',
      title: 'Neue Vakanz',
      description: 'Lege hier eine neue Vakanz an. Nur für Admins und Staffhub Manager sichtbar.',
    },
  ],
}
```

- [ ] **Step 5: Create `src/lib/wiki/beauftragungen.ts`**

```ts
import type { WikiPage } from './types'

export const beauftragungenPage: WikiPage = {
  slug: 'beauftragungen',
  title: 'Beauftragungen',
  roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  sections: [
    {
      heading: 'Was sind Beauftragungen?',
      body: 'Eine Beauftragung entsteht, wenn ein eingereichertes Profil für eine Vakanz akzeptiert wurde. Sie dokumentiert den Einsatz einer Ressource beim Kunden.',
    },
    {
      heading: 'Beauftragung anlegen',
      body: 'Admins und Staffhub Manager können Beauftragungen direkt anlegen oder aus einer akzeptierten Profileinreichung erstellen.',
    },
    {
      heading: 'Status & Laufzeit',
      body: 'Beauftragungen haben ein Start- und Enddatum sowie einen Status (Aktiv / Abgeschlossen / Storniert). Aktive Beauftragungen bilden die Basis für die Abrechnung.',
    },
  ],
  tour: [
    {
      element: '[data-tour="beauftragungen-header"]',
      title: 'Beauftragungen',
      description: 'Übersicht aller laufenden und abgeschlossenen Beauftragungen.',
    },
    {
      element: '[data-tour="beauftragungen-filter"]',
      title: 'Filter',
      description: 'Filtere nach Status, Zeitraum oder Agentur.',
    },
  ],
}
```

- [ ] **Step 6: Create `src/lib/wiki/abrechnung.ts`**

```ts
import type { WikiPage } from './types'

export const abrechnungPage: WikiPage = {
  slug: 'abrechnung',
  title: 'Abrechnung',
  roles: ['Admin', 'Staffhub Manager', 'Controller'],
  sections: [
    {
      heading: 'Übersicht',
      body: 'Die Abrechnung zeigt alle abrechnungsrelevanten Beauftragungen. Controller sehen eine aggregierte Ansicht, Admins und Manager haben Zugriff auf alle Details.',
    },
    {
      heading: 'Abrechnungszeitraum',
      body: 'Über den Monatsfilter kannst du den Abrechnungszeitraum eingrenzen. Die Tabelle zeigt Tagessätze, Laufzeit und den berechneten Gesamtbetrag.',
    },
    {
      heading: 'Export',
      body: 'Die Abrechnung kann als CSV exportiert werden, um sie in externe Systeme zu übernehmen.',
    },
  ],
}
```

- [ ] **Step 7: Create `src/lib/wiki/pool.ts`**

```ts
import type { WikiPage } from './types'

export const poolPage: WikiPage = {
  slug: 'pool',
  title: 'Mein Pool',
  roles: ['Agentur'],
  sections: [
    {
      heading: 'Was ist der Pool?',
      body: 'Der Pool ist dein internes Ressourcenverzeichnis. Hier pflegst du die Profile deiner Mitarbeiter und Freelancer, die du für Vakanzen einreichen kannst.',
    },
    {
      heading: 'Ressource hinzufügen',
      body: 'Über "Neue Ressource" kannst du ein neues Profil anlegen. Fülle die Pflichtfelder (Name, Skills, Erfahrungslevel, Verfügbarkeit) vollständig aus, um das Profil für Einreichungen nutzen zu können.',
    },
    {
      heading: 'Ressource einreichen',
      body: 'Um eine Ressource für eine Vakanz einzureichen, gehe zu Vakanzen, öffne das Drei-Punkte-Menü der gewünschten Vakanz und wähle "Profil einreichen".',
    },
  ],
}
```

- [ ] **Step 8: Create `src/lib/wiki/ressourcen.ts`**

```ts
import type { WikiPage } from './types'

export const ressourcenPage: WikiPage = {
  slug: 'ressourcen',
  title: 'Ressourcen',
  roles: ['Admin', 'Staffhub Manager'],
  sections: [
    {
      heading: 'Übersicht',
      body: 'Die Ressourcen-Übersicht zeigt alle Profile aus den Pools aller Agenturen. Hier kannst du den aktuellen Status, Verfügbarkeit und Einsatzhistorie jeder Ressource einsehen.',
    },
    {
      heading: 'Filter & Suche',
      body: 'Filtere nach Agentur, Status (Verfügbar / Im Einsatz / Pausiert) oder Suchbegriff. Die Ansicht hilft beim schnellen Abgleich von Bedarf und Verfügbarkeit.',
    },
    {
      heading: 'Ressource bearbeiten',
      body: 'Admins können Ressourcen direkt bearbeiten. Über das Drei-Punkte-Menü sind Bearbeiten, Statusänderung und Löschen erreichbar.',
    },
  ],
}
```

- [ ] **Step 9: Create `src/lib/wiki/index.ts`**

```ts
import type { Role, WikiPage } from './types'
import { dashboardPage } from './dashboard'
import { vakanzenPage } from './vakanzen'
import { beauftragungenPage } from './beauftragungen'
import { abrechnungPage } from './abrechnung'
import { poolPage } from './pool'
import { ressourcenPage } from './ressourcen'

export { type WikiPage, type WikiSection, type TourStep, type Role } from './types'

export const wikiPages: WikiPage[] = [
  dashboardPage,
  vakanzenPage,
  beauftragungenPage,
  abrechnungPage,
  poolPage,
  ressourcenPage,
]

export function getWikiPagesByRole(role: Role): WikiPage[] {
  return wikiPages.filter((page) => page.roles.includes(role))
}

export function getWikiPageBySlug(slug: string): WikiPage | null {
  return wikiPages.find((page) => page.slug === slug) ?? null
}
```

- [ ] **Step 10: Run tests — expect PASS**

```bash
npx vitest run src/test/wiki.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 11: Commit**

```bash
git add src/lib/wiki/ src/test/wiki.test.ts
git commit -m "feat: add wiki content and index with role filtering"
```

---

## Task 3: Add Wiki entry to sidebar

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add `IconBook` import and Wiki nav entry**

In `src/components/app-sidebar.tsx`, add `IconBook` to the Tabler import:

```ts
import {
  IconBook,        // ← add this
  IconBrandSlack,
  IconBriefcase,
  // ... rest unchanged
} from '@tabler/icons-react'
```

Then add to `ALL_NAV_SECONDARY`, positioned before "Einstellungen":

```ts
const ALL_NAV_SECONDARY = [
  {
    title: 'Release Notes',
    url: '/release-notes',
    icon: IconSpeakerphone,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Wiki',                          // ← add this entry
    url: '/wiki',
    icon: IconBook,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Einstellungen',
    url: '/settings',
    icon: IconSettingsCog,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Admin',
    url: '/admin',
    icon: IconSettings,
    roles: ['Admin'],
  },
  {
    title: 'Feedback',
    url: '/feedback',
    icon: IconBug,
    roles: ['Admin'],
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add Wiki entry to sidebar navigation"
```

---

## Task 4: Create `/wiki` overview page

**Files:**
- Create: `src/app/wiki/page.tsx`

- [ ] **Step 1: Create the overview page**

Create `src/app/wiki/page.tsx`:

```tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { IconBook, IconChevronRight } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useUser } from '@/context/user-context'
import { getWikiPagesByRole } from '@/lib/wiki'
import type { Role } from '@/lib/wiki'

export default function WikiPage() {
  const { user } = useUser()
  const rolle = (user?.rolle ?? 'Agentur') as Role
  const pages = getWikiPagesByRole(rolle)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wiki</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Anleitungen und Erklärungen zu allen Funktionen
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {pages.map((page) => (
              <Link
                key={page.slug}
                href={`/wiki/${page.slug}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <div className="flex items-center gap-3">
                  <IconBook className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{page.title}</span>
                </div>
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/wiki/page.tsx
git commit -m "feat: add /wiki overview page"
```

---

## Task 5: Create `/wiki/[slug]` detail page

**Files:**
- Create: `src/app/wiki/[slug]/page.tsx`

- [ ] **Step 1: Create the detail page**

Create `src/app/wiki/[slug]/page.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useUser } from '@/context/user-context'
import { getWikiPageBySlug } from '@/lib/wiki'
import type { Role } from '@/lib/wiki'

export default function WikiDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const rolle = (user?.rolle ?? 'Agentur') as Role

  const slug = typeof params.slug === 'string' ? params.slug : ''
  const page = getWikiPageBySlug(slug)

  // Wait for user to load before checking role access
  if (!user && !loading) {
    notFound()
  }

  if (!loading && (!page || !page.roles.includes(rolle))) {
    notFound()
  }

  if (loading || !page) {
    return null
  }

  function handleShowMe() {
    const tourRoutes: Record<string, string> = {
      vakanzen: '/vakanzen',
      beauftragungen: '/beauftragungen',
      dashboard: '/dashboard',
      abrechnung: '/abrechnung',
      pool: '/pool',
      ressourcen: '/ressourcen',
    }
    const target = tourRoutes[page!.slug]
    if (target) {
      router.push(`${target}?tour=${page!.slug}`)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/wiki')}>
              <IconArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {page.sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">{section.heading}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

          {page.tour && page.tour.length > 0 && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={handleShowMe} className="gap-2">
                <IconPlayerPlay className="size-4" />
                Zeig es mir
              </Button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/wiki/[slug]/page.tsx
git commit -m "feat: add /wiki/[slug] detail page with Zeig es mir button"
```

---

## Task 6: Create `useTour` hook + driver.js styling

**Files:**
- Create: `src/hooks/use-tour.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-tour.ts`:

```ts
'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { getWikiPageBySlug } from '@/lib/wiki'

export function useTour() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tourSlug = searchParams.get('tour')

  useEffect(() => {
    if (!tourSlug) return

    const page = getWikiPageBySlug(tourSlug)
    if (!page?.tour || page.tour.length === 0) return

    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Weiter',
      prevBtnText: 'Zurück',
      doneBtnText: 'Fertig',
      progressText: '{{current}} von {{total}}',
      onDestroyed: () => {
        // Remove ?tour= from URL without navigating
        const url = new URL(window.location.href)
        url.searchParams.delete('tour')
        router.replace(url.pathname, { scroll: false })
      },
      steps: page.tour.map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
        },
      })),
    })

    // Small delay to ensure DOM is painted
    const timer = setTimeout(() => driverObj.drive(), 300)
    return () => {
      clearTimeout(timer)
      driverObj.destroy()
    }
  }, [tourSlug, router])
}
```

- [ ] **Step 2: Add driver.js CSS variable overrides to `src/app/globals.css`**

Open `src/app/globals.css` and add at the end of the file:

```css
/* driver.js theme overrides */
.driver-popover {
  background-color: hsl(var(--background)) !important;
  color: hsl(var(--foreground)) !important;
  border: 1px solid hsl(var(--border)) !important;
  border-radius: calc(var(--radius) - 2px) !important;
}
.driver-popover-title {
  color: hsl(var(--foreground)) !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
}
.driver-popover-description {
  color: hsl(var(--muted-foreground)) !important;
  font-size: 0.875rem !important;
}
.driver-popover-next-btn,
.driver-popover-prev-btn,
.driver-popover-done-btn {
  background-color: hsl(var(--primary)) !important;
  color: hsl(var(--primary-foreground)) !important;
  border: none !important;
  border-radius: calc(var(--radius) - 4px) !important;
  font-size: 0.8rem !important;
  padding: 4px 10px !important;
}
.driver-popover-prev-btn {
  background-color: transparent !important;
  color: hsl(var(--muted-foreground)) !important;
  border: 1px solid hsl(var(--border)) !important;
}
.driver-popover-close-btn {
  color: hsl(var(--muted-foreground)) !important;
}
.driver-popover-progress-text {
  color: hsl(var(--muted-foreground)) !important;
  font-size: 0.75rem !important;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-tour.ts src/app/globals.css
git commit -m "feat: add useTour hook and driver.js styling"
```

---

## Task 7: Wire tour into Vakanzen page

**Files:**
- Modify: `src/app/vakanzen/page.tsx`

- [ ] **Step 1: Find the page header / search / new-vakanz button in `src/app/vakanzen/page.tsx`**

Scan for the JSX section that renders the page title, search input, and the "Neue Vakanz" button. These are the three elements that get `data-tour` attributes. The typical pattern in this codebase is a `<div className="flex ...">` wrapping the header, a search `<Input>` and a `<Button>` for creating.

- [ ] **Step 2: Add `data-tour` attributes and `useTour` call**

At the top of the component function body (after the existing hooks), add:

```ts
import { useTour } from '@/hooks/use-tour'

// inside the component:
useTour()
```

Then add `data-tour` attributes to the three JSX elements:

```tsx
// Page title wrapper — find the <div> or <h1> containing the page title
<div data-tour="vakanzen-header" className="...existing classes...">
  {/* existing content unchanged */}
</div>

// Search input wrapper — find the Input or its wrapper div
<div data-tour="vakanzen-search" className="...existing classes...">
  {/* existing content unchanged */}
</div>

// "Neue Vakanz" button — find the Button with onClick for setSheetOpen(true)
<Button data-tour="vakanzen-new" size="sm" onClick={...}>
  {/* existing content unchanged */}
</Button>
```

> Note: Do NOT change any existing className or logic — only add the `data-tour` attribute to existing elements.

- [ ] **Step 3: Commit**

```bash
git add src/app/vakanzen/page.tsx
git commit -m "feat: wire useTour hook and data-tour attributes into Vakanzen page"
```

---

## Task 8: Wire tour into Beauftragungen page

**Files:**
- Modify: `src/app/beauftragungen/page.tsx`

- [ ] **Step 1: Add `useTour` and `data-tour` attributes**

Same pattern as Task 7. In `src/app/beauftragungen/page.tsx`:

```ts
import { useTour } from '@/hooks/use-tour'

// inside component:
useTour()
```

Add to the two JSX elements defined in `beauftragungenPage.tour`:

```tsx
// Page title wrapper
<div data-tour="beauftragungen-header" className="...">
  {/* unchanged */}
</div>

// Filter area wrapper
<div data-tour="beauftragungen-filter" className="...">
  {/* unchanged */}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/beauftragungen/page.tsx
git commit -m "feat: wire useTour hook and data-tour attributes into Beauftragungen page"
```

---

## Task 9: Smoke test end-to-end

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual checks**

1. Open `http://localhost:3000` and log in
2. Verify "Wiki" appears in the sidebar under Release Notes
3. Click "Wiki" → verify `/wiki` shows role-filtered list of pages
4. Click "Vakanzen" → verify sections render correctly
5. Click "Zeig es mir" → verify navigation to `/vakanzen?tour=vakanzen`
6. Verify driver.js tour starts and steps through 3 highlights with German labels
7. Verify popover styling matches the app theme (background, border, buttons)
8. Verify clicking "Fertig" removes `?tour=` from the URL
9. Log in as a different role and verify pool/ressourcen pages are filtered correctly

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: smoke test corrections for wiki tour"
```
