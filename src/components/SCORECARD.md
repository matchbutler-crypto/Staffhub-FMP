# ScoreCard Component

A production-grade React component that displays KI-Score (AI matching score) and skill matching results in a visually striking, responsive card format.

## Overview

The `ScoreCard` component is designed to present skill matching data in a clear, actionable way. It displays:
- Large, prominent percentage score (0-100%)
- Matched skills count (e.g., "2 of 5 skills match")
- Visual lists of matched skills (green with checkmarks)
- Visual lists of missing skills (red with X marks)
- Warning alert when match score is below 30%
- Status badge indicating overall match quality

## Design Philosophy

This component follows a **modern data visualization** aesthetic with emphasis on impact and clarity:
- **Hierarchy**: Large score dominates attention, supporting details follow
- **Color Coding**: Green for positive (matched skills), Red for negative (missing skills), Yellow for warnings
- **Visual Feedback**: Icons (checkmark, X, alert) provide instant recognition
- **Responsive**: Adapts gracefully from mobile (375px) to desktop (1440px+)
- **Accessibility**: Proper semantic HTML, ARIA labels, and sufficient color contrast
- **Dark Mode**: Full support via Tailwind's `dark:` prefix

## Component API

### Props

```typescript
interface ScoreCardProps {
  matchedCount: number       // Number of skills that matched (required)
  requiredCount: number      // Total number of required skills (required)
  matchedSkills: string[]    // Array of matched skill names (required)
  missingSkills: string[]    // Array of missing skill names (required)
  showWarning?: boolean      // Show warning when score < 30% (optional, default: true)
}
```

### Props Details

| Prop | Type | Required | Description | Example |
|------|------|----------|-------------|---------|
| `matchedCount` | `number` | Yes | Count of successfully matched skills | `4` |
| `requiredCount` | `number` | Yes | Total count of required skills | `6` |
| `matchedSkills` | `string[]` | Yes | Array of skill names that match | `['React', 'TypeScript']` |
| `missingSkills` | `string[]` | Yes | Array of skill names that are missing | `['GraphQL', 'Docker']` |
| `showWarning` | `boolean` | No | Display warning when score < 30% (default: true) | `true` \| `false` |

## Usage Examples

### Basic Usage

```tsx
import { ScoreCard } from '@/components/ScoreCard'

export function ProfileMatch() {
  return (
    <ScoreCard
      matchedCount={4}
      requiredCount={6}
      matchedSkills={['React', 'TypeScript', 'Node.js', 'PostgreSQL']}
      missingSkills={['GraphQL', 'Docker']}
    />
  )
}
```

### High Match (85%)

```tsx
<ScoreCard
  matchedCount={5}
  requiredCount={6}
  matchedSkills={[
    'React',
    'TypeScript',
    'Node.js',
    'PostgreSQL',
    'Tailwind CSS',
  ]}
  missingSkills={['GraphQL']}
/>
```

**Result**: Green score, "Passend" badge, no warning

### Medium Match (67%)

```tsx
<ScoreCard
  matchedCount={4}
  requiredCount={6}
  matchedSkills={['React', 'TypeScript', 'PostgreSQL', 'Tailwind CSS']}
  missingSkills={['Node.js', 'GraphQL']}
/>
```

**Result**: Green score, "Passend" badge, no warning

### Low Match (25%) with Warning

```tsx
<ScoreCard
  matchedCount={2}
  requiredCount={8}
  matchedSkills={['React', 'JavaScript']}
  missingSkills={[
    'TypeScript',
    'Node.js',
    'PostgreSQL',
    'Tailwind CSS',
    'GraphQL',
    'Docker',
  ]}
  showWarning={true}
/>
```

**Result**: Yellow score, "Warnung" badge, warning message displayed

### Suppress Warning (for archived/old profiles)

```tsx
<ScoreCard
  matchedCount={1}
  requiredCount={5}
  matchedSkills={['React']}
  missingSkills={['TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL']}
  showWarning={false}  // Warning not shown even though score is 20%
/>
```

### Perfect Match (100%)

