'use client'

import { useState, useEffect, useRef } from 'react'
import { type PoolRessource } from './ressource-einsetzen-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Loader2, Info, Download } from 'lucide-react'
import { toast } from 'sonner'

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Gespielt':          ['Interview geplant', 'Abgesagt', 'Abgelehnt'],
  'Interview geplant': ['Zugesagt', 'Abgesagt', 'Abgelehnt'],
  'Zugesagt':          [],
  'Abgesagt':          [],
  'Abgelehnt':         [],
  'Zurückgezogen':     [],
}

interface GespielteRessourcenTableProps {
  resources: PoolRessource[]
  vakanzId?: string
  isManager?: boolean
  onWithdraw?: (resource: PoolRessource) => void
  onStatusChange?: (resource: PoolRessource, newStatus: string, interviewDatum?: string | null) => Promise<void>
}

export function GespielteRessourcenTable({
  resources,
  vakanzId,
  isManager,
  onWithdraw,
  onStatusChange,
}: GespielteRessourcenTableProps) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [calculating, setCalculating] = useState<Record<string, boolean>>({})
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [pendingInterviewId, setPendingInterviewId] = useState<string | null>(null)
  const [interviewDatum, setInterviewDatum] = useState<string>('')
  const calculatedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!vakanzId) return
    for (const resource of resources) {
      if (
        resource.link_status === 'Gespielt' &&
        (resource.ki_score === null || resource.ki_score === undefined) &&
        !calculatedIds.current.has(resource.id)
      ) {
        calculatedIds.current.add(resource.id)
        setCalculating((prev) => ({ ...prev, [resource.id]: true }))
        fetch(`/api/ressourcen/${resource.id}/ki-match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vakanz_id: vakanzId }),
        })
          .then((res) => res.json())
          .then((body) => {
            if (body.score?.score !== undefined) {
              setScores((prev) => ({ ...prev, [resource.id]: body.score.score }))
            }
          })
          .catch(() => {})
          .finally(() => setCalculating((prev) => ({ ...prev, [resource.id]: false })))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vakanzId, resources])

  async function handleCvDownload(resource: PoolRessource) {
    if (!resource.cv_pfad) {
      toast.error('Kein Lebenslauf vorhanden')
      return
    }
    setDownloadingId(resource.id)
    try {
      const res = await fetch(`/api/ressourcen/${resource.id}/cv`)
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'Fehler beim Laden des CVs')
        return
      }
      window.open(body.url, '_blank')
    } catch {
      toast.error('Verbindungsfehler')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleStatusSelect(resource: PoolRessource, newStatus: string) {
    if (newStatus === 'Interview geplant') {
      setPendingInterviewId(resource.id)
      setInterviewDatum('')
      return
    }
    if (!onStatusChange) return
    setUpdatingStatus(resource.id)
    try {
      await onStatusChange(resource, newStatus, null)
    } finally {
      setUpdatingStatus(null)
    }
  }

  async function handleInterviewConfirm(resource: PoolRessource) {
    if (!onStatusChange) return
    setUpdatingStatus(resource.id)
    setPendingInterviewId(null)
    try {
      await onStatusChange(resource, 'Interview geplant', interviewDatum || null)
    } finally {
      setUpdatingStatus(null)
      setInterviewDatum('')
    }
  }

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
      case 'Gespielt': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'Interview geplant': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'Zugesagt': return 'bg-green-100 text-green-700 border-green-200'
      case 'Abgesagt': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'Abgelehnt': return 'bg-red-100 text-red-700 border-red-200'
      case 'Zurückgezogen': return 'bg-gray-100 text-gray-500 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-muted border-b border-border">
        <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gespielt am</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          Match
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-help opacity-60 hover:opacity-100 transition-opacity" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
                <p className="font-semibold mb-1">Wie wird der Score berechnet?</p>
                <p>GPT-4o-mini bewertet das Kandidaten-Profil gegen die Vakanz. Es werden Skills, Erfahrungslevel und Profiltext semantisch verglichen — nicht nur exakte Treffer.</p>
                <p className="mt-1">Skala 0–100: <span className="text-emerald-600">≥ 70 = gut</span> · <span className="text-amber-600">40–69 = bedingt</span> · <span className="text-rose-600">&lt; 40 = schwach</span></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
        <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Aktion</div>
      </div>

      {/* Data Rows */}
      <div className="divide-y divide-border">
        {resources.map((resource) => {
          const displayScore = scores[resource.id] !== undefined ? scores[resource.id] : resource.ki_score
          const isCalculating = !!calculating[resource.id]
          const noScore = displayScore === null || displayScore === undefined
          const currentStatus = resource.link_status ?? 'Gespielt'
          const validNext = VALID_TRANSITIONS[currentStatus] ?? []
          const isTerminal = validNext.length === 0
          const isUpdating = updatingStatus === resource.id
          const isPendingInterview = pendingInterviewId === resource.id

          return (
            <div key={resource.id} className="group">
              <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-accent/50 transition-colors duration-200">
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
                  {isCalculating ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Berechne…
                    </span>
                  ) : (
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold ${getScoreColor(noScore ? null : displayScore)}`}>
                      {!noScore ? `${Math.round(displayScore as number)}` : '-'}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-3">
                  {isManager && !isTerminal ? (
                    <Select
                      value={currentStatus}
                      onValueChange={(v) => handleStatusSelect(resource, v)}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="h-7 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={currentStatus} className="text-xs">{currentStatus}</SelectItem>
                        {validNext.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium ${getStatusColor(currentStatus)}`}>
                      {currentStatus}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end items-center gap-1.5">
                  {isManager && resource.cv_pfad && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCvDownload(resource)}
                      disabled={downloadingId === resource.id}
                      title="CV herunterladen"
                    >
                      {downloadingId === resource.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />
                      }
                    </Button>
                  )}
                  {resource.link_id && !isTerminal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      onClick={() => onWithdraw?.(resource)}
                      title="Zurückziehen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Interview-Datum Eingabe */}
              {isPendingInterview && (
                <div className="px-5 pb-4 flex items-center gap-2 bg-purple-50/50 border-t border-purple-100">
                  <span className="text-xs text-muted-foreground">Interview-Datum:</span>
                  <input
                    type="date"
                    value={interviewDatum}
                    onChange={(e) => setInterviewDatum(e.target.value)}
                    className="h-7 rounded border border-border bg-background px-2 text-xs"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!interviewDatum}
                    onClick={() => handleInterviewConfirm(resource)}
                  >
                    Bestätigen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => { setPendingInterviewId(null); setInterviewDatum('') }}
                  >
                    Abbrechen
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
