'use client'

import { useState } from 'react'
import { ChevronDown, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KiBewertungDisplayProps {
  score: number | null
  empfehlung?: 'Empfohlen' | 'Bedingt geeignet' | 'Nicht geeignet'
  begruendung?: string
  skillVorhanden?: string[]
  skillFehlend?: string[]
  className?: string
}

export function KiBewertungDisplay({
  score,
  empfehlung = 'Bedingt geeignet',
  begruendung = '',
  skillVorhanden = [],
  skillFehlend = [],
  className,
}: KiBewertungDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  if (score === null) {
    return (
      <div className={cn('rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground', className)}>
        Keine Bewertung
      </div>
    )
  }

  const scorePercent = Math.max(0, Math.min(100, score))
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'from-emerald-500 to-teal-600'
    if (s >= 50) return 'from-amber-500 to-orange-600'
    return 'from-rose-500 to-red-600'
  }

  const getRecommendationIcon = () => {
    switch (empfehlung) {
      case 'Empfohlen':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      case 'Bedingt geeignet':
        return <AlertCircle className="h-4 w-4 text-amber-600" />
      case 'Nicht geeignet':
        return <XCircle className="h-4 w-4 text-rose-600" />
      default:
        return null
    }
  }

  const getRecommendationColor = () => {
    switch (empfehlung) {
      case 'Empfohlen':
        return 'text-emerald-700 bg-emerald-50'
      case 'Bedingt geeignet':
        return 'text-amber-700 bg-amber-50'
      case 'Nicht geeignet':
        return 'text-rose-700 bg-rose-50'
      default:
        return 'text-gray-700 bg-gray-50'
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Score Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 transition-all hover:border-gray-300 hover:shadow-sm"
      >
        {/* Score Indicator */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-12 w-12">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                stroke={`url(#gradient-${Math.round(scorePercent)})`}
                strokeDasharray={`${(scorePercent / 100) * 283} 283`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id={`gradient-${Math.round(scorePercent)}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={scorePercent >= 70 ? '#10b981' : scorePercent >= 50 ? '#f59e0b' : '#ef4444'} />
                  <stop offset="100%" stopColor={scorePercent >= 70 ? '#14b8a6' : scorePercent >= 50 ? '#ea580c' : '#dc2626'} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-900">{scorePercent}</span>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            {getRecommendationIcon()}
            <span className="text-sm font-semibold text-gray-900">{empfehlung}</span>
          </div>
          {begruendung && <p className="text-xs text-gray-600 line-clamp-2">{begruendung}</p>}
        </div>

        {/* Expand indicator */}
        <ChevronDown
          className={cn('h-4 w-4 text-gray-400 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-3">
          {begruendung && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Bewertung</p>
              <p className="text-gray-600">{begruendung}</p>
            </div>
          )}

          {(skillVorhanden.length > 0 || skillFehlend.length > 0) && (
            <div>
              <p className="font-semibold text-gray-700 mb-2">Skills</p>
              <div className="flex flex-col gap-2">
                {skillVorhanden.length > 0 && (
                  <div>
                    <p className="text-emerald-700 font-medium mb-1">Vorhanden ({skillVorhanden.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {skillVorhanden.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="inline-block rounded-full bg-emerald-100 px-2 py-1 text-emerald-700"
                        >
                          {skill}
                        </span>
                      ))}
                      {skillVorhanden.length > 5 && (
                        <span className="inline-block text-gray-500">+{skillVorhanden.length - 5}</span>
                      )}
                    </div>
                  </div>
                )}
                {skillFehlend.length > 0 && (
                  <div>
                    <p className="text-rose-700 font-medium mb-1">Fehlend ({skillFehlend.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {skillFehlend.slice(0, 5).map((skill) => (
                        <span key={skill} className="inline-block rounded-full bg-rose-100 px-2 py-1 text-rose-700">
                          {skill}
                        </span>
                      ))}
                      {skillFehlend.length > 5 && (
                        <span className="inline-block text-gray-500">+{skillFehlend.length - 5}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
