# Pool-Optimierung: Resource Availability Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent agents from submitting resources that are currently assigned (beauftragt) or unavailable by hiding submission options and enforcing server-side validation.

**Architecture:** Hybrid approach with client-side filtering for UX and server-side validation for security. A shared utility function checks resource availability based on beauftragungen and status. Frontend hides submission options when unavailable, and API endpoints validate before processing submissions.

**Tech Stack:** Next.js, React, TypeScript, Supabase, Tailwind CSS

---

## File Structure

**New files:**
- `src/lib/resource-availability.ts` — Shared utility for checking resource availability

**Modified files:**
- `src/app/pool/page.tsx` — Fetch beauftragungen, hide submission options
- `src/app/api/profile/route.ts` — Server-side validation for submissions
- `src/app/api/profile/[id]/route.ts` — Server-side validation for edits (if exists)

---

## Task 1: Create Resource Availability Utility

**Files:**
- Create: `src/lib/resource-availability.ts`

- [ ] **Step 1: Write test for availability checker**

Create file `src/lib/resource-availability.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isResourceUnavailable } from './resource-availability'

describe('isResourceUnavailable', () => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  it('returns true if status is nicht_verfügbar', () => {
    const result = isResourceUnavailable('res-1', [], 'nicht_verfügbar')
    expect(result).toBe(true)
  })

  it('returns false if status is available', () => {
    const result = isResourceUnavailable('res-1', [], 'verfügbar')
    expect(result).toBe(false)
  })

  it('returns false if status is null', () => {
    const result = isResourceUnavailable('res-1', [], null)
    expect(result).toBe(false)
  })

  it('returns true if resource has active beauftragung', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(true)
  })

  it('returns false if beauftragung ends before today', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: yesterday.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(false)
  })

  it('returns false if beauftragung starts after today', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: tomorrow.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(false)
  })

  it('returns true if today equals start_date (inclusive)', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: today.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(true)
  })

  it('returns true if today equals end_date (inclusive)', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: today.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(true)
  })

  it('ignores beauftragungen for other resources', () => {
    const beauftragungen = [
      {
        id: 'b-1',
        ressource_id: 'res-2',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]
    const result = isResourceUnavailable('res-1', beauftragungen, 'verfügbar')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP"
npm test -- src/lib/resource-availability.test.ts
```

Expected: FAIL with "isResourceUnavailable is not exported"

- [ ] **Step 3: Write the utility function**

Create file `src/lib/resource-availability.ts`:

