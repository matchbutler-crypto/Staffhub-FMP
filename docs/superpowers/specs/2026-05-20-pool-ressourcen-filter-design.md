# Pool-Optimierung: Ressourcen-Verfügbarkeit Filter

**Date:** 2026-05-20  
**Feature:** Prevent agents from submitting resources that are currently assigned (beauftragt) or unavailable  
**Status:** Design Phase

---

## Overview

Agents on the pool page should not be able to submit resources that are:
1. Currently assigned to another vacancy (beauftragt) — within the assignment's date range
2. Marked as unavailable (status = "nicht_verfügbar")

When a resource is in either state, the two submission methods should disappear:
1. **Context menu option:** "Profil einreichen" on right-click
2. **KI-Match dropdown:** "Vakanz wählen..." in the Details & Verlauf panel

Resources reappear after the assignment end date passes (next page reload).

---

## Data Model & Availability Logic

### Resource Availability States

A resource is considered **unavailable** (option hidden) if:
- It has an active `beauftragung` where `today >= start_date AND today <= end_date`, OR
- Its `status` field equals `"nicht_verfügbar"`

A resource is **available** (option visible) if:
- No active `beauftragung` exists, AND
- `status` is not `"nicht_verfügbar"`

### Database References

From existing migrations:
- `beauftragungen` table references `ressource_vakanz_links` via `ressource_link_id` (migration 006)
- `ressource_vakanz_links` contains `ressource_id` and `vakanz_id`
- `beauftragungen` contains `start_date` and `end_date`
- `ressourcen` table contains `status` field

---

## Implementation Approach

**Hybrid strategy:** Client-side filtering for UX + Server-side validation for security

### Frontend Changes (src/app/pool/page.tsx)

**1. Fetch Data**
- Load pool resources (existing behavior)
- Additional API call: `GET /api/beauftragungen?resource_ids=id1,id2,...` to get active assignments
- Cache result in component state for fast filtering

**2. Hide Context Menu Option**
- Before rendering context menu, check: `isResourceUnavailable(ressource_id, beauftragungen, ressourcen_status)`
- If true: omit "Profil einreichen" from menu items
- If false: show option normally

**3. Hide KI-Match Dropdown**
- In Details & Verlauf panel (right side), check resource availability
- If unavailable: show placeholder text instead of dropdown
  - Example: "Diese Ressource ist derzeit vergeben" or "Nicht verfügbar"
- If available: show "Vakanz wählen..." dropdown normally

**Helper Function:**
```typescript
function isResourceUnavailable(
  ressourceId: string,
  beauftragungen: BeauftragunsRecord[],
  ressourceStatus: string | null
): boolean {
  // Check status
  if (ressourceStatus === "nicht_verfügbar") return true;
  
  // Check active beauftragung
  const today = new Date();
  return beauftragungen.some(
    b => b.ressource_id === ressourceId &&
         new Date(b.start_date) <= today &&
         today <= new Date(b.end_date)
  );
}
```

### Server-Side Validation

**Endpoints to protect:**
- `POST /api/ressource-links/[id]/profil-einreichen` (or equivalent profile submission route)
- `POST` endpoint for KI-Match submission

**Validation logic (on both endpoints):**
1. Extract `ressource_id` from request
2. Query `beauftragungen` for active assignments to this resource
3. Query `ressourcen` for status
4. If either condition is true (beauftragt OR nicht_verfügbar):
   - Return `403 Forbidden`
   - Message: `"Diese Ressource ist derzeit nicht verfügbar"`
5. If available: proceed with normal submission flow

**Security rationale:** Prevents manipulation via DevTools or direct API calls

---

## Error Handling

### Scenario 1: Resource becomes unavailable during session
- Another admin assigns the resource while user is on pool page
- **On next pool reload:** Frontend checks again, option disappears
- **If user tries to submit anyway:** Server returns 403
- **UI feedback:** Toast or dialog with message "Diese Ressource ist leider nicht mehr verfügbar"

### Scenario 2: Assignment ends (end_date is today)
- **On next pool reload:** Resource reappears in submission options
- **No real-time refresh needed** — typical for this use case
- If real-time updates desired later: can add WebSocket/polling listener

### Scenario 3: Submission fails with 403
- Wrap submit handlers in error boundary
- Display user-friendly message, don't crash the page

---

## Testing Strategy

### Unit Tests
- `isResourceUnavailable()` function:
  - Resource with active beauftragung → returns true
  - Resource with status "nicht_verfügbar" → returns true
  - Resource with no beauftragung and available status → returns false
  - Edge cases: beauftragung ends today (inclusive/exclusive)

### Integration Tests
- Pool page loads with mix of available/unavailable resources
- "Profil einreichen" option visible only for available resources
- KI-Match dropdown shows placeholder for unavailable resources
- Server validation blocks submission for unavailable resource (403)

### Manual Test Cases
1. ✓ Available resource: right-click menu shows "Profil einreichen"
2. ✓ Beauftragt resource: right-click menu hides "Profil einreichen"
3. ✓ Nicht verfügbar resource: right-click menu hides "Profil einreichen"
4. ✓ KI-Match dropdown shows for available resource
5. ✓ KI-Match area shows placeholder for unavailable resource
6. ✓ Resource becomes beauftragt while user is on page (after reload): options disappear
7. ✓ Direct API call with unavailable resource: 403 response
8. ✓ After end_date passes: resource reappears on page reload

---

## Component Changes Summary

| Component | Change | Impact |
|-----------|--------|--------|
| `src/app/pool/page.tsx` | Add beauftragungen fetch, add filtering logic to menu/dropdown rendering | Medium — existing page, additive logic |
| Context menu render | Conditionally omit "Profil einreichen" | Low — conditional render |
| KI-Match panel | Replace dropdown with placeholder when unavailable | Medium — visual change |
| Submit endpoints (API) | Add availability validation | Low — security check, no UI change |

---

## Success Criteria

- [ ] Agents cannot see "Profil einreichen" option for beauftragte/nicht verfügbare resources
- [ ] Agents cannot see "Vakanz wählen..." dropdown for beauftragte/nicht verfügbare resources
- [ ] Server rejects submission attempts (403) if resource state changed
- [ ] Resources reappear after beauftragung end date passes
- [ ] All existing functionality for available resources works as before
- [ ] Tests pass (unit + integration)

---

## Future Considerations

- Real-time availability updates (WebSocket listener) — currently not required, page reload sufficient
- Tooltip/explanation when hovering near hidden options — out of scope, options are hidden entirely per spec
- Bulk availability check API — can optimize later if performance issues arise
