"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  IconDownload,
  IconSearch,
  IconX,
} from "@tabler/icons-react"

import { ERFAHRUNGSLEVEL, RESSOURCE_VERFUEGBARKEIT } from "@/lib/constants"
import type { Erfahrungslevel, RessourceVerfuegbarkeit } from "@/lib/constants"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agentur {
  name: string
}

interface Ressource {
  id: string
  agentur_id: string
  name: string
  skills: string[]
  erfahrungslevel: Erfahrungslevel
  verfuegbarkeit: RessourceVerfuegbarkeit
  verfuegbar_ab?: string | null
  cv_pfad?: string | null
  ek_tagesrate?: number | null
  notizen?: string | null
  created_at: string
  updated_at: string
  agenturen?: Agentur | null
}

// ── Color maps ─────────────────────────────────────────────────────────────────

const verfuegbarkeitColors: Record<RessourceVerfuegbarkeit, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-blue-100 text-blue-700 border-blue-200",
  "Nicht verfügbar": "bg-orange-100 text-orange-700 border-orange-200",
  Deaktiviert: "bg-gray-100 text-gray-500 border-gray-200",
}

const erfahrungsColors: Record<Erfahrungslevel, string> = {
  Junior: "bg-sky-100 text-sky-700 border-sky-200",
  Mid: "bg-violet-100 text-violet-700 border-violet-200",
  Senior: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expert: "bg-rose-100 text-rose-700 border-rose-200",
}

// ── SkillTags ──────────────────────────────────────────────────────────────────

function SkillTags({ skills }: { skills: string[] }) {
  const shown = skills.slice(0, 4)
  const rest = skills.length - 4
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span
          key={s}
          className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {s}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  )
}

// ── RessourceDetailSheet ───────────────────────────────────────────────────────

interface RessourceDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ressource: Ressource | null
}