```tsx
<ScoreCard
  matchedCount={5}
  requiredCount={5}
  matchedSkills={[
    'React',
    'TypeScript',
    'Node.js',
    'PostgreSQL',
    'Tailwind CSS',
  ]}
  missingSkills={[]}
/>
```

**Result**: Green score, "Passend" badge, no warning, matched skills section only

### No Matches (0%)

```tsx
<ScoreCard
  matchedCount={0}
  requiredCount={4}
  matchedSkills={[]}
  missingSkills={['React', 'TypeScript', 'PostgreSQL', 'GraphQL']}
/>
```

**Result**: Yellow score, "Warnung" badge, warning message, missing skills section only

## Scoring Logic

The component calculates the match percentage as:

```
score = Math.round((matchedCount / requiredCount) * 100)
```

### Score Thresholds

| Score Range | Badge | Color | Warning |
|-------------|-------|-------|---------|
| 0-29% | Warnung | Yellow | Yes (if showWarning=true) |
| 30-100% | Passend | Green | No |

## Styling & Theming

### CSS Classes Used

- **Tailwind CSS** exclusively (no inline styles)
- **CVA (Class Variance Authority)** for badge/alert variants
- **CSS Variables** for theme colors (via Tailwind's color system)

### Dark Mode Support

The component automatically adapts to dark mode using Tailwind's `dark:` prefix:

```tsx
// Example dark mode colors
// Light: text-green-600, Dark: dark:text-green-400
// Light: bg-green-100, Dark: dark:bg-green-950/40
```

### Responsive Design

The component is designed to be responsive:
- **Mobile (375px)**: Full width, stacked layout
- **Tablet (768px)**: Optimized for touch, readable skill pills
- **Desktop (1440px)**: Full layout with proper spacing
- **Container Queries**: Uses CSS container queries for internal responsiveness

## Component Structure

```
ScoreCard
├── Card (shadcn/ui wrapper)
│   ├── CardHeader
│   │   └── Title: "KI-Score"
│   └── CardContent
│       ├── Score Display Section
│       │   ├── Large Score (%)
│       │   ├── Match Count
│       │   └── Status Badge (Passend / Warnung)
│       ├── Warning Alert (conditional)
│       ├── Matched Skills List (conditional)
│       ├── Missing Skills List (conditional)
│       └── Empty State (conditional)
```

## Visual Details

### Color Palette

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| High Score Text | `text-green-600` | `dark:text-green-400` |
| Low Score Text | `text-yellow-600` | `dark:text-yellow-400` |
| Background Gradient | Green-to-green | Green-950/900 opacity |
| Matched Skill Badge | `bg-green-100 text-green-700` | `dark:bg-green-950/40 dark:text-green-300` |
| Missing Skill Badge | `bg-red-100 text-red-700` | `dark:bg-red-950/40 dark:text-red-300` |
| Warning Alert | `bg-yellow-50/50` | `dark:bg-yellow-950/20` |

### Icons

Uses **Tabler Icons** (already installed in the project):
- `IconCheck` - Checkmark for matched skills
- `IconX` - X mark for missing skills
- `IconAlertCircle` - Warning indicator

### Typography

- **Score Value**: Text size `text-5xl`, font weight `font-bold`, monospace `tabular-nums`
- **Section Headers**: Text size `text-xs`, weight `font-semibold`
- **Skill Pills**: Text size `text-xs`, weight `font-medium`

## Accessibility Features

- **Semantic HTML**: Uses `<h4>` for section headers
- **ARIA**: Alert uses `role="alert"` for screen readers
- **Color Contrast**: WCAG AA compliant color combinations
- **Icon Labels**: Icons accompanied by text labels
- **Keyboard Navigation**: Full keyboard support via shadcn/ui components

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Performance

- **Bundle Size**: ~4.7 KB (uncompressed source)
- **No External Dependencies**: Uses only installed project dependencies
- **CSS-only**: No JavaScript animations (improves performance)
- **Tree-shakeable**: Unused code is eliminated during build

## Integration Points

### Data Sources

The component is typically fed data from:
- **KI Matching API**: Returns `matchedCount`, `requiredCount`, `matchedSkills`, `missingSkills`
- **Profile Database**: Retrieves skill information for a candidate
- **Vacancy Requirements**: Provides the required skills list

### Usage in Pages

Example integration in a profile detail page:

```tsx
// src/app/profile/[id]/page.tsx
import { ScoreCard } from '@/components/ScoreCard'
import { getProfileKIMatch } from '@/lib/api/profiles'

export default async function ProfilePage({ params }) {
  const kiMatch = await getProfileKIMatch(params.id)

  return (
    <div className="grid gap-6">
      <ScoreCard
        matchedCount={kiMatch.matched_count}
        requiredCount={kiMatch.required_count}
        matchedSkills={kiMatch.matched_skills}
        missingSkills={kiMatch.missing_skills}
        showWarning={true}
      />
      {/* Other profile sections */}
    </div>
  )
}
```

## Testing

The component includes comprehensive tests in `ScoreCard.test.tsx`:

### Test Coverage

- Score calculation accuracy
- Matched/missing skills display
- Warning behavior at different thresholds
- Status badge appearance
- Empty states
- Edge cases (0%, 100%, single skill, large lists)
- Accessibility requirements

### Running Tests

```bash
npm test ScoreCard
```

## Common Use Cases

### 1. Vakanz Profile Matching

Display match score when an agency submits a profile to a vacancy:

```tsx
<ScoreCard
  matchedCount={kiScores.matches}
  requiredCount={vacancy.required_skills.length}
  matchedSkills={kiScores.matched}
  missingSkills={kiScores.missing}
  showWarning={true}
/>
```

### 2. Manager Review List

Show quick match indicator in a profile list:

```tsx
{profiles.map((profile) => (
  <div key={profile.id} className="flex gap-4">
    <div className="flex-1">{profile.name}</div>
    <div className="w-80">
      <ScoreCard {...profile.kiMatch} />
    </div>
  </div>
))}
```

### 3. Dashboard Overview

Display average match scores for a vacancy:

```tsx
<ScoreCard
  matchedCount={Math.round(averageMatches)}
  requiredCount={requiredSkillsCount}
  matchedSkills={mostCommonSkills}
  missingSkills={missingSkills}
/>
```

## Troubleshooting

### Warning Not Showing

**Problem**: Warning alert doesn't appear even though score < 30%
**Solution**: Check that `showWarning={true}` is passed to the component

### Skills Not Displaying

**Problem**: Matched or missing skills arrays are empty
**Solution**: Verify the data source is providing the skill arrays correctly; empty arrays will hide their respective sections

### Style Inconsistencies in Dark Mode

**Problem**: Colors look wrong in dark mode
**Solution**: Ensure Tailwind's dark mode is enabled in `tailwind.config.ts`:
```typescript
export const darkMode = 'class'
```

### Icons Not Showing

**Problem**: Tabler icons appear as missing
**Solution**: Verify `@tabler/icons-react` is installed:
```bash
npm install @tabler/icons-react
```

## Related Components

- **Badge** (`src/components/ui/badge.tsx`) - Used for status display
- **Card** (`src/components/ui/card.tsx`) - Container component
- **Alert** (`src/components/ui/alert.tsx`) - Warning message display

## Files

| File | Purpose |
|------|---------|
| `ScoreCard.tsx` | Main component |
| `ScoreCard.test.tsx` | Unit tests with 30+ test cases |
| `ScoreCard.demo.tsx` | Usage examples and demo page |
| `SCORECARD.md` | This documentation |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05-11 | Initial production release |

## Author Notes

This component was designed with the following principles:
- **Clarity**: Large score and color-coded skills are instantly understandable
- **Usability**: Warning clearly highlights low matches without overwhelming
- **Extensibility**: Props are flexible enough for future enhancements
- **Quality**: Comprehensive tests ensure reliability

## Future Enhancements

Potential improvements for future versions:
- Animation on score display when component mounts
- Expandable skill details (showing why a skill matched/failed)
- Custom color themes via props
- Skill importance weighting (some skills worth more than others)
- Score history visualization (showing score trends over time)
- Export capability (save match results as PDF)

---

**Last Updated**: 2026-05-11  
**Component Status**: Production Ready ✓