```typescript
export interface Beauftragung {
  id: string
  ressource_id: string
  ressource_link_id?: string | null
  start_date: string
  end_date: string
}

export function isResourceUnavailable(
  ressourceId: string,
  beauftragungen: Beauftragung[],
  ressourceStatus: string | null
): boolean {
  // Check if status is "nicht_verfügbar"
  if (ressourceStatus === 'nicht_verfügbar') {
    return true
  }

  // Check if resource has active beauftragung
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return beauftragungen.some((b) => {
    if (b.ressource_id !== ressourceId) {
      return false
    }

    const startDate = new Date(b.start_date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(b.end_date)
    endDate.setHours(0, 0, 0, 0)

    // Inclusive range check: today >= start_date AND today <= end_date
    return today >= startDate && today <= endDate
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/resource-availability.test.ts
```

Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/resource-availability.ts src/lib/resource-availability.test.ts
git commit -m "feat: add isResourceUnavailable utility function with tests"
```

---

## Task 2: Fetch Beauftragungen on Pool Page

**Files:**
- Modify: `src/app/pool/page.tsx` (add fetch + state)

- [ ] **Step 1: Add state and useEffect for beauftragungen**

In `src/app/pool/page.tsx`, find the component function definition (around line 400-500 where other useState hooks are). Add these imports at the top of the file:

```typescript
import { isResourceUnavailable, type Beauftragung } from '@/lib/resource-availability'
```

Then add this state in the main component (find the section with `const [ressourcen, setRessourcen]` and similar):

```typescript
const [beauftragungen, setBeauftragungen] = React.useState<Beauftragung[]>([])
```

- [ ] **Step 2: Add useEffect to fetch beauftragungen**

Find the useEffect that loads ressourcen (around line 600-700). After that effect, add a new useEffect:

```typescript
React.useEffect(() => {
  const fetchBeauftragungen = async () => {
    if (ressourcen.length === 0) return

    const resourceIds = ressourcen.map((r) => r.id).join(',')
    try {
      const res = await fetch(
        `/api/beauftragungen?resource_ids=${encodeURIComponent(resourceIds)}`
      )
      if (res.ok) {
        const data = await res.json()
        setBeauftragungen(data.beauftragungen || [])
      }
    } catch (error) {
      console.error('Failed to fetch beauftragungen:', error)
    }
  }

  fetchBeauftragungen()
}, [ressourcen])
```

- [ ] **Step 3: Verify beauftragungen state updates**

Open the pool page in browser and check browser console. No errors should appear.

- [ ] **Step 4: Commit**

```bash
git add src/app/pool/page.tsx
git commit -m "feat: fetch beauftragungen on pool page load"
```

---

## Task 3: Hide "Profil einreichen" Menu Option When Unavailable

**Files:**
- Modify: `src/app/pool/page.tsx` (update dropdown menu)

- [ ] **Step 1: Locate the dropdown menu**

Find the section around line 2505-2514 where "Profil einreichen" is rendered in the dropdown menu.

- [ ] **Step 2: Update the disabled condition**

Replace:

```typescript
<DropdownMenuItem
  onClick={() => {
    setProfilEinreichenRessource(r)
    setProfilEinreichenOpen(true)
  }}
  disabled={r.verfuegbarkeit === "Deaktiviert"}
>
```

With:

```typescript
<DropdownMenuItem
  onClick={() => {
    setProfilEinreichenRessource(r)
    setProfilEinreichenOpen(true)
  }}
  disabled={
    r.verfuegbarkeit === "Deaktiviert" ||
    isResourceUnavailable(r.id, beauftragungen, r.status)
  }
