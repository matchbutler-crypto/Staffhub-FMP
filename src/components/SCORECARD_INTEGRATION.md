# ScoreCard Integration Guide

Quick reference for integrating the ScoreCard component into pages and features.

## Import

```typescript
import { ScoreCard } from '@/components/ScoreCard'
```

## Basic Integration Pattern

### Step 1: Fetch Score Data

```typescript
// src/lib/api/scoring.ts
export async function getProfileKIScore(profileId: string) {
  const response = await fetch(
    `/api/profiles/${profileId}/ki-match`
  )
  return response.json()
  // Returns: { matched_count, required_count, matched_skills, missing_skills }
}
```

### Step 2: Render Component

```typescript
// src/app/profile/[id]/page.tsx
import { ScoreCard } from '@/components/ScoreCard'
import { getProfileKIScore } from '@/lib/api/scoring'

export default async function ProfilePage({ params }) {
  const scoreData = await getProfileKIScore(params.id)

  return (
    <div className="grid gap-6">
      <ScoreCard
        matchedCount={scoreData.matched_count}
        requiredCount={scoreData.required_count}
        matchedSkills={scoreData.matched_skills}
        missingSkills={scoreData.missing_skills}
      />
    </div>
  )
}
```

## Integration in Common Layouts

### 1. Profile Detail Page (Full Width)

```tsx
<section className="space-y-4">
  <h2 className="text-lg font-semibold">Qualifikationsmatch</h2>
  <div className="max-w-2xl">
    <ScoreCard {...scoreData} />
  </div>
  <div className="space-y-2 text-sm">
    <p className="text-muted-foreground">
      Score basiert auf Vergleich der Kandidaten-Skills mit Vakanz-Anforderungen
    </p>
  </div>
</section>
```

### 2. Profile List / Table

```tsx
{profiles.map((profile) => (
  <div key={profile.id} className="grid grid-cols-[1fr_300px] gap-4 border-b pb-4">
    <div>
      <h3 className="font-semibold">{profile.name}</h3>
      <p className="text-sm text-muted-foreground">{profile.title}</p>
    </div>
    <div className="scale-75 origin-top-right">
      <ScoreCard
        matchedCount={profile.kiScore.matched_count}
        requiredCount={profile.kiScore.required_count}
        matchedSkills={profile.kiScore.matched_skills}
        missingSkills={profile.kiScore.missing_skills}
      />
    </div>
  </div>
))}
```

### 3. Vacancy Profile Submissions

```tsx
// src/app/vakanzen/[id]/profiles/page.tsx
import { ScoreCard } from '@/components/ScoreCard'

export default async function VacancyProfiles({ params }) {
  const profiles = await getVacancyProfiles(params.id)

  return (
    <div className="space-y-4">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className="border rounded-lg p-6 space-y-4 hover:bg-muted/50 transition"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{profile.name}</h3>
              <p className="text-sm text-muted-foreground">
                {profile.level} • {profile.availability}h/week
              </p>
            </div>
            <Link href={`/profile/${profile.id}`} className="text-primary underline">
              Details
            </Link>
          </div>

          <div className="max-w-sm">
            <ScoreCard
              matchedCount={profile.kiScore.matched_count}
              requiredCount={profile.kiScore.required_count}
              matchedSkills={profile.kiScore.matched_skills}
              missingSkills={profile.kiScore.missing_skills}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button size="sm">Akzeptieren</Button>
            <Button size="sm" variant="outline">
              Ablehnen
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 4. Manager Dashboard

```tsx
// src/app/dashboard/page.tsx
import { ScoreCard } from '@/components/ScoreCard'

export default async function Dashboard() {
  const stats = await getManagerStats()

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Card 1: Overall Vacancy Match */}
      <div className="space-y-4">
        <h3 className="font-semibold">Durchschn. Abgleich</h3>
        <ScoreCard
          matchedCount={Math.round(stats.avgMatchedSkills)}
          requiredCount={stats.totalRequiredSkills}
          matchedSkills={stats.commonMatchedSkills}
          missingSkills={stats.commonMissingSkills}
        />
      </div>

      {/* Card 2: Vacancy Specific */}
      {stats.vacancies.map((vacancy) => (
        <div key={vacancy.id} className="space-y-4">
          <h3 className="font-semibold text-sm">{vacancy.title}</h3>
          <ScoreCard {...vacancy.avgScore} />
        </div>
      ))}
    </div>
  )
}
```

### 5. Pool Matching (Before Submission)

```tsx
// src/app/pool/[id]/match/page.tsx
import { ScoreCard } from '@/components/ScoreCard'