function RessourceDetailSheet({
  open,
  onOpenChange,
  ressource,
}: RessourceDetailSheetProps) {
  async function handleCvDownload() {
    if (!ressource?.cv_pfad) return
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/cv`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      const { url } = await res.json()
      window.open(url, "_blank")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CV-Download fehlgeschlagen")
    }
  }

  if (!ressource) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col gap-0 overflow-hidden p-0 sm:w-[480px]"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{ressource.name}</SheetTitle>
          <SheetDescription>
            {ressource.agenturen?.name ?? "Unbekannte Agentur"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-5">

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={verfuegbarkeitColors[ressource.verfuegbarkeit]}
              >
                {ressource.verfuegbarkeit}
                {ressource.verfuegbarkeit === "Verfügbar ab" &&
                  ressource.verfuegbar_ab &&
                  ` ${new Date(ressource.verfuegbar_ab).toLocaleDateString("de-DE")}`}
              </Badge>
              <Badge
                variant="outline"
                className={erfahrungsColors[ressource.erfahrungslevel]}
              >
                {ressource.erfahrungslevel}
              </Badge>
            </div>

            {/* Skills */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ressource.skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-sm"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* EK-Tagesrate */}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                EK-Tagesrate
              </p>
              <p className="text-sm">
                {ressource.ek_tagesrate != null
                  ? `${ressource.ek_tagesrate.toLocaleString("de-DE")} €/Tag`
                  : "Nicht angegeben"}
              </p>
            </div>

            {/* Notizen */}
            {ressource.notizen && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notizen
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {ressource.notizen}
                </p>
              </div>
            )}

            {/* CV */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Lebenslauf
              </p>
              {ressource.cv_pfad ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCvDownload}
                >
                  <IconDownload className="size-4" />
                  CV herunterladen
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Kein CV vorhanden</p>
              )}
            </div>

            {/* Metadata */}
            <div className="rounded-lg border bg-muted/40 px-4 py-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <span className="text-muted-foreground">Agentur</span>
                <span>{ressource.agenturen?.name ?? "—"}</span>
                <span className="text-muted-foreground">Angelegt</span>
                <span>
                  {new Date(ressource.created_at).toLocaleDateString("de-DE")}
                </span>
                <span className="text-muted-foreground">Aktualisiert</span>
                <span>
                  {new Date(ressource.updated_at).toLocaleDateString("de-DE")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function TableSkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ── RessourcenPage ─────────────────────────────────────────────────────────────

export default function RessourcenPage() {
  const [ressourcen, setRessourcen] = React.useState<Ressource[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [levelFilter, setLevelFilter] = React.useState("alle")
  const [agenturFilter, setAgenturFilter] = React.useState("alle")
  const [showDeaktiviert, setShowDeaktiviert] = React.useState(false)

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [selectedRessource, setSelectedRessource] = React.useState<Ressource | null>(null)

  async function fetchRessourcen() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (showDeaktiviert) params.set("deaktiviert", "true")
      const res = await fetch(`/api/ressourcen?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setRessourcen(data.ressourcen ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchRessourcen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeaktiviert])

  // Unique agentur list for filter
  const agenturen = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of ressourcen) {
      if (r.agentur_id && r.agenturen?.name) {
        seen.set(r.agentur_id, r.agenturen.name)
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [ressourcen])

  const filtered = ressourcen.filter((r) => {
    if (statusFilter !== "alle" && r.verfuegbarkeit !== statusFilter) return false
    if (levelFilter !== "alle" && r.erfahrungslevel !== levelFilter) return false
    if (agenturFilter !== "alle" && r.agentur_id !== agenturFilter) return false
    const q = searchQuery.toLowerCase()
    if (
      q &&
      !r.name.toLowerCase().includes(q) &&
      !r.skills.some((s) => s.toLowerCase().includes(q))
    )
      return false
    return true
  })

  const activeFilters =
    (statusFilter !== "alle" ? 1 : 0) +
    (levelFilter !== "alle" ? 1 : 0) +
    (agenturFilter !== "alle" ? 1 : 0) +
    (showDeaktiviert ? 1 : 0)

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Ressourcen" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Ressourcen-Pool</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading
                      ? "Lädt…"
                      : `${filtered.length} von ${ressourcen.length} Ressource${ressourcen.length !== 1 ? "n" : ""}`}
                  </p>
                </div>
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => {
                      setStatusFilter("alle")
                      setLevelFilter("alle")
                      setAgenturFilter("alle")
                      setShowDeaktiviert(false)
                    }}
                  >
                    <IconX className="size-4" />
                    Filter zurücksetzen ({activeFilters})
                  </Button>
                )}
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name oder Skill suchen…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Status</SelectItem>
                    {RESSOURCE_VERFUEGBARKEIT.filter((v) => v !== "Deaktiviert").map(
                      (v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Level</SelectItem>
                    {ERFAHRUNGSLEVEL.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={agenturFilter} onValueChange={setAgenturFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Agentur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Agenturen</SelectItem>
                    {agenturen.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={showDeaktiviert ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDeaktiviert((p) => !p)}
                >
                  Deaktivierte anzeigen
                </Button>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  {error}
                </div>
              )}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Agentur</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>EK-Rate</TableHead>
                        <TableHead>Aktualisiert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={7} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-12 text-center text-muted-foreground"
                          >
                            {ressourcen.length === 0
                              ? "Noch keine Ressourcen vorhanden."
                              : "Keine Ressourcen für diese Filter."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => (
                          <TableRow
                            key={r.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedRessource(r)
                              setDetailOpen(true)
                            }}
                          >
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.agenturen?.name ?? "—"}
                            </TableCell>
                            <TableCell>
                              <SkillTags skills={r.skills} />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={erfahrungsColors[r.erfahrungslevel]}
                              >
                                {r.erfahrungslevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={verfuegbarkeitColors[r.verfuegbarkeit]}
                              >
                                {r.verfuegbarkeit}
                                {r.verfuegbarkeit === "Verfügbar ab" &&
                                  r.verfuegbar_ab &&
                                  ` ${new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")}`}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.ek_tagesrate != null
                                ? `${r.ek_tagesrate.toLocaleString("de-DE")} €`
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(r.updated_at).toLocaleDateString("de-DE")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <RessourceDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        ressource={selectedRessource}
      />
    </SidebarProvider>
  )
}
