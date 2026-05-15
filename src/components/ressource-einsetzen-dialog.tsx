"use client"

import * as React from "react"
import { calculateSkillMatchScore } from '@/lib/calculateScore'
import { toast } from "sonner"
import { IconSearch, IconLoader2 } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PoolRessource {
  id: string
  name: string
  rolle?: string | null
  skills: string[]
  erfahrungslevel: string
  verfuegbarkeit: string
  verfuegbar_ab?: string | null
  bereits_gespielt?: boolean
  link_id?: string | null
  link_status?: string | null
  link_created_at?: string | null
  ki_score?: number | null
  cv_pfad?: string | null
  link_feedback?: string | null
  agentur_name?: string | null
}

export const VERFUEGBARKEIT_COLORS: Record<string, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Nicht verfügbar": "bg-red-100 text-red-700 border-red-200",
  "Deaktiviert": "bg-gray-100 text-gray-600 border-gray-200",
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200"
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200"
  return "bg-red-100 text-red-700 border-red-200"
}

// ── RessourceEinsetzenDialog ───────────────────────────────────────────────────

export function RessourceEinsetzenDialog({
  open,
  onOpenChange,
  vakanzId,
  vakanzTitel,
  vakanzSkills,
  vakanzErfahrungslevel,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vakanzId: string
  vakanzTitel: string
  vakanzSkills: string[]
  vakanzErfahrungslevel: string
  onSuccess: () => void
}) {
  const [ressourcen, setRessourcen] = React.useState<PoolRessource[]>([])
  const [loadingPool, setLoadingPool] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [kiScores, setKiScores] = React.useState<Record<string, number>>({})
  const [scoringIds, setScoringIds] = React.useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setSearch(""); setSelectedIds(new Set())
      setKiScores({}); setScoringIds(new Set())
      return
    }
    setLoadingPool(true)
    fetch(`/api/ressourcen?vakanz_id=${vakanzId}`)
      .then((r) => r.json())
      .then((d) => {
        const list: PoolRessource[] = d.ressourcen ?? []
        setRessourcen(list)
        // Eager KI-Scoring für Ressourcen ohne gespeicherten Score
        const unscored = list.filter(r => r.ki_score == null && !r.bereits_gespielt)
        if (unscored.length > 0) {
          setScoringIds(new Set(unscored.map(r => r.id)))
          for (const r of unscored) {
            fetch(`/api/ressourcen/${r.id}/ki-match`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vakanz_id: vakanzId }),
            })
              .then(res => res.json())
              .then(body => {
                if (typeof body.score?.score === "number") {
                  setKiScores(prev => ({ ...prev, [r.id]: body.score.score }))
                }
              })
              .catch(() => {})
              .finally(() => setScoringIds(prev => {
                const next = new Set(prev)
                next.delete(r.id)
                return next
              }))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPool(false))
  }, [open, vakanzId])

  const filteredWithScore = ressourcen
    .filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
    )
    .map((r) => ({
      ...r,
      matchScore: kiScores[r.id] ?? r.ki_score ?? calculateSkillMatchScore(r.skills, vakanzSkills),
      isKiScore: r.id in kiScores || r.ki_score != null,
      isScoring: scoringIds.has(r.id),
    }))
    .sort((a, b) => {
      if (a.bereits_gespielt && !b.bereits_gespielt) return 1
      if (!a.bereits_gespielt && b.bereits_gespielt) return -1
      return b.matchScore - a.matchScore
    })

  async function handleSpielen() {
    if (selectedIds.size === 0) return
    const selected = ressourcen.filter(r => selectedIds.has(r.id))
    setSubmitting(true)
    try {
      const results = await Promise.allSettled(
        selected.map(async (r) => {
          const res = await fetch(`/api/ressourcen/${r.id}/spielen`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vakanz_id: vakanzId }),
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(body.error ?? "Fehler beim Einreichen")
          return r
        })
      )

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<PoolRessource> => r.status === "fulfilled")
        .map(r => r.value)

      // Fehler-Toast pro fehlgeschlagener Ressource
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          const name = selected[i].name
          const msg = result.reason instanceof Error ? result.reason.message : "Fehler beim Einreichen"
          toast.error(`${name}: ${msg}`)
        }
      })

      // Erfolgs-Toast
      if (succeeded.length > 0) {
        const total = selected.length
        toast.success(
          succeeded.length === total
            ? `${total === 1 ? "1 Ressource" : `${total} Ressourcen`} eingereicht`
            : `${succeeded.length} von ${total} Ressourcen eingereicht`
        )
      }

      onOpenChange(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Ressource einsetzen</DialogTitle>
          <DialogDescription>
            Vakanz: <span className="font-medium text-foreground">{vakanzTitel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name oder Skill suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-md border min-h-[200px] max-h-[min(420px,calc(90vh-220px))]">
            {loadingPool ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Lädt…</div>
            ) : filteredWithScore.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                {ressourcen.length === 0 ? "Noch keine Pool-Ressourcen vorhanden." : "Keine Ressourcen gefunden."}
              </div>
            ) : (
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[46%]" />
                  <col className="w-[26%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rolle</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Verfügbar ab</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredWithScore.map((r) => {
                    const isDisabled = !!r.bereits_gespielt
                    const isSelected = selectedIds.has(r.id)
                    return (
                      <tr
                        key={r.id}
                        onClick={() => {
                          if (isDisabled) return
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (next.has(r.id)) next.delete(r.id)
                            else next.add(r.id)
                            return next
                          })
                        }}
                        className={`transition-colors ${isDisabled ? "cursor-not-allowed opacity-50" : isSelected ? "bg-primary/5 cursor-pointer" : "hover:bg-muted/50 cursor-pointer"}`}
                      >
                        <td className="px-3 py-2.5 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              disabled={isDisabled}
                              className="size-4 shrink-0 rounded border-border accent-primary"
                            />
                            <span className="font-medium truncate">{r.name}</span>
                            {isDisabled && <span className="shrink-0 inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">Eingereicht</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 min-w-0">
                          <span className="text-xs text-foreground truncate block">{r.rolle || r.erfahrungslevel}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {r.verfuegbar_ab
                            ? new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {r.isScoring ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <IconLoader2 className="size-3 animate-spin" />
                              KI…
                            </span>
                          ) : (
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(r.matchScore)}`} title={r.isKiScore ? "KI-Score" : "Vorschau (Skill-Matching)"}>
                              {r.isKiScore ? "" : "~"}{r.matchScore} %
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Abbrechen</Button>
          <Button onClick={handleSpielen} disabled={selectedIds.size === 0 || submitting}>
            {submitting
              ? "Wird eingereicht…"
              : selectedIds.size === 0
                ? "Ressource auswählen"
                : selectedIds.size === 1
                  ? "1 Ressource einsetzen"
                  : `${selectedIds.size} Ressourcen einsetzen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