>
```

- [ ] **Step 3: Test in browser**

1. Open pool page
2. Right-click on a resource that is "beauftragt" (has active assignment)
3. Verify "Profil einreichen" option is disabled (grayed out, not clickable)
4. Right-click on an available resource
5. Verify "Profil einreichen" option is enabled (clickable)

- [ ] **Step 4: Commit**

```bash
git add src/app/pool/page.tsx
git commit -m "feat: disable 'Profil einreichen' when resource unavailable"
```

---

## Task 4: Hide KI-Match Dropdown When Unavailable

**Files:**
- Modify: `src/app/pool/page.tsx` (update KI-Match section)

- [ ] **Step 1: Locate the KI-Match section**

Find the section around line 1618-1635 where the "Vakanz wählen..." dropdown is rendered.

- [ ] **Step 2: Create conditional rendering**

Replace the entire Select component (lines 1618-1635) with:

```typescript
{!isResourceUnavailable(selectedRessource!.id, beauftragungen, selectedRessource!.status) ? (
  <Select value={kiVakanzId} onValueChange={setKiVakanzId}>
    <SelectTrigger className="flex-1">
      <SelectValue placeholder="Vakanz wählen…" />
    </SelectTrigger>
    <SelectContent>
      {kiVakanzen.length === 0 ? (
        <SelectItem value="__none__" disabled>
          Keine offenen Vakanzen
        </SelectItem>
      ) : (
        kiVakanzen.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.titel || v.rolle}
          </SelectItem>
        ))
      )}
    </SelectContent>
  </Select>
) : (
  <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
    <span>Diese Ressource ist derzeit vergeben</span>
  </div>
)}
```

Also disable the KI-Match button when unavailable by updating the button's disabled prop:

```typescript
disabled={
  !kiVakanzId ||
  kiBerechnend ||
  isResourceUnavailable(selectedRessource!.id, beauftragungen, selectedRessource!.status)
}
```

- [ ] **Step 3: Test in browser**

1. Open pool page and select a resource
2. In Details panel, verify KI-Match dropdown is visible and enabled for available resources
3. Select a resource that is "beauftragt"
4. In Details panel, verify KI-Match dropdown is replaced with placeholder text "Diese Ressource ist derzeit vergeben"
5. Verify KI-Match button is disabled

- [ ] **Step 4: Commit**

```bash
git add src/app/pool/page.tsx
git commit -m "feat: hide KI-Match dropdown when resource unavailable"
```

---

## Task 5: Create Beauftragungen API Endpoint

**Files:**
- Create: `src/app/api/beauftragungen/route.ts`

- [ ] **Step 1: Create the route**

Create file `src/app/api/beauftragungen/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const resourceIdsParam = searchParams.get('resource_ids') ?? ''

  if (!resourceIdsParam) {
    return NextResponse.json({ beauftragungen: [] })
  }

  const resourceIds = resourceIdsParam.split(',').filter(Boolean)
  if (resourceIds.length === 0) {
    return NextResponse.json({ beauftragungen: [] })
  }

  // Query beauftragungen that reference these resource_ids via ressource_vakanz_links
  const { data, error } = await supabase
    .from('beauftragungen')
    .select(`
      id,
      ressource_link_id,
      start_date,
      end_date,
      ressource_vakanz_links (
        ressource_id
      )
    `)
    .in(
      'ressource_link_id',
      // First get all ressource_vakanz_link ids that match our resource_ids
      (() => {
        // This will be done in two queries for simplicity
        return []
      })()
    )

  // Actually, simpler approach: get ressource_vakanz_links first, then beauftragungen
  const { data: links, error: linksError } = await supabase
    .from('ressource_vakanz_links')
    .select('id, ressource_id')
    .in('ressource_id', resourceIds)

  if (linksError || !links) {
    return NextResponse.json({ beauftragungen: [] })
  }

  const linkIds = links.map((l) => l.id)
  if (linkIds.length === 0) {
    return NextResponse.json({ beauftragungen: [] })
  }

  const { data: beauftragungen, error: baufError } = await supabase
    .from('beauftragungen')
    .select('id, ressource_link_id, start_date, end_date')
    .in('ressource_link_id', linkIds)

  if (baufError || !beauftragungen) {
    return NextResponse.json({ beauftragungen: [] })
  }

  // Map back to ressource_id
  const result = beauftragungen.map((b) => {
    const link = links.find((l) => l.id === b.ressource_link_id)
    return {
      id: b.id,
      ressource_id: link?.ressource_id,
      ressource_link_id: b.ressource_link_id,
      start_date: b.start_date,
      end_date: b.end_date,
    }
  })

  return NextResponse.json({ beauftragungen: result })
}
```

- [ ] **Step 2: Test the endpoint manually**

```bash
# Get a resource_id from the pool (you'll need to check the DB or pool page)
# Then test the endpoint
curl "http://localhost:3000/api/beauftragungen?resource_ids=<resource-id>"
```

Expected: JSON response with array of beauftragungen

- [ ] **Step 3: Commit**

```bash
git add src/app/api/beauftragungen/route.ts
git commit -m "feat: add beauftragungen API endpoint for availability check"
```

---

## Task 6: Add Server-Side Validation to Profile Submission

**Files:**
- Modify: `src/app/api/profile/route.ts`

- [ ] **Step 1: Add import and validation helper**

At the top of `src/app/api/profile/route.ts`, add:

```typescript
import { isResourceUnavailable, type Beauftragung } from '@/lib/resource-availability'
```

- [ ] **Step 2: Create validation function**

Add this function before the POST handler:

```typescript
async function validateResourceAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ressourceVakanzLinkId: string
): Promise<{ available: boolean; reason?: string }> {
  // Get the link to find ressource_id
  const { data: link, error: linkError } = await supabase
    .from('ressource_vakanz_links')
    .select('ressource_id')
    .eq('id', ressourceVakanzLinkId)
    .single()

  if (linkError || !link) {
    return { available: false, reason: 'Ressource-Verknüpfung nicht gefunden' }
  }

  // Check resource status
  const { data: ressource, error: resError } = await supabase
    .from('ressourcen')
    .select('status')
    .eq('id', link.ressource_id)
    .single()

  if (resError || !ressource) {
    return { available: false, reason: 'Ressource nicht gefunden' }
  }

  if (ressource.status === 'nicht_verfügbar') {
    return { available: false, reason: 'Diese Ressource ist derzeit nicht verfügbar' }
  }

  // Check for active beauftragungen
  const { data: beauftragungen, error: baufError } = await supabase
    .from('beauftragungen')
    .select('id, start_date, end_date')
    .eq('ressource_link_id', ressourceVakanzLinkId)

  if (baufError) {
    console.error('Error checking beauftragungen:', baufError)
    return { available: false, reason: 'Fehler bei der Verfügbarkeitsprüfung' }
  }

  // Check if any beauftragung is active
  const convertedBeauftragungen: Beauftragung[] = (beauftragungen || []).map((b) => ({
    id: b.id,
    ressource_id: link.ressource_id,
    start_date: b.start_date,
    end_date: b.end_date,
  }))

  if (isResourceUnavailable(link.ressource_id, convertedBeauftragungen, ressource.status)) {
    return { available: false, reason: 'Diese Ressource ist derzeit beauftragt' }
  }

  return { available: true }
}
```

- [ ] **Step 3: Add validation to POST handler**

Find the POST handler and locate where it processes the request body. Before creating/updating the profile, add:

```typescript
// Validate resource availability
const validation = await validateResourceAvailability(
  supabase,
  ressourceVakanzLinkId // or extract this from request body
)

