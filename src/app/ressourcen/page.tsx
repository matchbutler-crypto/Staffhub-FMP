"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import {
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconLink,
  IconMessage,
  IconPlus,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

import { ERFAHRUNGSLEVEL, RESSOURCE_VERFUEGBARKEIT } from "@/lib/constants"
import type { Erfahrungslevel, RessourceVerfuegbarkeit } from "@/lib/constants"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  link_count?: number
  created_at: string
  updated_at: string
  agenturen?: Agentur | null
}

type LinkStatus =
  | "Gespielt"
  | "Interview geplant"
  | "Zugesagt"
  | "Abgesagt"
  | "Abgelehnt"
  | "Zurückgezogen"

interface VakanzLink {
  id: string
  ressource_id: string
  vakanz_id: string
  status: LinkStatus
  interview_datum: string | null
  created_at: string
  updated_at: string
  vakanzen_data: {
    id: string
    rolle: string
    status: string
    erfahrungslevel?: string | null
    arbeitsmodell?: string | null
    standort?: string | null
    branche?: string | null
    startdatum?: string | null
    enddatum?: string | null
  } | null
}

interface Vakanz {
  id: string
  rolle: string
  status: string
}

interface FeedbackAuthor {
  id: string
  name: string
  rolle: string
}

interface Feedback {
  id: string
  text: string
  bewertung: number | null
  created_at: string
  vakanz_id: string | null
  vakanzen_data: { id: string; rolle: string } | null
  profiles: FeedbackAuthor | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<LinkStatus, LinkStatus[]> = {
  Gespielt: ["Interview geplant", "Abgesagt", "Abgelehnt"],
  "Interview geplant": ["Zugesagt", "Abgesagt", "Abgelehnt"],
  Zugesagt: [],
  Abgesagt: [],
  Abgelehnt: [],
  Zurückgezogen: [],
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

const linkStatusColors: Record<LinkStatus, string> = {
  Gespielt: "bg-blue-100 text-blue-700 border-blue-200",
  "Interview geplant": "bg-amber-100 text-amber-700 border-amber-200",
  Zugesagt: "bg-green-100 text-green-700 border-green-200",
  Abgesagt: "bg-gray-100 text-gray-500 border-gray-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Zurückgezogen: "bg-gray-100 text-gray-400 border-gray-200",
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

// ── VakanzSpielenDialog ────────────────────────────────────────────────────────

interface VakanzSpielenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ressourceId: string
  ressourceName: string
  onSuccess: () => void
}

function VakanzSpielenDialog({
  open,
  onOpenChange,
  ressourceId,
  ressourceName,
  onSuccess,
}: VakanzSpielenDialogProps) {
  const [vakanzen, setVakanzen] = React.useState<Vakanz[]>([])
  const [loadingVakanzen, setLoadingVakanzen] = React.useState(false)
  const [selectedVakanzId, setSelectedVakanzId] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setSelectedVakanzId("")
      return
    }
    setLoadingVakanzen(true)
    fetch("/api/vakanzen")
      .then((r) => r.json())
      .then((d) =>
        setVakanzen(
          (d.vakanzen ?? []).filter((v: Vakanz) => v.status === "Offen")
        )
      )
      .catch(() => toast.error("Vakanzen konnten nicht geladen werden"))
      .finally(() => setLoadingVakanzen(false))
  }, [open])

  async function handleSpiele() {
    if (!selectedVakanzId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/spielen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: selectedVakanzId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      toast.success(`„${ressourceName}" wurde auf die Vakanz gespielt`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Spielen")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Auf Vakanz spielen</DialogTitle>
          <DialogDescription>
            Wählen Sie eine offene Vakanz für „{ressourceName}".
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Vakanz</Label>
            {loadingVakanzen ? (
              <Skeleton className="h-9 w-full" />
            ) : vakanzen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine offenen Vakanzen vorhanden.
              </p>
            ) : (
              <Select
                value={selectedVakanzId}
                onValueChange={setSelectedVakanzId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vakanz auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {vakanzen.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.rolle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSpiele}
            disabled={saving || !selectedVakanzId || loadingVakanzen}
          >
            {saving ? "Spielen…" : "Auf Vakanz spielen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── StatusUpdateDialog ─────────────────────────────────────────────────────────

interface StatusUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  link: VakanzLink | null
  onSuccess: () => void
}

function StatusUpdateDialog({
  open,
  onOpenChange,
  link,
  onSuccess,
}: StatusUpdateDialogProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<LinkStatus | "">(
    ""
  )
  const [interviewDatum, setInterviewDatum] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const allowedStatuses = link ? VALID_TRANSITIONS[link.status] : []

  React.useEffect(() => {
    if (open) {
      setSelectedStatus("")
      setInterviewDatum("")
    }
  }, [open])

  async function handleUpdate() {
    if (!link || !selectedStatus) return
    if (selectedStatus === "Interview geplant" && !interviewDatum) {
      toast.error("Bitte Datum eingeben")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, string> = { status: selectedStatus }
      if (selectedStatus === "Interview geplant") {
        body.interview_datum = interviewDatum
      }
      const res = await fetch(`/api/ressource-links/${link.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      toast.success(`Status auf „${selectedStatus}" gesetzt`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Aktualisieren"
      )
    } finally {
      setSaving(false)
    }
  }

  if (!link) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Status weiterschalten</DialogTitle>
          <DialogDescription>
            Aktuell:{" "}
            <span className="font-medium">{link.status}</span>
            {link.vakanzen_data && <> · {link.vakanzen_data.rolle}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Neuer Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(v) => setSelectedStatus(v as LinkStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status wählen…" />
              </SelectTrigger>
              <SelectContent>
                {allowedStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedStatus === "Interview geplant" && (
            <div className="flex flex-col gap-1.5">
              <Label>
                Interview-Datum <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={interviewDatum}
                onChange={(e) => setInterviewDatum(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={
              saving ||
              !selectedStatus ||
              (selectedStatus === "Interview geplant" && !interviewDatum)
            }
          >
            {saving ? "Speichern…" : "Status setzen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── StarRating ─────────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number | null
  onChange?: (v: number | null) => void
  readonly?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          className={readonly ? "cursor-default" : "cursor-pointer"}
          onClick={() => {
            if (readonly || !onChange) return
            onChange(value === n ? null : n)
          }}
        >
          {value != null && n <= value ? (
            <IconStarFilled className="size-4 text-amber-400" />
          ) : (
            <IconStar className="size-4 text-muted-foreground/40" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── FeedbackTab ────────────────────────────────────────────────────────────────

interface FeedbackTabProps {
  ressourceId: string
  isManager: boolean
}

function FeedbackTab({ ressourceId, isManager }: FeedbackTabProps) {
  const [feedbacks, setFeedbacks] = React.useState<Feedback[]>([])
  const [loading, setLoading] = React.useState(true)
  const [text, setText] = React.useState("")
  const [bewertung, setBewertung] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  async function loadFeedback() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/feedback`)
      if (res.ok) {
        const d = await res.json()
        setFeedbacks(d.feedback ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadFeedback()
    // Get current user id from supabase session via profile endpoint
    fetch("/api/ressourcen")
      .then((r) => r.headers.get("x-user-id"))
      .catch(() => null)
    // Fallback: we get the author from profile.id in feedback entries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ressourceId])

  // Derive currentUserId from the first feedback entry authored by the user (rough heuristic)
  // or use a dedicated /api/me-style check — we use profiles from feedback list
  React.useEffect(() => {
    if (feedbacks.length > 0 && !currentUserId) {
      // We can't determine this without a /api/me endpoint
      // The delete button uses RLS to enforce — we show it optimistically for all own entries
    }
  }, [feedbacks, currentUserId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), bewertung }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      setText("")
      setBewertung(null)
      await loadFeedback()
      toast.success("Feedback gespeichert")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/ressource-feedback/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      setFeedbacks((prev) => prev.filter((f) => f.id !== id))
      toast.success("Feedback gelöscht")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen")
    }
  }

  const rated = feedbacks.filter((f) => f.bewertung != null)
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, f) => sum + f.bewertung!, 0) / rated.length
      : null

  return (
    <div className="flex flex-col gap-4">
      {/* Average */}
      {avgRating != null && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
            <StarRating value={Math.round(avgRating)} readonly />
          </div>
          <p className="text-xs text-muted-foreground">
            Durchschnitt aus {rated.length} Bewertung{rated.length !== 1 ? "en" : ""}
          </p>
        </div>
      )}

      {/* New feedback form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Bewertung (optional)</Label>
          <StarRating value={bewertung} onChange={setBewertung} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            Feedback-Text <span className="text-destructive">*</span>
          </Label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Ihre Einschätzung zur Ressource…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={saving || !text.trim()}
          >
            {saving ? "Speichern…" : "Feedback senden"}
          </Button>
        </div>
      </form>

      {/* Feedback list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <IconMessage className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Noch kein Feedback vorhanden.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">
                    {fb.profiles?.name ?? "Unbekannt"}
                    {isManager && fb.profiles?.rolle && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        ({fb.profiles.rolle})
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(fb.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {fb.bewertung != null && (
                    <StarRating value={fb.bewertung} readonly />
                  )}
                  <button
                    type="button"
                    className="ml-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Feedback löschen"
                    onClick={() => handleDelete(fb.id)}
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{fb.text}</p>
              {fb.vakanzen_data && (
                <span className="text-xs text-muted-foreground">
                  Vakanz: {fb.vakanzen_data.rolle}
                </span>
              )}
              {fb.vakanz_id && !fb.vakanzen_data && (
                <span className="text-xs text-muted-foreground">
                  Vakanz nicht mehr vorhanden
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── RessourceDetailSheet ───────────────────────────────────────────────────────

interface RessourceDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ressource: Ressource | null
  isManager?: boolean
}

function RessourceDetailSheet({
  open,
  onOpenChange,
  ressource,
  isManager = true,
}: RessourceDetailSheetProps) {
  const [links, setLinks] = React.useState<VakanzLink[]>([])
  const [linksLoading, setLinksLoading] = React.useState(false)
  const [spielenOpen, setSpielenOpen] = React.useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false)
  const [activeLink, setActiveLink] = React.useState<VakanzLink | null>(null)

  async function fetchLinks() {
    if (!ressource) return
    setLinksLoading(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/links`)
      if (!res.ok) return
      const d = await res.json()
      setLinks(d.links ?? [])
    } catch {
      // silently fail
    } finally {
      setLinksLoading(false)
    }
  }

  React.useEffect(() => {
    if (open && ressource) {
      fetchLinks()
    } else {
      setLinks([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ressource?.id])

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
      toast.error(
        err instanceof Error ? err.message : "CV-Download fehlgeschlagen"
      )
    }
  }

  if (!ressource) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-[480px] flex-col gap-0 overflow-hidden p-0 sm:w-[540px]"
        >
          <SheetHeader className="flex-none border-b px-6 py-4">
            <SheetTitle>{ressource.name}</SheetTitle>
            <SheetDescription>
              {ressource.agenturen?.name ?? "Unbekannte Agentur"}
            </SheetDescription>
          </SheetHeader>

          <Tabs
            defaultValue="details"
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="mx-6 mt-3 self-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="verknuepfungen">
                Verknüpfungen
                {links.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {links.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Details ── */}
            <TabsContent
              value="details"
              className="mt-0 flex-1 overflow-y-auto px-6 py-4"
            >
              <div className="flex flex-col gap-5">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={verfuegbarkeitColors[ressource.verfuegbarkeit]}
                  >
                    {ressource.verfuegbarkeit}
                    {ressource.verfuegbarkeit === "Verfügbar ab" &&
                      ressource.verfuegbar_ab &&
                      ` ${new Date(ressource.verfuegbar_ab).toLocaleDateString(
                        "de-DE"
                      )}`}
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notizen
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {ressource.notizen}
                    </p>
                  </div>
                )}

                {/* CV */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">
                      Kein CV vorhanden
                    </p>
                  )}
                </div>

                {/* Metadata */}
                <div className="rounded-lg border bg-muted/40 px-4 py-3">
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <span className="text-muted-foreground">Agentur</span>
                    <span>{ressource.agenturen?.name ?? "—"}</span>
                    <span className="text-muted-foreground">Angelegt</span>
                    <span>
                      {new Date(ressource.created_at).toLocaleDateString(
                        "de-DE"
                      )}
                    </span>
                    <span className="text-muted-foreground">Aktualisiert</span>
                    <span>
                      {new Date(ressource.updated_at).toLocaleDateString(
                        "de-DE"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 2: Verknüpfungen ── */}
            <TabsContent
              value="verknuepfungen"
              className="mt-0 flex-1 overflow-y-auto px-6 py-4"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Vakanz-Verknüpfungen
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={ressource.verfuegbarkeit === "Deaktiviert"}
                    onClick={() => setSpielenOpen(true)}
                  >
                    <IconPlus className="size-3.5" />
                    Auf Vakanz spielen
                  </Button>
                </div>

                {linksLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : links.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <IconLink className="size-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Noch keine Vakanz-Verknüpfungen.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y rounded-lg border">
                    {links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-start justify-between gap-2 px-4 py-3"
                      >
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <p className="truncate text-sm font-medium">
                            {link.vakanzen_data?.rolle ?? "Unbekannte Vakanz"}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={linkStatusColors[link.status]}
                            >
                              {link.status}
                            </Badge>
                            {link.interview_datum && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <IconClock className="size-3" />
                                {new Date(
                                  link.interview_datum
                                ).toLocaleDateString("de-DE")}
                              </span>
                            )}
                          </div>
                        </div>
                        {VALID_TRANSITIONS[link.status].length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 gap-1 text-xs"
                            onClick={() => {
                              setActiveLink(link)
                              setStatusDialogOpen(true)
                            }}
                          >
                            <IconArrowRight className="size-3.5" />
                            Status
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab 3: Feedback ── */}
            <TabsContent
              value="feedback"
              className="mt-0 flex-1 overflow-y-auto px-6 py-4"
            >
              <FeedbackTab ressourceId={ressource.id} isManager={isManager} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <VakanzSpielenDialog
        open={spielenOpen}
        onOpenChange={setSpielenOpen}
        ressourceId={ressource.id}
        ressourceName={ressource.name}
        onSuccess={fetchLinks}
      />
      <StatusUpdateDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        link={activeLink}
        onSuccess={fetchLinks}
      />
    </>
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
  // ── Freelancer-Pool state ───────────────────────────────────────────────────
  const [ressourcen, setRessourcen] = React.useState<Ressource[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [levelFilter, setLevelFilter] = React.useState("alle")
  const [agenturFilter, setAgenturFilter] = React.useState("alle")
  const [showDeaktiviert, setShowDeaktiviert] = React.useState(false)

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [selectedRessource, setSelectedRessource] =
    React.useState<Ressource | null>(null)

  const router = useRouter()

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [linksCache, setLinksCache] = React.useState<Record<string, VakanzLink[]>>({})
  const [loadingLinkIds, setLoadingLinkIds] = React.useState<Set<string>>(new Set())

  async function handleToggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      return next
    })
    if (!(id in linksCache) && !loadingLinkIds.has(id)) {
      setLoadingLinkIds((prev) => new Set(prev).add(id))
      try {
        const res = await fetch(`/api/ressourcen/${id}/links`)
        if (res.ok) {
          const d = await res.json()
          setLinksCache((prev) => ({ ...prev, [id]: d.links ?? [] }))
        }
      } catch { /* silently fail */ }
      finally {
        setLoadingLinkIds((prev) => { const next = new Set(prev); next.delete(id); return next })
      }
    }
  }

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
      setError(
        err instanceof Error ? err.message : "Daten konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchRessourcen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeaktiviert])

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
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Freelancer-Pool</h2>
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
                <div className="relative min-w-[200px] max-w-sm flex-1">
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
                    {RESSOURCE_VERFUEGBARKEIT.filter((v) => v !== "Deaktiviert").map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Level</SelectItem>
                    {ERFAHRUNGSLEVEL.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
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
                      <SelectItem key={id} value={id}>{name}</SelectItem>
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

              {error && (
                <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  {error}
                </div>
              )}

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
                        <TableHead>Vakanzen</TableHead>
                        <TableHead>Aktualisiert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={8} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                            {ressourcen.length === 0 ? "Noch keine Ressourcen vorhanden." : "Keine Ressourcen für diese Filter."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => {
                          const isExpanded = expandedIds.has(r.id)
                          const isLoadingLinks = loadingLinkIds.has(r.id)
                          const cachedLinks = linksCache[r.id] ?? []
                          const linkCount = r.link_count ?? 0
                          return (
                            <React.Fragment key={r.id}>
                              <TableRow
                                className="cursor-pointer"
                                onClick={() => { setSelectedRessource(r); setDetailOpen(true) }}
                              >
                                <TableCell className="font-medium">{r.name}</TableCell>
                                <TableCell className="text-muted-foreground">{r.agenturen?.name ?? "—"}</TableCell>
                                <TableCell><SkillTags skills={r.skills} /></TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={erfahrungsColors[r.erfahrungslevel]}>
                                    {r.erfahrungslevel}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={verfuegbarkeitColors[r.verfuegbarkeit]}>
                                    {r.verfuegbarkeit}
                                    {r.verfuegbarkeit === "Verfügbar ab" && r.verfuegbar_ab &&
                                      ` ${new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")}`}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {r.ek_tagesrate != null ? `${r.ek_tagesrate.toLocaleString("de-DE")} €` : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell onClick={(e) => { if (linkCount > 0) handleToggleExpand(r.id, e) }}>
                                  {linkCount > 0 ? (
                                    <button
                                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                        isExpanded
                                          ? "border-primary/30 bg-primary/5 text-primary"
                                          : "border-border bg-muted/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                      }`}
                                    >
                                      <IconLink className="size-3.5" />
                                      {linkCount}
                                      <IconChevronDown
                                        className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(r.updated_at).toLocaleDateString("de-DE")}
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableCell colSpan={8} className="px-6 py-0">
                                    {isLoadingLinks ? (
                                      <div className="py-2">
                                        {[1, 2].map((i) => (
                                          <div key={i} className="flex gap-4 py-1.5">
                                            {Array.from({ length: 7 }).map((_, j) => (
                                              <Skeleton key={j} className="h-4 flex-1 rounded" />
                                            ))}
                                          </div>
                                        ))}
                                      </div>
                                    ) : cachedLinks.length === 0 ? (
                                      <div className="py-3 text-xs text-muted-foreground">Noch auf keine Vakanz gespielt.</div>
                                    ) : (
                                      <div className="py-2">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="text-muted-foreground">
                                              <th className="py-1.5 pr-4 text-left font-medium">Vakanz</th>
                                              <th className="py-1.5 pr-4 text-left font-medium">Status</th>
                                              <th className="py-1.5 pr-4 text-left font-medium">Level</th>
                                              <th className="py-1.5 pr-4 text-left font-medium">Standort/Remote</th>
                                              <th className="py-1.5 pr-4 text-left font-medium">Sektor</th>
                                              <th className="py-1.5 pr-4 text-left font-medium">Start</th>
                                              <th className="py-1.5 text-left font-medium">Ende</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/50">
                                            {cachedLinks.map((link) => {
                                              const vd = link.vakanzen_data
                                              const standortLabel = [vd?.arbeitsmodell, vd?.standort].filter(Boolean).join(" · ") || "—"
                                              return (
                                                <tr key={link.id}>
                                                  <td className="py-1.5 pr-4 font-medium text-foreground">
                                                    <button
                                                      className="text-left hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                                                      onClick={(e) => { e.stopPropagation(); if (link.vakanz_id) router.push(`/vakanzen/${link.vakanz_id}`) }}
                                                    >
                                                      {vd?.rolle ?? "—"}
                                                    </button>
                                                  </td>
                                                  <td className="py-1.5 pr-4">
                                                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${linkStatusColors[link.status]}`}>
                                                      {link.status}
                                                    </span>
                                                  </td>
                                                  <td className="py-1.5 pr-4 text-muted-foreground">{vd?.erfahrungslevel ?? "—"}</td>
                                                  <td className="py-1.5 pr-4 text-muted-foreground">{standortLabel}</td>
                                                  <td className="py-1.5 pr-4 text-muted-foreground">{vd?.branche ?? "—"}</td>
                                                  <td className="py-1.5 pr-4 text-muted-foreground">
                                                    {vd?.startdatum ? new Date(vd.startdatum).toLocaleDateString("de-DE") : "—"}
                                                  </td>
                                                  <td className="py-1.5 text-muted-foreground">
                                                    {vd?.enddatum ? new Date(vd.enddatum).toLocaleDateString("de-DE") : "—"}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
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
