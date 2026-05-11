'use client'

import React from 'react'
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ScoreCardProps {
  matchedCount: number
  requiredCount: number
  matchedSkills: string[]
  missingSkills: string[]
  showWarning?: boolean
}

export function ScoreCard({
  matchedCount,
  requiredCount,
  matchedSkills,
  missingSkills,
  showWarning = true,
}: ScoreCardProps) {
  const score = Math.round((matchedCount / requiredCount) * 100)
  const isLowMatch = score < 30

  // Determine score styling based on performance
  const scoreColor =
    isLowMatch && showWarning
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-green-600 dark:text-green-400'

  const scoreBgGradient =
    isLowMatch && showWarning
      ? 'from-yellow-50/50 to-yellow-100/30 dark:from-yellow-950/30 dark:to-yellow-900/20'
      : 'from-green-50/50 to-green-100/30 dark:from-green-950/30 dark:to-green-900/20'

  return (
    <Card className={cn('w-full overflow-hidden', `bg-gradient-to-br ${scoreBgGradient}`)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          KI-Score
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Score Display Section */}
        <div className="flex items-end gap-4">
          <div className="flex flex-col items-start gap-1">
            <div className={cn('text-5xl font-bold tabular-nums', scoreColor)}>
              {score}%
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {matchedCount} von {requiredCount} Skills
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            variant={isLowMatch && showWarning ? 'destructive' : 'default'}
            className="ml-auto"
          >
            {isLowMatch && showWarning ? (
              <>
                <IconAlertCircle className="mr-1 h-3 w-3" />
                Warnung
              </>
            ) : (
              <>
                <IconCheck className="mr-1 h-3 w-3" />
                Passend
              </>
            )}
          </Badge>
        </div>

        {/* Low Match Warning */}
        {isLowMatch && showWarning && (
          <Alert variant="destructive" className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/20">
            <IconAlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              Niedriger Abgleich – erfüllt möglicherweise nicht die Anforderungen
            </AlertDescription>
          </Alert>
        )}

        {/* Matched Skills Section */}
        {matchedSkills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground">
              Zutreffende Skills
            </h4>
            <div className="flex flex-wrap gap-2">
              {matchedSkills.map((skill) => (
                <div
                  key={skill}
                  className="inline-flex items-center gap-2 rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300"
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  {skill}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Skills Section */}
        {missingSkills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground">
              Fehlende Skills
            </h4>
            <div className="flex flex-wrap gap-2">
              {missingSkills.map((skill) => (
                <div
                  key={skill}
                  className="inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                >
                  <IconX className="h-3.5 w-3.5" />
                  {skill}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {matchedSkills.length === 0 && missingSkills.length === 0 && (
          <div className="rounded-md bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Keine Skills vorhanden
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
