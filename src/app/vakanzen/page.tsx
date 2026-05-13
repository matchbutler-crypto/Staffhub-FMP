"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  IconBrandSlack,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUsers,
  IconX,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import type { VakanzStatus, Erfahrungslevel, Arbeitsmodell } from "@/lib/constants"
import { VakanzFormSheet } from "@/components/vakanz-form-sheet"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ProfilEinreichenSheet } from "@/components/profil-einreichen-sheet"
import { RessourceEinsetzenDialog } from "@/components/ressource-einsetzen-dialog"
import { GespielteRessourcenTable } from "@/components/GespielteRessourcenTable"
import type { PoolRessource } from "@/components/ressource-einsetzen-dialog"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  titel: string
  branche: string
  kunde?: string | null
  rolle: string
  beschreibung: string
  skills: string[]
  skills_nice_have: string[]
  erfahrungslevel: Erfahrungslevel
  startdatum: string
  enddatum?: string | null
  teamgroesse?: number | null
  fte_anzahl: number
  auslastung: number
  arbeitsmodell: Arbeitsmodell
  onsite_anteil?: number | null
  ansprechpartner?: string | null
  status: VakanzStatus
  standort?: string | null
  budget_intern?: number | null
  weitere_kommentare?: string | null
  profile_anzahl: number
  created_at: string
  slack_ts?: string | null
  slack_detail_posted_at?: string | null
  published?: boolean
}

type ProfilStatus =
  | "Eingereicht"
  | "In Prüfung"
  | "Präsentiert"
  | "Interview"
  | "Beauftragt"
  | "Abgelehnt"
  | "Archiviert"

interface InlineProfile {
  id: string
  kandidatenname: string
  status: ProfilStatus | string
  ki_score: number | null
  agentur_name: string | null
  quelle?: 'profil' | 'pool'
  ressource_id?: string | null
}

// ── Color maps ─────────────────────────────────────────────────────────────────

const statusColors: Record<VakanzStatus, string> = {
  Offen: "bg-blue-100 text-blue-700 border-blue-200",
  "In Auswahl": "bg-orange-100 text-orange-700 border-orange-200",
  Besetzt: "bg-green-100 text-green-700 border-green-200",
  Pausiert: "bg-gray-100 text-gray-600 border-gray-200",
  Geschlossen: "bg-red-100 text-red-700 border-red-200",
}

const statusBorderLeft: Record<VakanzStatus, string> = {
  Offen: "border-l-blue-400",
  "In Auswahl": "border-l-orange-400",
  Besetzt: "border-l-green-500",
  Pausiert: "border-l-gray-300",
  Geschlossen: "border-l-red-400",
}

const profilStatusColors: Record<ProfilStatus, string> = {
  Eingereicht: "bg-blue-50 text-blue-600 border-blue-200",
  "In Prüfung": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-50 text-purple-700 border-purple-200",
  Interview: "bg-orange-50 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-50 text-green-700 border-green-200",
  Abgelehnt: "bg-red-50 text-red-600 border-red-200",
  Archiviert: "bg-gray-50 text-gray-500 border-gray-200",
}

const arbeitsmodellColors: Record<Arbeitsmodell, string> = {
  Remote: "bg-teal-50 text-teal-700 border-teal-200",
  Hybrid: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Onsite: "bg-amber-50 text-amber-700 border-amber-200",
}

const erfahrungsColors: Record<Erfahrungslevel, string> = {
  Junior: "bg-sky-50 text-sky-700 border-sky-200",
  Mid: "bg-violet-50 text-violet-700 border-violet-200",
  Senior: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Expert: "bg-rose-50 text-rose-700 border-rose-200",
}

// ── KI Score Badge ─────────────────────────────────────────────────────────────

function KiScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground tabular-nums">–</span>
  const color =
    score >= 70
      ? "text-green-700 bg-green-50 border-green-200"
      : score >= 40
      ? "text-yellow-700 bg-yellow-50 border-yellow-200"
      : "text-red-600 bg-red-50 border-red-200"
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
      {score}
    </span>
  )
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
          className="inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {s}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  )
}

// ── SlackPostDialog ────────────────────────────────────────────────────────────

type SlackWorkspace = "freelance" | "partner"
type SlackChannel = "testing" | "germany" | "global"

interface SlackPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postType: "detail" | "update"
  vakanzTitel?: string
  onConfirm: (workspace: SlackWorkspace, channel: SlackChannel) => Promise<void>
}

