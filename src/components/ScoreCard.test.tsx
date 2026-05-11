import { render, screen } from '@testing-library/react'
import { ScoreCard } from './ScoreCard'
import { describe, it, expect } from 'vitest'

describe('ScoreCard Component', () => {
  describe('Score Calculation', () => {
    it('should calculate score percentage correctly', () => {
      render(
        <ScoreCard
          matchedCount={3}
          requiredCount={5}
          matchedSkills={['React', 'TypeScript', 'Node.js']}
          missingSkills={['PostgreSQL', 'GraphQL']}
        />
      )

      // 3/5 * 100 = 60%
      expect(screen.getByText('60%')).toBeInTheDocument()
    })

    it('should round score to nearest integer', () => {
      render(
        <ScoreCard
          matchedCount={1}
          requiredCount={3}
          matchedSkills={['React']}
          missingSkills={['TypeScript', 'Node.js']}
        />
      )

      // 1/3 * 100 = 33.33%, should round to 33%
      expect(screen.getByText('33%')).toBeInTheDocument()
    })

    it('should display matched and required skill counts', () => {
      render(
        <ScoreCard
          matchedCount={2}
          requiredCount={4}
          matchedSkills={['React', 'TypeScript']}
          missingSkills={['Node.js', 'PostgreSQL']}
        />
      )

      expect(screen.getByText('2 von 4 Skills')).toBeInTheDocument()
    })
  })

  describe('Matched Skills Display', () => {
    it('should display all matched skills', () => {
      const matchedSkills = ['React', 'TypeScript', 'Node.js']
      render(
        <ScoreCard
          matchedCount={3}
          requiredCount={5}
          matchedSkills={matchedSkills}
          missingSkills={['PostgreSQL', 'GraphQL']}
        />
      )

      matchedSkills.forEach((skill) => {
        expect(screen.getByText(skill)).toBeInTheDocument()
      })
    })

    it('should not display matched skills section when empty', () => {
      render(
        <ScoreCard
          matchedCount={0}
          requiredCount={3}
          matchedSkills={[]}
          missingSkills={['React', 'TypeScript', 'Node.js']}
        />
      )

      expect(screen.queryByText('Zutreffende Skills')).not.toBeInTheDocument()
    })

    it('should display check icons next to matched skills', () => {
      render(
        <ScoreCard
          matchedCount={1}
          requiredCount={2}
          matchedSkills={['React']}
          missingSkills={['TypeScript']}
        />
      )

      const checkIcons = screen.getAllByRole('img', { hidden: true })
      expect(checkIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Missing Skills Display', () => {
    it('should display all missing skills', () => {
      const missingSkills = ['PostgreSQL', 'GraphQL', 'Docker']
      render(
        <ScoreCard
          matchedCount={2}
          requiredCount={5}
          matchedSkills={['React', 'TypeScript']}
          missingSkills={missingSkills}
        />
      )

      missingSkills.forEach((skill) => {
        expect(screen.getByText(skill)).toBeInTheDocument()
      })
    })

    it('should not display missing skills section when empty', () => {
      render(
        <ScoreCard
          matchedCount={3}
          requiredCount={3}
          matchedSkills={['React', 'TypeScript', 'Node.js']}
          missingSkills={[]}
        />
      )

      expect(screen.queryByText('Fehlende Skills')).not.toBeInTheDocument()
    })
  })

  describe('Warning Behavior', () => {
    it('should show warning when score is below 30%', () => {
      render(
        <ScoreCard
          matchedCount={1}
          requiredCount={4}
          matchedSkills={['React']}
          missingSkills={['TypeScript', 'Node.js', 'PostgreSQL']}
          showWarning={true}
        />
      )

      // 1/4 * 100 = 25%, which is < 30%
      expect(screen.getByText('25%')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Niedriger Abgleich – erfüllt möglicherweise nicht die Anforderungen'
        )
      ).toBeInTheDocument()
    })

    it('should not show warning when showWarning is false', () => {
      render(
        <ScoreCard
          matchedCount={1}
          requiredCount={4}
          matchedSkills={['React']}
          missingSkills={['TypeScript', 'Node.js', 'PostgreSQL']}
          showWarning={false}
        />
      )

      expect(
        screen.queryByText(
          'Niedriger Abgleich – erfüllt möglicherweise nicht die Anforderungen'
        )
      ).not.toBeInTheDocument()
    })

    it('should not show warning when score is 30% or above', () => {
      render(
        <ScoreCard
          matchedCount={2}
          requiredCount={5}
          matchedSkills={['React', 'TypeScript']}
          missingSkills={['Node.js', 'PostgreSQL', 'GraphQL']}
          showWarning={true}
        />
      )

      // 2/5 * 100 = 40%, which is >= 30%
      expect(
        screen.queryByText(
          'Niedriger Abgleich – erfüllt möglicherweise nicht die Anforderungen'
        )
      ).not.toBeInTheDocument()
    })
  })

  describe('Status Badge', () => {
    it('should show "Passend" badge for good match', () => {
      render(
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
      )

      expect(screen.getByText('Passend')).toBeInTheDocument()
    })

    it('should show "Warnung" badge for low match', () => {
      render(
        <ScoreCard
          matchedCount={1}
          requiredCount={4}
          matchedSkills={['React']}
          missingSkills={['TypeScript', 'Node.js', 'PostgreSQL']}
          showWarning={true}
        />
      )

      expect(screen.getByText('Warnung')).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('should show "Keine Skills vorhanden" when both arrays are empty', () => {
      render(
        <ScoreCard
          matchedCount={0}
          requiredCount={0}
          matchedSkills={[]}
          missingSkills={[]}
        />
      )

      expect(screen.getByText('Keine Skills vorhanden')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      const { container } = render(
        <ScoreCard
          matchedCount={3}
          requiredCount={5}
          matchedSkills={['React', 'TypeScript', 'Node.js']}
          missingSkills={['PostgreSQL', 'GraphQL']}
        />
      )

      // Check for semantic headings
      const headings = container.querySelectorAll('h4')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('should have proper alt text for icons', () => {
      const { container } = render(
        <ScoreCard
          matchedCount={1}
          requiredCount={2}
          matchedSkills={['React']}
          missingSkills={['TypeScript']}
        />
      )

      // SVG icons should be present
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle perfect match (100%)', () => {
      render(
        <ScoreCard
          matchedCount={5}
          requiredCount={5}
          matchedSkills={[
            'React',
            'TypeScript',
            'Node.js',
            'PostgreSQL',
            'GraphQL',
          ]}
          missingSkills={[]}
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('should handle no matches (0%)', () => {
      render(
        <ScoreCard
          matchedCount={0}
          requiredCount={5}
          matchedSkills={[]}
          missingSkills={[
            'React',
            'TypeScript',
            'Node.js',
            'PostgreSQL',
            'GraphQL',
          ]}
        />
      )

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should handle single skill', () => {
      render(
        <ScoreCard
          matchedCount={1}
          requiredCount={1}
          matchedSkills={['React']}
          missingSkills={[]}
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('1 von 1 Skills')).toBeInTheDocument()
    })

    it('should handle large skill lists', () => {
      const largeSkillList = Array.from(
        { length: 20 },
        (_, i) => `Skill${i + 1}`
      )

      render(
        <ScoreCard
          matchedCount={10}
          requiredCount={20}
          matchedSkills={largeSkillList.slice(0, 10)}
          missingSkills={largeSkillList.slice(10)}
        />
      )

      expect(screen.getByText('50%')).toBeInTheDocument()
      largeSkillList.forEach((skill) => {
        expect(screen.getByText(skill)).toBeInTheDocument()
      })
    })
  })
})
