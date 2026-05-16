# Gruppe B — Expand View Redesign + Clickable Vakanz Links

## Goal

When a resource row is expanded in the Freelancer-Pool table (both Manager and Agentur views), the inline expand panel should show a properly structured mini-table with full vacancy details, and the Vakanz name should navigate to `/vakanzen/[id]` on click.

## Architecture

Two independent UI-only changes, no API or database modifications required. The links endpoint (`GET /api/ressourcen/[id]/links`) already returns all needed fields: `id`, `rolle`, `status`, `erfahrungslevel`, `arbeitsmodell`, `standort`, `branche`, `startdatum`, `enddatum`, `interview_datum`.

## Files

- Modify: `src/app/ressourcen/page.tsx` — update `VakanzLink.vakanzen_data` type, re-add `useRouter`, replace compact div expand row with a mini-table
- Modify: `src/app/pool/page.tsx` — wrap Vakanz name cell in a clickable button that navigates to `/vakanzen/[id]`

## Changes in Detail

### `src/app/ressourcen/page.tsx`

**Type update** — extend `vakanzen_data` in the `VakanzLink` interface:

```ts
vakanzen_data: {
  id: string
  rolle: string
  status: string
  erfahrungslevel?: string | null
  arbeitsmodell?: string | null
  standort?: string | null
  branche?: string | null
  startdatum?: string | null
  enddatum?: string | null
} | null
```

**Re-add `useRouter`** — import `useRouter` from `next/navigation` and add `const router = useRouter()` inside `RessourcenPage`.

**Replace expand row** — the current expand row (compact flex div list) becomes a mini-table matching the pool page:

```tsx
{isExpanded && (
  <TableRow className="bg-muted/30 hover:bg-muted/30">
    <TableCell colSpan={8} className="px-6 py-0">
      {isLoadingLinks ? (
        <div className="py-3 text-xs text-muted-foreground">Lädt…</div>
      ) : cachedLinks.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">Noch auf keine Vakanz gespielt.</p>
      ) : (
        <div className="py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1.5 pr-4 text-left font-medium">Vakanz</th>
                <th className="py-1.5 pr-4 text-left font-medium">Status</th>
                <th className="py-1.5 pr-4 text-left font-medium">Level</th>
                <th className="py-1.5 pr-4 text-left font-medium">Standort/Remote</th>
                <th className="py-1.5 pr-4 text-left font-medium">Sektor</th>
                <th className="py-1.5 pr-4 text-left font-medium">Start</th>
                <th className="py-1.5 text-left font-medium">Ende</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {cachedLinks.map((link) => {
                const vd = link.vakanzen_data
                const standortLabel = [vd?.arbeitsmodell, vd?.standort].filter(Boolean).join(' · ') || '—'
                return (
                  <tr key={link.id}>
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      <button
                        className="text-left hover:underline focus:outline-none"
                        onClick={(e) => { e.stopPropagation(); router.push(`/vakanzen/${link.vakanz_id}`) }}
                      >
                        {vd?.rolle ?? '—'}
                      </button>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${linkStatusColors[link.status]}`}>
                        {link.status}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{vd?.erfahrungslevel ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{standortLabel}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">{vd?.branche ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      {vd?.startdatum ? new Date(vd.startdatum).toLocaleDateString('de-DE') : '—'}
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {vd?.enddatum ? new Date(vd.enddatum).toLocaleDateString('de-DE') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TableCell>
  </TableRow>
)}
```

### `src/app/pool/page.tsx`

In the expand row's `<tbody>`, the first `<td>` currently renders `{vd?.rolle ?? '—'}` as plain text. Wrap it in a clickable button:

```tsx
<td className="py-1.5 pr-4 font-medium text-foreground">
  <button
    className="text-left hover:underline focus:outline-none"
    onClick={(e) => { e.stopPropagation(); router.push(`/vakanzen/${l.vakanz_id}`) }}
  >
    {vd?.rolle ?? '—'}
  </button>
</td>
```

`useRouter` is already imported and used in `pool/page.tsx`.

## Error Handling

- If `vakanzen_data` is null, all cells fall back to `'—'` — no crash.
- `e.stopPropagation()` on the button prevents the click from bubbling to the row's expand toggle.

## Testing

- TypeScript check (`npx tsc --noEmit`) must pass.
- No unit tests needed — pure UI rendering change with no logic.
