"use client"

import * as React from "react"
import { calculateSkillMatchScore } from '@/lib/calculateScore'
import { toast } from "sonner"
import { IconCheck, IconSearch, IconX } from "@tabler/icons-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PoolRessource {
  id: string
  name: string
  skills: string[]
  erfahrungslevel: string
  verfuegbarkeit: string
  verfuegbar_ab?: string | null
  bereits_gespielt?: boolean
  link_id?: string | null
  link_status?: string | null
  link_created_at?: string | null
  ki_score?: number | null
}

export const VERFUEGBARKEIT_COLORS: Record<string, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Nicht verfügbar": "bg-red-100 text-red-700 border-red-200",
  "Deaktiviert": "bg-gray-100 text-gray-600 border-gray-200",
}

const ERFAHRUNGS_COLORS: Record<string, string> = {
  Junior: "bg-sky-100 text-sky-700 border-sky-200",
  Mid: "bg-violet-100 text-violet-700 border-violet-200",
  Senior: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expert: "bg-rose-100 text-rose-700 border-rose-200",
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200"
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200"
  return "bg-red-100 text-red-700 border-red-200"
}

// ── TagInput ───────────────────────────────────────────────────────────────────

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = React.useState("")

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault()
      const trimmed = input.trim()
      if (!value.includes(trimmed) && value.length < 20) onChange([...value, trimmed])
      setInput("")
    }
    if (e.key === "Backspace" && !input && value.length) onChange(value.slice(0, -1))
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-within:ring-1 focus-within:ring-ring border-input">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="text-muted-foreground hover:text-foreground">
            <IconX className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[80px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        placeholder={value.length === 0 ? "Skill eingeben, Enter drücken" : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
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
  const [tab, setTab] = React.useState("pool")
  const [ressourcen, setRessourcen] = React.useState<PoolRessource[]>([])
  const [loadingPool, setLoadingPool] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [selectedRessource, setSelectedRessource] = React.useState<PoolRessource | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [neuName, setNeuName] = React.useState("")
  const [neuSkills, setNeuSkills] = React.useState<string[]>([])
  const [neuErfahrungslevel, setNeuErfahrungslevel] = React.useState("")
  const [neuVerfuegbarkeit, setNeuVerfuegbarkeit] = React.useState("Jetzt verfügbar")
  const [neuError, setNeuError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setTab("pool"); setSearch(""); setSelectedRessource(null)
      setNeuName(""); setNeuSkills([]); setNeuErfahrungslevel("")
      setNeuVerfuegbarkeit("Jetzt verfügbar"); setNeuError(null)
      return
    }
    setLoadingPool(true)
    fetch(`/api/ressourcen?vakanz_id=${vakanzId}`)
      .then((r) => r.json())
      .then((d) => setRessourcen(d.ressourcen ?? []))
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
      matchScore: r.ki_score ?? calculateSkillMatchScore(r.skills, vakanzSkills),
      isKiScore: r.ki_score != null,
    }))
    .sort((a, b) => {
      if (a.bereits_gespielt && !b.bereits_gespielt) return 1
      if (!a.bereits_gespielt && b.bereits_gespielt) return -1
      return b.matchScore - a.matchScore
    })

  async function handleSpielen() {
    if (!selectedRessource) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ressourcen/${selectedRessource.id}/spielen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: vakanzId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Fehler beim Einreichen")
      toast.success(`${selectedRessource.name} auf Vakanz gespielt`)

      // Trigger OpenAI score calculation in background
      fetch(`/api/ressourcen/${selectedRessource.id}/ki-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: vakanzId }),
      }).catch(() => {})

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Einreichen")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNeuAnlegen() {
    setNeuError(null)
    if (!neuName.trim()) { setNeuError("Name ist erforderlich"); return }
    if (neuSkills.length === 0) { setNeuError("Mindestens ein Skill erforderlich"); return }
    if (!neuErfahrungslevel) { setNeuError("Erfahrungslevel ist erforderlich"); return }
    setSubmitting(true)
    try {
      const createRes = await fetch("/api/ressourcen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: neuName.trim(), skills: neuSkills, erfahrungslevel: neuErfahrungslevel, verfuegbarkeit: neuVerfuegbarkeit }),
      })
      const createBody = await createRes.json().catch(() => ({}))
      if (!createRes.ok) throw new Error(createBody.error ?? "Fehler beim Anlegen")
      const ressourceId = createBody.ressource.id
      const spielenRes = await fetch(`/api/ressourcen/${ressourceId}/spielen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: vakanzId }),
      })
      const spielenBody = await spielenRes.json().catch(() => ({}))
      if (!spielenRes.ok) {
        toast.warning(`Im Pool angelegt, Einreichung fehlgeschlagen: ${spielenBody.error ?? "Fehler"}`)
      } else {
        toast.success(`${neuName.trim()} im Pool angelegt und auf Vakanz gespielt`)
        // Trigger OpenAI score calculation in background
        fetch(`/api/ressourcen/${ressourceId}/ki-match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vakanz_id: vakanzId }),
        }).catch(() => {})
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setNeuError(err instanceof Error ? err.message : "Fehler beim Anlegen")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Einreichen</DialogTitle>
          <DialogDescription>
            Vakanz: <span className="font-medium text-foreground">{vakanzTitel}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pool">Aus Pool auswählen</TabsTrigger>
            <TabsTrigger value="neu">Neu anlegen</TabsTrigger>
          </TabsList>

          {/* ── Aus Pool ── */}
          <TabsContent value="pool" className="flex flex-col gap-3 flex-1 overflow-hidden mt-3">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name oder Skill suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto rounded-md border min-h-[200px] max-h-[280px]">
              {loadingPool ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Lädt…</div>
              ) : filteredWithScore.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  {ressourcen.length === 0 ? (
                    <>
                      <p>Noch keine Pool-Ressourcen vorhanden.</p>
                      <button className="text-primary underline-offset-4 hover:underline" onClick={() => setTab("neu")}>
                        Erste Ressource anlegen
                      </button>
                    </>
                  ) : "Keine Ressourcen gefunden."}
                </div>
              ) : (
                <table className="w-full text-sm">
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
                      const isSelected = selectedRessource?.id === r.id
                      return (
                        <tr
                          key={r.id}
                          onClick={() => !isDisabled && setSelectedRessource(isSelected ? null : r)}
                          className={`transition-colors ${isDisabled ? "cursor-not-allowed opacity-50" : isSelected ? "bg-primary/5 cursor-pointer" : "hover:bg-muted/50 cursor-pointer"}`}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {isSelected && !isDisabled && <IconCheck className="size-3.5 text-primary shrink-0" />}
                              <span className="font-medium truncate max-w-[140px]">{r.name}</span>
                              {isDisabled && <span className="text-[10px] text-muted-foreground whitespace-nowrap">Bereits eingereicht</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ERFAHRUNGS_COLORS[r.erfahrungslevel] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {r.erfahrungslevel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {r.verfuegbar_ab
                              ? new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")
                              : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(r.matchScore)}`} title={r.isKiScore ? "KI-Score" : "Vorschau (Skill-Matching)"}>
                              {r.isKiScore ? "" : "~"}{r.matchScore} %
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Abbrechen</Button>
              <Button onClick={handleSpielen} disabled={!selectedRessource || submitting}>
                {submitting ? "Wird eingereicht…" : selectedRessource ? `${selectedRessource.name} einsetzen` : "Ressource auswählen"}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ── Neu anlegen ── */}
          <TabsContent value="neu" className="flex flex-col gap-3 mt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-name">Name <span className="text-destructive">*</span></Label>
              <Input id="re-name" placeholder="z.B. Max Mustermann" value={neuName} onChange={(e) => setNeuName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Skills <span className="text-destructive">*</span></Label>
              <TagInput value={neuSkills} onChange={setNeuSkills} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="re-level">Erfahrungslevel <span className="text-destructive">*</span></Label>
                <Select value={neuErfahrungslevel} onValueChange={setNeuErfahrungslevel}>
                  <SelectTrigger id="re-level"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Mid">Mid</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                    <SelectItem value="Expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="re-verf">Verfügbarkeit</Label>
                <Select value={neuVerfuegbarkeit} onValueChange={setNeuVerfuegbarkeit}>
                  <SelectTrigger id="re-verf"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jetzt verfügbar">Jetzt verfügbar</SelectItem>
                    <SelectItem value="Verfügbar ab">Verfügbar ab</SelectItem>
                    <SelectItem value="Nicht verfügbar">Nicht verfügbar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {neuError && <p className="text-sm text-destructive">{neuError}</p>}
            <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Die Ressource wird im Pool gespeichert und sofort auf diese Vakanz eingereicht.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Abbrechen</Button>
              <Button onClick={handleNeuAnlegen} disabled={submitting}>
                {submitting ? "Wird angelegt…" : "Anlegen & einreichen"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
