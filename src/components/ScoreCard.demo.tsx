/**
 * ScoreCard Component Demo
 *
 * This file demonstrates different use cases and configurations for the ScoreCard component.
 * Shows high match, low match, and warning states with various skill combinations.
 */

import { ScoreCard } from './ScoreCard'

export function ScoreCardDemos() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="mb-4 text-2xl font-bold">ScoreCard Component Demos</h2>
        <p className="mb-6 text-muted-foreground">
          KI-Score und Skill-Matching-Ergebnisse in verschiedenen Szenarien
        </p>
      </div>

      {/* High Match Example */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Beispiel 1: Hoher Abgleich (85%)</h3>
        <p className="text-sm text-muted-foreground">
          Kandidat erfüllt die meisten Anforderungen
        </p>
        <div className="max-w-sm">
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
            showWarning={true}
          />
        </div>
      </div>

      {/* Medium Match Example */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Beispiel 2: Mittlerer Abgleich (67%)</h3>
        <p className="text-sm text-muted-foreground">
          Kandidat erfüllt etwa zwei Drittel der Anforderungen
        </p>
        <div className="max-w-sm">
          <ScoreCard
            matchedCount={4}
            requiredCount={6}
            matchedSkills={[
              'React',
              'TypeScript',
              'PostgreSQL',
              'Tailwind CSS',
            ]}
            missingSkills={['Node.js', 'GraphQL']}
            showWarning={true}
          />
        </div>
      </div>

      {/* Low Match Example with Warning */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Beispiel 3: Niedriger Abgleich (25%) mit Warnung</h3>
        <p className="text-sm text-muted-foreground">
          Kandidat erfüllt weniger als 30% der Anforderungen
        </p>
        <div className="max-w-sm">
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
        </div>
      </div>

      {/* Low Match Example without Warning */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Beispiel 4: Niedriger Abgleich (20%) ohne Warnung</h3>
        <p className="text-sm text-muted-foreground">
          showWarning prop ist false – keine Warnung angezeigt, obwohl Score niedrig ist
        </p>
        <div className="max-w-sm">
          <ScoreCard
            matchedCount={1}
            requiredCount={5}
            matchedSkills={['React']}
            missingSkills={['TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL']}
            showWarning={false}
          />
        </div>
      </div>

      {/* Perfect Match Example */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Beispiel 5: Perfekter Abgleich (100%)</h3>
        <p className="text-sm text-muted-foreground">
          Kandidat erfüllt alle Anforderungen
        </p>
        <div className="max-w-sm">
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
            showWarning={true}
          />
        </div>
      </div>

      {/* No Skills Matched Example */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Beispiel 6: Keine Skills zutreffend (0%)</h3>
        <p className="text-sm text-muted-foreground">
          Kandidat erfüllt keine der Anforderungen
        </p>
        <div className="max-w-sm">
          <ScoreCard
            matchedCount={0}
            requiredCount={4}
            matchedSkills={[]}
            missingSkills={[
              'React',
              'TypeScript',
              'PostgreSQL',
              'GraphQL',
            ]}
            showWarning={true}
          />
        </div>
      </div>

      {/* Component API Reference */}
      <div className="mt-12 space-y-4 border-t pt-8">
        <h3 className="text-lg font-semibold">Component API</h3>
        <div className="space-y-2 text-sm">
          <div>
            <p className="font-medium">Props Interface:</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-4 text-xs">
{`interface ScoreCardProps {
  matchedCount: number       // Anzahl der übereinstimmenden Skills
  requiredCount: number      // Gesamtzahl erforderlicher Skills
  matchedSkills: string[]    // Array von übereinstimmenden Skill-Namen
  missingSkills: string[]    // Array von fehlenden Skill-Namen
  showWarning?: boolean      // Optional: Warnung bei Score < 30% (Standard: true)
}`}
            </pre>
          </div>

          <div className="mt-4">
            <p className="font-medium">Verwendungsbeispiel:</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-4 text-xs">
{`import { ScoreCard } from '@/components/ScoreCard'

export function MyComponent() {
  return (
    <ScoreCard
      matchedCount={4}
      requiredCount={6}
      matchedSkills={['React', 'TypeScript', 'Node.js', 'PostgreSQL']}
      missingSkills={['GraphQL', 'Docker']}
      showWarning={true}
    />
  )
}`}
            </pre>
          </div>

          <div className="mt-4">
            <p className="font-medium">Scoring Logic:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                Score berechnet sich als: <code className="rounded bg-muted px-1">(matchedCount / requiredCount) * 100</code>
              </li>
              <li>
                Score wird auf ganze Zahl gerundet
              </li>
              <li>
                Warnung wird angezeigt wenn Score {'<'} 30% und showWarning={`true`}
              </li>
              <li>
                Grüne Färbung bei Score {'>'} 30%, gelbe Färbung bei niedrigem Score
              </li>
            </ul>
          </div>

          <div className="mt-4">
            <p className="font-medium">Styling Features:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                Responsive Layout (mobile bis desktop)
              </li>
              <li>
                Dark Mode Support via Tailwind dark: prefix
              </li>
              <li>
                Gradient Hintergrund basierend auf Match-Qualität
              </li>
              <li>
                Icon-basierte visuelle Hierarchie (Tabler Icons)
              </li>
              <li>
                Farb-Coded Skill-Pills (grün für zutreffend, rot für fehlend)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