if (!validation.available) {
  return NextResponse.json(
    { error: validation.reason || 'Ressource nicht verfügbar' },
    { status: 403 }
  )
}
```

(Note: You'll need to locate the exact place in the POST handler and the variable name for ressourceVakanzLinkId from the request body)

- [ ] **Step 4: Test the validation**

1. Create a test profile submission with an unavailable resource
2. Verify API returns 403 with appropriate message
3. Create a test with available resource
4. Verify submission succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat: add server-side validation for resource availability on profile submission"
```

---

## Task 7: Add Error Handling for 403 Response in Frontend

**Files:**
- Modify: `src/components/profil-einreichen-sheet.tsx`

- [ ] **Step 1: Locate submission handler**

Find the form submission handler (around line 306 where it does `await fetch('/api/profile')`)

- [ ] **Step 2: Add error handling**

Update the error handling section to specifically handle 403:

```typescript
if (response.status === 403) {
  const error = await response.json()
  toast.error(error.error || 'Diese Ressource ist nicht mehr verfügbar')
  return
}

if (!response.ok) {
  const error = await response.json()
  toast.error(error.error || 'Fehler beim Einreichen des Profils')
  return
}
```

- [ ] **Step 3: Test in browser**

1. Open profil-einreichen-sheet with an unavailable resource
2. Attempt to submit
3. Verify error toast shows "Diese Ressource ist nicht mehr verfügbar"

- [ ] **Step 4: Commit**

```bash
git add src/components/profil-einreichen-sheet.tsx
git commit -m "feat: improve error messaging for unavailable resources"
```

---

## Task 8: Integration Tests

**Files:**
- Create: `src/app/pool/pool-availability.test.ts`

- [ ] **Step 1: Write integration test for frontend filtering**