export default async function PoolResourceMatch({ params }) {
  const resource = await getPoolResource(params.id)
  const vacancy = await getVacancy(searchParams.vacancyId)
  const matchScore = await calculateMatch(resource, vacancy)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Match Vorschau</h1>
        <p className="text-muted-foreground">
          {resource.name} → {vacancy.title}
        </p>
      </div>

      <ScoreCard {...matchScore} />

      {matchScore.missing_skills.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            Hinweis
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Diese Ressource erfüllt nicht alle erforderlichen Skills. Sie können sie trotzdem
            einreichen – der Manager wird die Lücken sehen.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={() => submitProfile()}>
          Trotzdem Einreichen
        </Button>
        <Button variant="outline">
          Zurück
        </Button>
      </div>
    </div>
  )
}
```

## API Contract Expected

The component expects data in this format:

```typescript
interface KIScoreData {
  matched_count: number
  required_count: number
  matched_skills: string[]
  missing_skills: string[]
}

// Example response
{
  "matched_count": 4,
  "required_count": 6,
  "matched_skills": ["React", "TypeScript", "Node.js", "PostgreSQL"],
  "missing_skills": ["GraphQL", "Docker"]
}
```

## Styling in Different Contexts

### Contained Width (Modal, Sidebar)

```tsx
<div className="max-w-sm">
  <ScoreCard {...scoreData} />
</div>
```

### Full Width (Page)

```tsx
<div className="max-w-2xl">
  <ScoreCard {...scoreData} />
</div>
```

### Compact Display (List Item)

```tsx
<div className="scale-90 origin-top-left">
  <ScoreCard {...scoreData} />
</div>
```

### Multiple in Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {scores.map((score) => (
    <ScoreCard key={score.id} {...score} />
  ))}
</div>
```

## Dynamic Updates

### Re-fetch Score on Profile Change

```tsx
'use client'

import { useState } from 'react'
import { ScoreCard } from '@/components/ScoreCard'

export function ProfileMatcher({ vacancyId, profileId }) {
  const [scoreData, setScoreData] = useState(null)
  const [loading, setLoading] = useState(false)

  async function refreshScore() {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/match?vacancy=${vacancyId}&profile=${profileId}`
      )
      setScoreData(await response.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {scoreData && <ScoreCard {...scoreData} />}
      <Button onClick={refreshScore} disabled={loading}>
        {loading ? 'Calculating...' : 'Recalculate'}
      </Button>
    </div>
  )
}
```

## Conditional Rendering

### Show Only for Managers

```tsx
{userRole === 'manager' && (
  <ScoreCard {...scoreData} />
)}
```

### Show with Warning Only in Certain States

```tsx
<ScoreCard
  {...scoreData}
  showWarning={status === 'submitted'} // Only show warning for new submissions
/>
```

### Hide for Archived Profiles

```tsx
{!profile.archived && (
  <ScoreCard {...scoreData} />
)}
```

## Performance Considerations

### Memoization (for Lists)

```tsx
import { memo } from 'react'

const ProfileScoreCard = memo(({ profileId, scoreData }) => (
  <ScoreCard {...scoreData} />
))

export default ProfileScoreCard
```

### Lazy Loading

```tsx
import dynamic from 'next/dynamic'

const ScoreCard = dynamic(
  () => import('@/components/ScoreCard').then((mod) => mod.ScoreCard),
  { loading: () => <div className="h-48 animate-pulse" /> }
)
```

## Testing in Integration

```typescript
// Example test for a component using ScoreCard
import { render, screen } from '@testing-library/react'
import { ProfilePage } from './page'

jest.mock('@/lib/api/scoring', () => ({
  getProfileKIScore: () =>
    Promise.resolve({
      matched_count: 4,
      required_count: 6,
      matched_skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      missing_skills: ['GraphQL', 'Docker'],
    }),
}))

it('should display score card with correct data', async () => {
  render(<ProfilePage params={{ id: '123' }} />)

  expect(await screen.findByText('67%')).toBeInTheDocument()
  expect(screen.getByText('React')).toBeInTheDocument()
})
```

## Troubleshooting Integration

### Score Not Showing
- Check that `requiredCount` > 0 (avoid division by zero)
- Verify API is returning correct JSON structure
- Check browser console for import errors

### Skills Lists Empty
- Verify `matchedSkills` and `missingSkills` are properly populated
- Check that empty arrays still render the sections (they won't, by design)
- Use the demo page to test with sample data

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check that dark mode CSS variables are set if using dark theme
- Verify no CSS conflicts from other stylesheets

### Responsive Problems
- Test on different screen sizes (use Chrome DevTools)
- Check that parent container isn't constraining width
- Use `max-w-*` utilities to set appropriate widths

---

**Next Step**: Review `/src/components/ScoreCard.tsx` for additional customization options or check `SCORECARD.md` for detailed documentation.