function SlackPostDialog({ open, onOpenChange, postType, vakanzTitel, onConfirm }: SlackPostDialogProps) {
  const [workspace, setWorkspace] = React.useState<SlackWorkspace>("freelance")
  const [channel, setChannel] = React.useState<SlackChannel>("testing")
  const [posting, setPosting] = React.useState(false)

  React.useEffect(() => {
    if (open) { setWorkspace("freelance"); setChannel("testing") }
  }, [open])

  async function handleConfirm() {
    setPosting(true)
    try { await onConfirm(workspace, channel); onOpenChange(false) }
    finally { setPosting(false) }
  }

  const workspaceLabels: Record<SlackWorkspace, string> = { freelance: "Freelance", partner: "Partner" }
  const channelLabels: Record<SlackChannel, string> = { testing: "Testing", germany: "Germany", global: "Global" }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBrandSlack className="size-5 text-[#4A154B]" />
            {postType === "detail" ? "Detailpost senden" : "Updatepost senden"}
          </DialogTitle>
          <DialogDescription>
            {postType === "detail" && vakanzTitel
              ? <>Vakanz <span className="font-medium text-foreground">„{vakanzTitel}"</span> in Slack posten.</>
              : "Statusübersicht aller Vakanzen in Slack posten."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-workspace">Workspace</Label>
            <Select value={workspace} onValueChange={(v) => setWorkspace(v as SlackWorkspace)}>
              <SelectTrigger id="sp-workspace"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(workspaceLabels) as SlackWorkspace[]).map((ws) => (
                  <SelectItem key={ws} value={ws}>{workspaceLabels[ws]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-channel">Ziel-Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as SlackChannel)}>
              <SelectTrigger id="sp-channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(channelLabels) as SlackChannel[]).map((ch) => (
                  <SelectItem key={ch} value={ch}>{channelLabels[ch]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Channel:</span>{" "}
            {workspaceLabels[workspace]} → {channelLabels[channel]}
            {channel === "testing" && (
              <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 border border-yellow-200">TEST</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={posting}>Abbrechen</Button>
          <Button onClick={handleConfirm} disabled={posting} className="gap-2">
            <IconBrandSlack className="size-4" />
            {posting ? "Wird gepostet…" : "In Slack posten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── VakanzSchließenDialog ──────────────────────────────────────────────────────

function VakanzSchließenDialog({ open, onOpenChange, vakanz, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; vakanz: Vakanz | null; onSuccess: () => void }) {
  const [closing, setClosing] = React.useState(false)

  async function handleConfirm() {
    if (!vakanz) return
    setClosing(true)
    try {
      const res = await fetch(`/api/vakanzen/${vakanz.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Geschlossen" }) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Unbekannter Fehler") }
      toast.success("Vakanz geschlossen"); onOpenChange(false); onSuccess()
    } catch (err) {
      toast.error(`Fehler beim Schließen.${err instanceof Error ? ` (${err.message})` : ""}`)
    } finally { setClosing(false) }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vakanz wirklich schließen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle offenen Einreichungen bleiben bestehen.{" "}
            {vakanz && <span className="font-medium text-foreground">&ldquo;{vakanz.rolle}&rdquo;</span>}{" "}
            wird auf den Status &ldquo;Geschlossen&rdquo; gesetzt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={closing}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={closing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {closing ? "Schließen…" : "Vakanz schließen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── VakanzCard ─────────────────────────────────────────────────────────────────

interface VakanzCardProps {
  vakanz: Vakanz
  isManagerOrAdmin: boolean
  isAgentur: boolean
  onBearbeiten: (v: Vakanz) => void
  onSchliessen: (v: Vakanz) => void
  onDetailpost: (v: Vakanz) => void
  onProfilEinreichen: (v: Vakanz) => void
  onRessourceEinsetzen: (v: Vakanz) => void
  onNavigate: (id: string) => void
  onTogglePublished: (v: Vakanz) => void
}

function VakanzCard({
  vakanz,
  isManagerOrAdmin,
  isAgentur,
  onBearbeiten,
  onSchliessen,
  onDetailpost,
  onProfilEinreichen,
  onRessourceEinsetzen,
  onNavigate,
  onTogglePublished,
}: VakanzCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [profiles, setProfiles] = React.useState<InlineProfile[] | null>(null)
  const [resources, setResources] = React.useState<PoolRessource[] | null>(null)
  const [loadingProfiles, setLoadingProfiles] = React.useState(false)
  const [withdrawingId, setWithdrawingId] = React.useState<string | null>(null)
  const [liveCount, setLiveCount] = React.useState<number | null>(null)

  async function handleToggle() {
    if (!expanded && profiles === null) {
      setLoadingProfiles(true)
      try {
        const [profileRes, ressourcenRes] = await Promise.all([
          fetch(`/api/profile?vakanz_id=${vakanz.id}`),
          fetch(`/api/ressourcen?vakanz_id=${vakanz.id}`),
        ])
        const profileData = profileRes.ok ? await profileRes.json() : []
        const ressourcenData = ressourcenRes.ok ? await ressourcenRes.json() : { ressourcen: [] }

        const profileArray = Array.isArray(profileData) ? profileData : []
        const ressourcenArray = (ressourcenData.ressourcen ?? []).filter((r: PoolRessource) => r.bereits_gespielt)

        const merged: InlineProfile[] = [
          ...profileArray.map((p: InlineProfile) => ({ ...p, quelle: 'profil' as const })),
          ...ressourcenArray.map((r: PoolRessource) => ({
            id: r.link_id || r.id,
            kandidatenname: r.name,
            status: r.link_status || 'Gespielt',
            ki_score: r.ki_score ?? null,
            agentur_name: null,
            quelle: 'pool' as const,
            ressource_id: r.id,
          })),
        ]
        setProfiles(merged)
        setResources(ressourcenArray)
        setLiveCount(merged.length)
      } catch {
        setProfiles([])
        setResources([])
      } finally {
        setLoadingProfiles(false)
      }
    }
    setExpanded((prev) => !prev)
  }

  async function handleWithdraw(p: InlineProfile) {
    if (!window.confirm(`„${p.kandidatenname}" zurückziehen?`)) return
    setWithdrawingId(p.id)
    try {
      let res: Response
      if (p.quelle === 'pool') {
        res = await fetch(`/api/ressource-links/${p.id}/rueckzug`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      } else {
        res = await fetch(`/api/profile/${p.id}`, { method: 'DELETE' })
      }
      if (res.ok) {
        setProfiles((prev) => prev ? prev.filter((x) => x.id !== p.id) : prev)
        setLiveCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null))
        toast.success(`„${p.kandidatenname}" zurückgezogen`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Zurückziehen fehlgeschlagen')
      }
    } finally {
      setWithdrawingId(null)
    }
  }

  const profileCount = liveCount ?? (vakanz.profile_anzahl ?? 0)

  return (
    <div
      className={`group overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-sm border-l-4 ${statusBorderLeft[vakanz.status]}`}
    >
      {/* ── Card Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex cursor-pointer items-start gap-3 px-4 py-3.5 select-none"
        onClick={() => onNavigate(vakanz.id)}
      >
        {/* Main content — single row */}
        <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="font-semibold text-sm text-foreground leading-tight truncate max-w-[260px] shrink-0">
            {vakanz.rolle}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[vakanz.status]}`}
          >
            {vakanz.status}
          </span>
          <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${erfahrungsColors[vakanz.erfahrungslevel]}`}>
            {vakanz.erfahrungslevel}
          </span>
          <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${arbeitsmodellColors[vakanz.arbeitsmodell]}`}>
            {vakanz.arbeitsmodell}
          </span>
          <SkillTags skills={vakanz.skills} />
          <span className="text-xs text-muted-foreground shrink-0">Start: {vakanz.startdatum}</span>
          {vakanz.standort && <span className="text-xs text-muted-foreground shrink-0">· {vakanz.standort}</span>}
          {vakanz.kunde && <span className="text-xs text-muted-foreground shrink-0">· {vakanz.kunde}</span>}
          {isManagerOrAdmin && vakanz.budget_intern != null && (
            <span className="text-xs font-medium text-foreground shrink-0">· {vakanz.budget_intern.toLocaleString("de-DE")} €/Tag</span>
          )}
        </div>

        {/* Right side: profile count + slack indicator + dropdown */}
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Publish toggle pill */}
          {isManagerOrAdmin && (
            <button
              onClick={() => onTogglePublished(vakanz)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                vakanz.published
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              {vakanz.published ? (
                <><IconEye className="size-3.5" />Öffentlich</>
              ) : (
                <><IconEyeOff className="size-3.5" />Entwurf</>
              )}
            </button>
          )}

          {/* Slack posted indicator */}
          {isManagerOrAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    {vakanz.slack_detail_posted_at ? (
                      <IconCheck className="size-4 text-green-500" />
                    ) : (
                      <IconClock className="size-4 text-muted-foreground/30" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {vakanz.slack_detail_posted_at
                    ? `Gepostet: ${new Date(vakanz.slack_detail_posted_at).toLocaleString("de-DE")}`
                    : "Noch nicht gepostet"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Profile count pill */}
          <button
            onClick={handleToggle}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              expanded
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border bg-muted/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"
            }`}
          >
            <IconUsers className="size-3.5" />
            {profileCount}
            <IconChevronDown
              className={`size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <IconDotsVertical className="size-4" />
                <span className="sr-only">Aktionen</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isManagerOrAdmin ? (
                <>
                  <DropdownMenuItem onClick={() => onNavigate(vakanz.id)}>Details anzeigen</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBearbeiten(vakanz)}>Bearbeiten</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDetailpost(vakanz)}>
                    <IconBrandSlack className="size-3.5 text-[#4A154B]" />
                    Detailpost senden
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={vakanz.status === "Geschlossen"}
                    onClick={() => onSchliessen(vakanz)}
                  >
                    Schließen
                  </DropdownMenuItem>
                </>
              ) : isAgentur ? (
                <>
                  <DropdownMenuItem onClick={() => onNavigate(vakanz.id)}>Details anzeigen</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={vakanz.status !== "Offen"}
                    onClick={() => onRessourceEinsetzen(vakanz)}
                  >
                    Ressource einsetzen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={vakanz.status !== "Offen"}
                    onClick={() => onProfilEinreichen(vakanz)}
                  >
                    Profil einreichen
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => onNavigate(vakanz.id)}>Details anzeigen</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Expanded candidate panel ─────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 p-4">
          {loadingProfiles ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          ) : !profiles || profiles.length === 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Noch keine Profile eingereicht.</span>
              {(isManagerOrAdmin || (isAgentur && vakanz.status === "Offen")) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    isAgentur ? onRessourceEinsetzen(vakanz) : onNavigate(vakanz.id)
                  }
                >
                  {isAgentur ? "Ressource einsetzen" : "Zur Vakanz"}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Resources Table */}
              {resources && resources.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pool-Ressourcen</h4>
                  <GespielteRessourcenTable
                    resources={resources}
                    vakanzId={vakanz.id}
                    onWithdraw={(r) => {
                      if (!r.link_id) { toast.error('Link-ID fehlt'); return }
                      handleWithdraw({
                        id: r.link_id,
                        kandidatenname: r.name,
                        status: r.link_status || 'Gespielt',
                        ki_score: r.ki_score ?? null,
                        agentur_name: null,
                        quelle: 'pool',
                        ressource_id: r.id,
                      })
                    }}
                  />
                </div>
              )}

              {/* CV Profiles */}
              {profiles.filter(p => p.quelle === 'profil').length > 0 && (
                <div>
                  {resources && resources.length > 0 && <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">CV-Profile</h4>}
                  <div className="divide-y divide-border/40 border border-border rounded-lg">
                    {profiles.filter(p => p.quelle === 'profil').map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className="shrink-0 inline-flex items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600">
                          CV
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {p.kandidatenname}
                        </span>
                        {isManagerOrAdmin && p.agentur_name && (
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                            {p.agentur_name}
                          </span>
                        )}
                        <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${profilStatusColors[p.status as ProfilStatus] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {p.status}
                        </span>
                        <KiScoreBadge score={p.ki_score} />
                        <Link
                          href={`/profile/${p.id}`}
                          className="shrink-0 text-xs text-primary hover:underline underline-offset-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Profil →
                        </Link>
                        {isAgentur && p.status === 'Eingereicht' && (
                          <button
                            disabled={withdrawingId === p.id}
                            onClick={(e) => { e.stopPropagation(); handleWithdraw(p) }}
                            className="shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                          >
                            {withdrawingId === p.id ? '…' : 'Zurückziehen'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer actions */}
              {isAgentur && vakanz.status === "Offen" && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onRessourceEinsetzen(vakanz)}
                  >
                    <IconPlus className="size-3 mr-1" />
                    Ressource einsetzen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onProfilEinreichen(vakanz)}
                  >
                    Profil einreichen
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── VakanzCardSkeleton ─────────────────────────────────────────────────────────

function VakanzCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-xs border-l-4 border-l-border">
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  )
}

// ── VakanzenPage ───────────────────────────────────────────────────────────────

export default function VakanzenPage() {
  const { user } = useUser()
  const router = useRouter()

  const isManagerOrAdmin = user?.rolle === "Admin" || user?.rolle === "Staffhub Manager"
  const isAgentur = user?.rolle === "Agentur"

  const [vakanzen, setVakanzen] = React.useState<Vakanz[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [searchQuery, setSearchQuery] = React.useState("")

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editingVakanz, setEditingVakanz] = React.useState<Vakanz | null>(null)
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false)
  const [closingVakanz, setClosingVakanz] = React.useState<Vakanz | null>(null)
  const [profilSheetOpen, setProfilSheetOpen] = React.useState(false)
  const [profilVakanz, setProfilVakanz] = React.useState<Vakanz | null>(null)
  const [ressourceEinsetzenOpen, setRessourceEinsetzenOpen] = React.useState(false)
  const [ressourceEinsetzenVakanz, setRessourceEinsetzenVakanz] = React.useState<Vakanz | null>(null)
  const [detailpostDialogOpen, setDetailpostDialogOpen] = React.useState(false)
  const [detailpostVakanz, setDetailpostVakanz] = React.useState<Vakanz | null>(null)
  const [updatepostDialogOpen, setUpdatepostDialogOpen] = React.useState(false)

  async function fetchVakanzen() {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/vakanzen")
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error ?? `HTTP ${res.status}`) }
      const data = await res.json()
      setVakanzen(data.vakanzen ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden.")
    } finally { setLoading(false) }
  }

  React.useEffect(() => { fetchVakanzen() }, [])

  const filtered = vakanzen.filter((v) => {
    const matchesStatus = statusFilter === "alle" || v.status === statusFilter
    const matchesSearch = searchQuery === "" || v.rolle.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  async function handleDetailpostConfirm(workspace: SlackWorkspace, channel: SlackChannel) {
    if (!detailpostVakanz) return
    try {
      const res = await fetch(`/api/vakanzen/${detailpostVakanz.id}/slack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace, channel }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error ?? "Detailpost fehlgeschlagen."); return }
      toast.success(`Detailpost in ${workspace === "freelance" ? "Freelance" : "Partner"} → ${channel} gesendet.`)
      setVakanzen((prev) => prev.map((v) => v.id === detailpostVakanz.id ? { ...v, slack_detail_posted_at: body.slack_detail_posted_at ?? new Date().toISOString() } : v))
    } catch { toast.error("Verbindungsfehler beim Detailpost.") }
  }

  async function handleTogglePublished(vakanz: Vakanz) {
    const newPublished = !vakanz.published
    setVakanzen((prev) => prev.map((v) => v.id === vakanz.id ? { ...v, published: newPublished } : v))
    try {
      const res = await fetch(`/api/vakanzen/${vakanz.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: newPublished }),
      })
      if (!res.ok) {
        setVakanzen((prev) => prev.map((v) => v.id === vakanz.id ? { ...v, published: !newPublished } : v))
        toast.error("Fehler beim Aktualisieren")
      } else {
        toast.success(newPublished ? "Vakanz veröffentlicht" : "Vakanz als Entwurf gespeichert")
      }
    } catch {
      setVakanzen((prev) => prev.map((v) => v.id === vakanz.id ? { ...v, published: !newPublished } : v))
      toast.error("Verbindungsfehler")
    }
  }

  async function handleUpdatepostConfirm(workspace: SlackWorkspace, channel: SlackChannel) {
    try {
      const res = await fetch("/api/slack/updatepost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace, channel }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error ?? "Updatepost fehlgeschlagen."); return }
      toast.success(`Updatepost gesendet (${body.vakanzen_count ?? "?"} Vakanzen → ${workspace === "freelance" ? "Freelance" : "Partner"} / ${channel}).`)
    } catch { toast.error("Verbindungsfehler beim Updatepost.") }
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Vakanzen" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* ── Header ──────────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Vakanzen</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Lädt…" : `${filtered.length} Vakanzen`}
                  </p>
                </div>
                {isManagerOrAdmin && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setUpdatepostDialogOpen(true)} className="gap-1.5">
                      <IconRefresh className="size-4" />
                      Updatepost
                    </Button>
                    <Button size="sm" onClick={() => { setSheetMode("create"); setEditingVakanz(null); setSheetOpen(true) }}>
                      <IconPlus className="size-4" />
                      Neue Vakanz
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Filter Bar ──────────────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Vakanz suchen…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Status</SelectItem>
                    <SelectItem value="Offen">Offen</SelectItem>
                    <SelectItem value="In Auswahl">In Auswahl</SelectItem>
                    <SelectItem value="Besetzt">Besetzt</SelectItem>
                    <SelectItem value="Pausiert">Pausiert</SelectItem>
                    <SelectItem value="Geschlossen">Geschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Error ───────────────────────────────────────────────────── */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler beim Laden der Vakanzen: {error}
                </div>
              )}

              {/* ── Card List ───────────────────────────────────────────────── */}
              <div className="flex flex-col gap-2 px-4 lg:px-6">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <VakanzCardSkeleton key={i} />)
                ) : filtered.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-muted-foreground">
                    {vakanzen.length === 0 && isManagerOrAdmin ? (
                      <span className="text-sm">
                        Noch keine Vakanzen angelegt.{" "}
                        <button
                          className="text-primary underline-offset-4 hover:underline"
                          onClick={() => { setSheetMode("create"); setEditingVakanz(null); setSheetOpen(true) }}
                        >
                          Neue Vakanz erstellen
                        </button>
                      </span>
                    ) : (
                      <span className="text-sm">Keine Vakanzen gefunden.</span>
                    )}
                  </div>
                ) : (
                  filtered.map((v) => (
                    <VakanzCard
                      key={v.id}
                      vakanz={v}
                      isManagerOrAdmin={isManagerOrAdmin}
                      isAgentur={isAgentur}
                      onBearbeiten={(vak) => { setSheetMode("edit"); setEditingVakanz(vak); setSheetOpen(true) }}
                      onSchliessen={(vak) => { setClosingVakanz(vak); setCloseDialogOpen(true) }}
                      onDetailpost={(vak) => { setDetailpostVakanz(vak); setDetailpostDialogOpen(true) }}
                      onProfilEinreichen={(vak) => { setProfilVakanz(vak); setProfilSheetOpen(true) }}
                      onRessourceEinsetzen={(vak) => { setRessourceEinsetzenVakanz(vak); setRessourceEinsetzenOpen(true) }}
                      onNavigate={(id) => router.push(`/vakanzen/${id}`)}
                      onTogglePublished={handleTogglePublished}
                    />
                  ))
                )}
              </div>

            </div>
          </div>
        </div>
      </SidebarInset>

      <VakanzFormSheet open={sheetOpen} onOpenChange={setSheetOpen} mode={sheetMode} vakanz={editingVakanz} showBudget={isManagerOrAdmin} onSuccess={fetchVakanzen} />
      <VakanzSchließenDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen} vakanz={closingVakanz} onSuccess={fetchVakanzen} />

      {profilVakanz && (
        <ProfilEinreichenSheet
          open={profilSheetOpen}
          onOpenChange={setProfilSheetOpen}
          vakanzId={profilVakanz.id}
          vakanzTitel={profilVakanz.rolle}
          onSuccess={(newProfilId?: string) => {
            fetchVakanzen()
            if (newProfilId) fetch(`/api/profile/${newProfilId}/ki-bewertung`, { method: "POST" }).catch(() => {})
          }}
        />
      )}

      {ressourceEinsetzenVakanz && (
        <RessourceEinsetzenDialog
          open={ressourceEinsetzenOpen}
          onOpenChange={setRessourceEinsetzenOpen}
          vakanzId={ressourceEinsetzenVakanz.id}
          vakanzTitel={ressourceEinsetzenVakanz.rolle}
          onSuccess={fetchVakanzen}
        />
      )}

      <SlackPostDialog open={detailpostDialogOpen} onOpenChange={setDetailpostDialogOpen} postType="detail" vakanzTitel={detailpostVakanz?.rolle} onConfirm={handleDetailpostConfirm} />
      <SlackPostDialog open={updatepostDialogOpen} onOpenChange={setUpdatepostDialogOpen} postType="update" onConfirm={handleUpdatepostConfirm} />
    </SidebarProvider>
  )
}