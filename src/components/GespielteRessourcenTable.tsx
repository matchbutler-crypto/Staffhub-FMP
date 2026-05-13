'use client'

import { type PoolRessource } from './ressource-einsetzen-dialog'
import { Button } from '@/components/ui/button'
import { VERFUEGBARKEIT_COLORS } from './ressource-einsetzen-dialog'
import { Trash2 } from 'lucide-react'

interface GespielteRessourcenTableProps {
  resources: PoolRessource[]
  onWithdraw?: (resource: PoolRessource) => void
}

export function GespielteRessourcenTable({ resources, onWithdraw }: GespielteRessourcenTableProps) {
  const getStatusLabel = (linkStatus: string | null | undefined) => {
    if (!linkStatus) return '-'
    return linkStatus
  }

  const getAvailabilityDate = (availability: string) => {
    // Extract date from "Verfügbar ab dd.mm.yyyy" format
    const match = availability.match(/(\d{2}\.\d{2}\.\d{4})/)
    return match ? match[1] : availability
  }

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted border-b border-border">
        <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verfügbar ab</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
        <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Skills</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Action</div>
      </div>

      {/* Data Rows */}
      <div className="divide-y divide-border">
        {resources.map((resource, idx) => (
          <div
            key={resource.id}
            className="grid grid-cols-12 gap-4 px-5 py-4 items-start hover:bg-accent/50 transition-colors duration-200 group"
          >
            {/* Name */}
            <div className="col-span-3">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground leading-tight">{resource.name}</p>
                <p className="text-xs text-muted-foreground">{resource.erfahrungslevel}</p>
              </div>
            </div>

            {/* Verfügbar ab */}
            <div className="col-span-2">
              <div
                className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                  VERFUEGBARKEIT_COLORS[resource.verfuegbarkeit] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {resource.verfuegbarkeit === 'Jetzt verfügbar' ? 'Sofort' : getAvailabilityDate(resource.verfuegbarkeit)}
              </div>
            </div>

            {/* Status */}
            <div className="col-span-2">
              <span className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                {getStatusLabel(resource.link_status)}
              </span>
            </div>

            {/* Skills */}
            <div className="col-span-3">
              <div className="flex flex-wrap gap-1">
                {resource.skills.slice(0, 3).map((skill) => (
                  <span key={skill} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                    {skill}
                  </span>
                ))}
                {resource.skills.length > 3 && (
                  <span className="text-xs text-muted-foreground font-medium px-2 py-1">
                    +{resource.skills.length - 3} mehr
                  </span>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="col-span-2 flex justify-end">
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
