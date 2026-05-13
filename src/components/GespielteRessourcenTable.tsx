'use client'

import { type PoolRessource } from './ressource-einsetzen-dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface GespielteRessourcenTableProps {
  resources: PoolRessource[]
  onWithdraw?: (resource: PoolRessource) => void
}

export function GespielteRessourcenTable({ resources, onWithdraw }: GespielteRessourcenTableProps) {
  const formatDate = (isoDate: string | null | undefined) => {
    if (!isoDate) return '-'
    return new Date(isoDate).toLocaleDateString('de-DE')
  }

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'bg-gray-100 text-gray-700 border-gray-200'
    if (score >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (score >= 50) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-rose-100 text-rose-700 border-rose-200'
  }

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'Gespielt':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'In Prüfung':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'Abgelehnt':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted border-b border-border">
        <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gespielt am</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Match Score</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
        <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Aktion</div>
      </div>

      {/* Data Rows */}
      <div className="divide-y divide-border">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-accent/50 transition-colors duration-200 group"
          >
            {/* Name + Level */}
            <div className="col-span-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">{resource.name}</p>
                <p className="text-xs text-muted-foreground">{resource.erfahrungslevel}</p>
              </div>
            </div>

            {/* Gespielt am */}
            <div className="col-span-2">
              <p className="text-sm text-foreground">{formatDate(resource.link_created_at)}</p>
            </div>

            {/* Match Score */}
            <div className="col-span-2">
              <span className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold ${getScoreColor(resource.ki_score)}`}>
                {resource.ki_score !== null && resource.ki_score !== undefined ? `${Math.round(resource.ki_score)}` : '-'}
              </span>
            </div>

            {/* Status */}
            <div className="col-span-2">
              <span className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium ${getStatusColor(resource.link_status)}`}>
                {resource.link_status || '-'}
              </span>
            </div>

            {/* Action */}
            <div className="col-span-3 flex justify-end">
              {resource.link_id && resource.link_status === 'Gespielt' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  onClick={() => onWithdraw?.(resource)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline text-xs">Zurückziehen</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
