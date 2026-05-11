"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconArrowLeft, IconChevronDown, IconEye, IconEyeOff, IconPencil, IconRotateClockwise } from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { RessourceEinsetzenDialog, VERFUEGBARKEIT_COLORS, type PoolRessource } from "@/components/ressource-einsetzen-dialog"
import { VakanzFormSheet } from "@/components/vakanz-form-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Vakanz {
  id: string
  rolle: string
  beschreibung: string
  branche: string
  kunde?: string | null
  skills: string[]
  skills_nice_have?: string[]
  erfahrungslevel: string
  startdatum: string
  enddatum?: string | null
  teamgroesse?: number | null
  fte_anzahl: number
  auslastung: number
  arbeitsmodell: string
  onsite_anteil?: number | null
  ansprechpartner?: string | null
  standort?: string | null
  status: string
  budget_intern?: number | null
  weitere_kommentare?: string | null
  published?: boolean
}

type ProfilStatus = "Eingereicht" | "In Prüfung" | "Präsentiert" | "Interview" | "Beauftragt" | "Abgelehnt" | "Archiviert"

interface KandidatenProfil {
  id: string
  vakanz_id: string
  kandidatenname: string
  status: ProfilStatus
  ki_score: number | null
  created_at: string
  agentur_name?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Offen: "bg-blue-100 text-blue-700 border-blue-200",
  "In Auswahl": "bg-orange-100 text-orange-700 border-orange-200",
  Besetzt: "bg-green-100 text-green-700 border-green-200",
  Pausiert: "bg-gray-100 text-gray-600 border-gray-200",
  Geschlossen: "bg-red-100 text-red-700 border-red-200",
}

const PROFIL_STATUS_COLORS: Record<string, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Archiviert: "bg-gray-100 text-gray-600 border-gray-200",
}

const PROFIL_STATUSES: ProfilStatus[] = [
  "Eingereicht", "In Prüfung", "Präsentiert", "Interview", "Beauftragt", "Abgelehnt", "Archiviert",
]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE")
}

function SkillChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${muted ? "border-border bg-muted text-muted-foreground" : "border-border bg-muted text-foreground"}`}>
      {label}
    </span>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">–</span>
  const color = score >= 70 ? "bg-green-100 text-green-700 border-green-200"
    : score >= 40 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-red-100 text-red-700 border-red-200"
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>{score}</span>
}

// ── VakanzDetailPage ──────────────────────────────────────────────────────────

export default function VakanzDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id as string

  const isAgentur = user?.rolle === "Agentur"
  const isManager = user?.rolle === "Staffhub Manager" || user?.rolle === "Admin"

  // Vakanz
  const [vakanz, setVakanz] = React.useState<Vakanz | null>(null)
  const [vakanzStatus, setVakanzStatus] = React.useState("")
  const [loadingVakanz, setLoadingVakanz] = React.useState(true)

  // Agentur: gespielt Ressourcen
  const [gespielt, setGespielt] = React.useState<PoolRessource[]>([])
  const [loadingGespielt, setLoadingGespielt] = React.useState(false)
  const [einreichenOpen, setEinreichenOpen] = React.useState(false)
  const [rueckzugOpen, setRueckzugOpen] = React.useState(false)
  const [rueckzugTarget, setRueckzugTarget] = React.useState<PoolRessource | null>(null)
  const [rueckzugBusy, setRueckzugBusy] = React.useState(false)

  // Manager: kandidaten profile
  const [profile, setProfile] = React.useState<KandidatenProfil[]>([])
  const [loadingProfile, setLoadingProfile] = React.useState(false)
  const [updatingStatus, setUpdatingStatus] = React.useState<string | null>(null)
  const [headerExpanded, setHeaderExpanded] = React.useState(false)

  // Edit sheet + publish
  const [editSheetOpen, setEditSheetOpen] = React.useState(false)
  const [localPublished, setLocalPublished] = React.useState<boolean | undefined>(undefined)

  // ── Load Vakanz ──────────────────────────────────────────────────────────────

  React.useEffect(() => {
    fetch(`/api/vakanzen/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.vakanz) {
          setVakanz(d.vakanz)
          setVakanzStatus(d.vakanz.status)
          setLocalPublished(d.vakanz.published ?? false)
        }
      })
      .catch(() => toast.error("Vakanz konnte nicht geladen werden."))
      .finally(() => setLoadingVakanz(false))
  }, [id])

  // ── Load Einreichungen ───────────────────────────────────────────────────────

  function loadGespielt() {
    if (!isAgentur) return
    setLoadingGespielt(true)
    fetch(`/api/ressourcen?vakanz_id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        const all: PoolRessource[] = d.ressourcen ?? []
        setGespielt(all.filter((r) => r.bereits_gespielt))
      })
      .catch(() => {})
      .finally(() => setLoadingGespielt(false))
  }

  function loadProfile() {
    if (!isManager) return
    setLoadingProfile(true)
    fetch(`/api/profile?vakanz_id=${id}`)
      .then((r) => r.json())
      .then((d) => setProfile(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }

  React.useEffect(() => {
    if (!user) return
    if (isAgentur) loadGespielt()
    if (isManager) loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleRueckzug() {
    if (!rueckzugTarget?.link_id) return
    setRueckzugBusy(true)
    try {
      const res = await fetch(`/api/ressource-links/${rueckzugTarget.link_id}/rueckzug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Rückzug fehlgeschlagen.")
        return
      }
      toast.success(`${rueckzugTarget.name} zurückgezogen.`)
      setRueckzugOpen(false)
      loadGespielt()
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setRueckzugBusy(false)
    }
  }

  async function handleStatusChange(profilId: string, newStatus: ProfilStatus) {
    setUpdatingStatus(profilId)
    try {
      const res = await fetch(`/api/profile/${profilId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Fehler beim Statuswechsel.")
        return
      }
      setProfile((prev) => prev.map((p) => p.id === profilId ? { ...p, status: newStatus } : p))
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setUpdatingStatus(null)
    }
  }

  // ── Publish toggle ───────────────────────────────────────────────────────────

  async function handleTogglePublished() {
    const newVal = !localPublished
    setLocalPublished(newVal)
    try {
      const res = await fetch(`/api/vakanzen/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: newVal }),
      })
      if (!res.ok) {
        setLocalPublished(!newVal)
        toast.error("Fehler beim Aktualisieren")
      } else {
        toast.success(newVal ? "Vakanz veröffentlicht" : "Vakanz als Entwurf gespeichert")
      }
    } catch {
      setLocalPublished(!newVal)
      toast.error("Verbindungsfehler")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={loadingVakanz ? "Vakanz" : (vakanz?.rolle ?? "Vakanz")} />

        {/* Scroll-Container */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STICKY VAKANZ-INFO ─────────────────────────────────────────── */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="px-6 py-3">

              {/* Top bar: back + actions */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => router.push("/vakanzen")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconArrowLeft className="size-3.5" />
                  Zurück zu Vakanzen
                </button>

                {isManager && !loadingVakanz && vakanz && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTogglePublished}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        localPublished
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      {localPublished ? (
                        <><IconEye className="size-3.5" />Öffentlich</>
                      ) : (
                        <><IconEyeOff className="size-3.5" />Entwurf</>
                      )}
                    </button>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setEditSheetOpen(true)}>
                      <IconPencil className="size-3.5" />
                      Bearbeiten
                    </Button>
                  </div>
                )}
              </div>

              {loadingVakanz ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-4 w-full max-w-xl" />
                  <Skeleton className="h-4 w-80" />
                </div>
              ) : vakanz ? (
                <div className="space-y-2.5">

                  {/* Row 1: Title + Status-Badges */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-lg font-semibold leading-tight">{vakanz.rolle}</h1>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[vakanzStatus] ?? ""}`}>{vakanzStatus}</Badge>
                      <Badge variant="outline" className="text-xs">{vakanz.erfahrungslevel}</Badge>
                      <Badge variant="outline" className="text-xs">{vakanz.arbeitsmodell}{vakanz.onsite_anteil != null ? ` · ${vakanz.onsite_anteil}% Onsite` : ""}</Badge>
                      {vakanz.branche && <Badge variant="outline" className="text-xs">{vakanz.branche}</Badge>}
                    </div>
                  </div>

                  {/* Row 2: Meta-Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Start</p>
                      <p className="text-xs font-medium">{fmt(vakanz.startdatum)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Ende</p>
                      <p className="text-xs font-medium">{vakanz.enddatum ? fmt(vakanz.enddatum) : "–"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">FTE</p>
                      <p className="text-xs font-medium">{vakanz.fte_anzahl}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Auslastung</p>
                      <p className="text-xs font-medium">{vakanz.auslastung}%</p>
                    </div>
                    {vakanz.standort && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Standort</p>
                        <p className="text-xs font-medium">{vakanz.standort}</p>
                      </div>
                    )}
                    {vakanz.ansprechpartner && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Kontakt</p>
                        <p className="text-xs font-medium">{vakanz.ansprechpartner}</p>
                      </div>
                    )}
                    {vakanz.kunde && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Kunde</p>
                        <p className="text-xs font-medium">{vakanz.kunde}</p>
                      </div>
                    )}
                    {!isAgentur && vakanz.budget_intern != null && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">EK/Tag</p>
                        <p className="text-xs font-medium">{vakanz.budget_intern.toLocaleString("de-DE")} €</p>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Skills — collapsed preview or full expanded */}
                  <div className="space-y-1.5">
                    {headerExpanded ? (
                      <>
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-16 pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Must Have</span>
                          <div className="flex flex-wrap gap-1">
                            {vakanz.skills.map((s) => (
                              <span key={s} className="inline-flex items-center rounded-full border border-foreground/20 bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        {(vakanz.skills_nice_have ?? []).length > 0 && (
                          <div className="flex items-start gap-3">
                            <span className="shrink-0 w-16 pt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Nice Have</span>
                            <div className="flex flex-wrap gap-1">
                              {(vakanz.skills_nice_have ?? []).map((s) => (
                                <span key={s} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {vakanz.skills.slice(0, 5).map((s) => (
                          <span key={s} className="inline-flex items-center rounded-full border border-foreground/20 bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground">
                            {s}
                          </span>
                        ))}
                        {(() => {
                          const hidden = Math.max(0, vakanz.skills.length - 5) + (vakanz.skills_nice_have?.length ?? 0)
                          return hidden > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              +{hidden} weitere
                            </span>
                          ) : null
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Projektkontext toggle */}
                  <button
                    onClick={() => setHeaderExpanded((p) => !p)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconChevronDown className={`size-3.5 transition-transform duration-200 ${headerExpanded ? "rotate-180" : ""}`} />
                    {headerExpanded ? "Weniger anzeigen" : "Projektkontext & alle Skills anzeigen"}
                  </button>

                  {/* Expandable: full description */}
                  {headerExpanded && (
                    <div className="space-y-2 border-t border-border/50 pt-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Projektkontext</p>
                      <div className="max-h-56 overflow-y-auto rounded-md border border-border/40 bg-muted/30 px-3 py-2.5">
                        <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">
                          {vakanz.beschreibung}
                        </p>
                      </div>
                      {!isAgentur && vakanz.weitere_kommentare && (
                        <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 italic">
                          {vakanz.weitere_kommentare}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── SCROLLBARER EINREICHUNGS-BEREICH ──────────────────────────── */}
          {!loadingVakanz && !vakanz && (
            <div className="px-6 py-6">
              <p className="text-muted-foreground">Vakanz nicht gefunden.</p>
            </div>
          )}

          {!loadingVakanz && vakanz && (
            <div className="px-6 py-6 space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  {isAgentur ? "Meine Einreichungen" : "Einreichungen"}
                  {isAgentur && gespielt.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">({gespielt.length})</span>
                  )}
                  {isManager && profile.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">({profile.length})</span>
                  )}
                </h2>
                {isAgentur && vakanzStatus === "Offen" && (
                  <Button size="sm" onClick={() => setEinreichenOpen(true)}>
                    Einreichen
                  </Button>
                )}
              </div>

              {/* Agentur: Gespielte Ressourcen */}
              {isAgentur && (
                loadingGespielt ? (
                  <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : gespielt.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Noch keine Ressourcen eingereicht.{vakanzStatus === "Offen" ? ' Klicke auf "Einreichen".' : ""}
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {gespielt.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{r.name}</span>
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${VERFUEGBARKEIT_COLORS[r.verfuegbarkeit] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {r.verfuegbarkeit}
                            </span>
                            {r.link_status && (
                              <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {r.link_status}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.skills.slice(0, 5).map((s) => (
                              <span key={s} className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                            ))}
                            {r.skills.length > 5 && <span className="text-[10px] text-muted-foreground">+{r.skills.length - 5}</span>}
                          </div>
                        </div>
                        {r.link_id && r.link_status === "Gespielt" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => { setRueckzugTarget(r); setRueckzugOpen(true) }}
                          >
                            Zurückziehen
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Manager: Kandidaten-Profile */}
              {isManager && (
                loadingProfile ? (
                  <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : profile.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Noch keine Profile eingereicht.
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {profile.map((p) => (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{p.kandidatenname}</p>
                          {p.agentur_name && (
                            <p className="text-xs text-muted-foreground">{p.agentur_name}</p>
                          )}
                        </div>
                        <ScoreBadge score={p.ki_score} />
                        <Select
                          value={p.status}
                          onValueChange={(v) => handleStatusChange(p.id, v as ProfilStatus)}
                          disabled={updatingStatus === p.id}
                        >
                          <SelectTrigger className="h-7 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROFIL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(p.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

            </div>
          )}

        </div>
      </SidebarInset>

      {/* Einreichen Dialog */}
      {vakanz && (
        <RessourceEinsetzenDialog
          open={einreichenOpen}
          onOpenChange={setEinreichenOpen}
          vakanzId={vakanz.id}
          vakanzTitel={vakanz.rolle}
          onSuccess={() => { loadGespielt(); setEinreichenOpen(false) }}
        />
      )}

      {/* Rückzug Dialog */}
      <AlertDialog open={rueckzugOpen} onOpenChange={setRueckzugOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einreichung zurückziehen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{rueckzugTarget?.name}</strong> wird von dieser Vakanz zurückgezogen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rueckzugBusy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rueckzugBusy}
              onClick={handleRueckzug}
            >
              {rueckzugBusy ? "Wird zurückgezogen…" : "Zurückziehen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Sheet */}
      {vakanz && (
        <VakanzFormSheet
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          mode="edit"
          vakanz={vakanz}
          showBudget={isManager}
          onSuccess={() => {
            fetch(`/api/vakanzen/${id}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.vakanz) {
                  setVakanz(d.vakanz)
                  setVakanzStatus(d.vakanz.status)
                  setLocalPublished(d.vakanz.published ?? false)
                }
              })
              .catch(() => {})
          }}
        />
      )}
    </SidebarProvider>
  )
}