Create `src/app/pool/pool-availability.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { isResourceUnavailable } from '@/lib/resource-availability'

describe('Pool page availability filtering', () => {
  it('correctly filters resources with active beauftragung', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const beauftragungen = [
      {
        id: 'b1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: tomorrow.toISOString(),
      },
    ]

    // Resource should be unavailable
    expect(isResourceUnavailable('res-1', beauftragungen, 'verfügbar')).toBe(true)

    // Other resources should be available
    expect(isResourceUnavailable('res-2', beauftragungen, 'verfügbar')).toBe(false)
  })

  it('correctly handles nicht_verfügbar status', () => {
    expect(isResourceUnavailable('res-1', [], 'nicht_verfügbar')).toBe(true)
    expect(isResourceUnavailable('res-1', [], 'verfügbar')).toBe(false)
    expect(isResourceUnavailable('res-1', [], null)).toBe(false)
  })

  it('resource becomes available after beauftragung ends', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const expiredBeauftragungen = [
      {
        id: 'b1',
        ressource_id: 'res-1',
        ressource_link_id: 'link-1',
        start_date: yesterday.toISOString(),
        end_date: yesterday.toISOString(),
      },
    ]

    expect(isResourceUnavailable('res-1', expiredBeauftragungen, 'verfügbar')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/app/pool/pool-availability.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/pool/pool-availability.test.ts
git commit -m "test: add integration tests for pool availability filtering"
```

---

## Task 9: Manual Test Cases

**Files:**
- N/A (manual testing)

- [ ] **Test 1: Available resource submission**

Steps:
1. Open pool page
2. Select a resource with no active beauftragung and status != "nicht_verfügbar"
3. Right-click → "Profil einreichen" should be enabled
4. In Details panel, KI-Match dropdown should be visible
5. Submit a profile → should succeed

Expected: Submission works

- [ ] **Test 2: Beauftragte resource submission is blocked (UI)**

Steps:
1. Open pool page
2. Select a resource with active beauftragung
3. Right-click → "Profil einreichen" should be disabled (grayed out)
4. In Details panel, KI-Match dropdown should be hidden, replaced with "Diese Ressource ist derzeit vergeben"

Expected: Options are not visible/disabled

- [ ] **Test 3: Nicht verfügbar resource submission is blocked (UI)**

Steps:
1. Open pool page
2. Select a resource with status = "nicht_verfügbar"
3. Right-click → "Profil einreichen" should be disabled
4. In Details panel, KI-Match area should show placeholder

Expected: Options are not visible/disabled

- [ ] **Test 4: Server-side validation blocks submission**

Steps:
1. Open browser DevTools
2. On a resource with active beauftragung
3. Manually call the submission API with the resource_id
4. Verify API returns 403 with error message

Example curl:
```bash
curl -X POST http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "ressource_vakanz_link_id": "unavailable-link-id",
    "vakanz_id": "v1",
    ...
  }'
```

Expected: 403 Forbidden response

- [ ] **Test 5: Resource reappears after beauftragung ends**

Steps:
1. Find a resource with beauftragung ending today
2. Reload pool page after end_date passes
3. "Profil einreichen" should now be enabled
4. KI-Match dropdown should reappear

Expected: Options are visible/enabled after date passes

- [ ] **Test 6: Other functionality still works**

Steps:
1. Test that available resources can still be submitted
2. Test that KI-Match still works for available resources
3. Test that context menu options other than "Profil einreichen" work
4. Test that resource editing still works

Expected: All existing features work as before

---

## Spec Coverage Check

✅ Data Model: `isResourceUnavailable` function checks beauftragung dates and status
✅ Client-side filtering: Pool page hides "Profil einreichen" and KI-Match when unavailable
✅ Server-side validation: Beauftragungen API endpoint + profile submission validation
✅ Error handling: 403 response on frontend with error toast
✅ Tests: Unit tests for utility, integration tests for logic
✅ Success criteria: All requirements covered

---

## Notes for Implementation

- The beauftragungen endpoint assumes `ressource_vakanz_links` exists and has `ressource_id` and `id` fields
- Date comparisons use `setHours(0, 0, 0, 0)` to ignore time of day
- The date range is inclusive (start_date <= today <= end_date)
- Error messages are German to match app language
- All existing functionality remains unchanged for available resources
