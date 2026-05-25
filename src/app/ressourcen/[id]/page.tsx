"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconBriefcase,
  IconCalendar,
  IconClock,
  IconFileText,
  IconLoader2,
  IconMapPin,
  IconPencil,
  IconUpload,
  IconUser,
  IconX,
  IconCheck,
  IconDownload,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Ressource {
  id: string
  ressource_code?: string | null
  name: string
  vorname?: string | null
  nachname?: string | null
  geburtsdatum?: string | null
  email?: string | null
  telefon?: string | null
  wohnort?: string | null
  agentur_id: string
  agentur_name?: string | null
  verfuegbarkeit: string
  verfuegbar_ab?: string | null
  notizen?: string | null
  erfahrungslevel?: string | null
  rolle?: string | null
  skills?: string[]
  arbeitsmodell?: string | null
  location?: string | null
  ek_tagesrate?: number | null
  cv_pfad?: string | null
  created_at: string
  beauftragungen: Beauftragung[]
}

interface Beauftragung {
  id: string
  vakanz_nr: string
  vakanz_titel: string
  status: string
  startdatum: string
  enddatum: string | null
  agentur_name: string
}

interface Zeitnachweis {
  id: string
  datum: string
  stunden: number
  beschreibung: string
  hochgeladen_von: string
  created_at: string
}

const StammdatenSchema = z.object({
  vorname: z.string().min(1),
  nachname: z.string().min(1),
  geburtsdatum: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  telefon: z.string().optional(),
  adresse: z.string().optional(),
  notizen: z.string().optional(),
})

type StammdatenFormValues = z.infer<typeof StammdatenSchema>

// ── Helpers ────────────────────────────────────────────────────────────────────

const VERFUEGBARKEIT_DOT: Record<string, string> = {
  "Jetzt verfügbar": "bg-emerald-500",
  "Verfügbar ab": "bg-amber-400",
  "Nicht verfügbar": "bg-zinc-400",
  "Deaktiviert": "bg-red-400",
}

const VERFUEGBARKEIT_TEXT: Record<string, string> = {
  "Jetzt verfügbar": "text-emerald-700",
  "Verfügbar ab": "text-amber-700",
  "Nicht verfügbar": "text-zinc-500",
  "Deaktiviert": "text-red-600",
}

const BEAUFTRAGUNG_STATUS: Record<string, string> = {
  Aktiv: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Abgeschlossen: "bg-zinc-100 text-zinc-600 border-zinc-200",
  Abgebrochen: "bg-red-50 text-red-600 border-red-200",
  Geplant: "bg-blue-50 text-blue-700 border-blue-200",
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide self-center">
        {label}
      </span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  )
}

// ── Sidebar Panel ──────────────────────────────────────────────────────────────

function SidebarPanel({
  ressource,
  isAgentur,
  onUpdate,
}: {
  ressource: Ressource
  isAgentur: boolean
  onUpdate: () => void
}) {
  const [savingStatus, setSavingStatus] = React.useState(false)
  const [currentStatus, setCurrentStatus] = React.useState(ressource.verfuegbarkeit)

  const handleStatusChange = async (newStatus: string) => {
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/verfuegbarkeit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verfuegbarkeit: newStatus }),
      })
      if (!res.ok) throw new Error()
      setCurrentStatus(newStatus)
      toast.success("Status aktualisiert")
      onUpdate()
    } catch {
      toast.error("Fehler beim Aktualisieren")
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-muted/20 px-5 py-6 space-y-0">
      {/* Availability */}
      <MetaRow label="Verfügbarkeit">
        {isAgentur ? (
          <Select value={currentStatus} onValueChange={handleStatusChange} disabled={savingStatus}>
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0 gap-1.5 w-auto">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${VERFUEGBARKEIT_DOT[currentStatus] ?? "bg-zinc-400"}`} />
                <span className={`font-medium ${VERFUEGBARKEIT_TEXT[currentStatus] ?? "text-foreground"}`}>
                  <SelectValue />
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Jetzt verfügbar">Jetzt verfügbar</SelectItem>
              <SelectItem value="Verfügbar ab">Verfügbar ab</SelectItem>
              <SelectItem value="Nicht verfügbar">Nicht verfügbar</SelectItem>
              <SelectItem value="Deaktiviert">Deaktiviert</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${VERFUEGBARKEIT_DOT[currentStatus] ?? "bg-zinc-400"}`} />
            <span className={`font-medium ${VERFUEGBARKEIT_TEXT[currentStatus] ?? "text-foreground"}`}>
              {currentStatus}
            </span>
          </div>
        )}
      </MetaRow>

      {ressource.verfuegbar_ab && (
        <MetaRow label="Verfügbar ab">
          {new Date(ressource.verfuegbar_ab).toLocaleDateString("de-DE")}
        </MetaRow>
      )}

      {/* Agency */}
      {ressource.agentur_name && (
        <MetaRow label="Agentur">
          <span className="font-medium">{ressource.agentur_name}</span>
        </MetaRow>
      )}

      {/* Experience */}
      {ressource.erfahrungslevel && (
        <MetaRow label="Erfahrungslevel">
          <Badge variant="outline" className="text-xs font-medium">
            {ressource.erfahrungslevel}
          </Badge>
        </MetaRow>
      )}

      {/* Location */}
      {(ressource.location || ressource.arbeitsmodell) && (
        <MetaRow label="Standort">
          <div className="flex items-center gap-1.5 flex-wrap">
            {ressource.location && (
              <span className="flex items-center gap-1">
                <IconMapPin className="h-3 w-3 text-muted-foreground" />
                {ressource.location}
              </span>
            )}
            {ressource.arbeitsmodell && ressource.arbeitsmodell !== "Onshore" && (
              <span className="text-xs text-muted-foreground">· {ressource.arbeitsmodell}</span>
            )}
            {ressource.arbeitsmodell === "Onshore" && (
              <span className="text-xs text-muted-foreground">· Onshore</span>
            )}
          </div>
        </MetaRow>
      )}

      {/* EK Rate */}
      {ressource.ek_tagesrate != null && (
        <MetaRow label="EK-Tagesrate">
          <span className="font-semibold tabular-nums">
            {ressource.ek_tagesrate.toLocaleString("de-DE")} €
          </span>
          <span className="text-muted-foreground text-xs"> / Tag</span>
        </MetaRow>
      )}

      {/* Skills */}
      {ressource.skills && ressource.skills.length > 0 && (
        <MetaRow label={`Skills (${ressource.skills.length})`}>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {ressource.skills.map((s) => (
              <span
                key={s}
                className="inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </MetaRow>
      )}

      {/* CV */}
      {ressource.cv_pfad && (
        <MetaRow label="CV">
          <a
            href={ressource.cv_pfad}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <IconDownload className="h-3 w-3" />
            Herunterladen
          </a>
        </MetaRow>
      )}

      {/* Created */}
      <MetaRow label="Angelegt">
        {new Date(ressource.created_at).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </MetaRow>
    </aside>
  )
}

// ── Stammdaten Tab ─────────────────────────────────────────────────────────────

function StammdatenTab({
  ressource,
  isAgentur,
  onUpdate,
}: {
  ressource: Ressource
  isAgentur: boolean
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const { control, handleSubmit, reset, formState: { isDirty } } = useForm<StammdatenFormValues>({
    resolver: zodResolver(StammdatenSchema),
    defaultValues: {
      vorname: ressource.vorname ?? "",
      nachname: ressource.nachname ?? "",
      geburtsdatum: ressource.geburtsdatum ?? "",
      email: ressource.email ?? "",
      telefon: ressource.telefon ?? "",
      adresse: ressource.wohnort ?? "",
      notizen: ressource.notizen ?? "",
    },
  })

  const onSubmit = async (data: StammdatenFormValues) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success("Stammdaten aktualisiert")
      setIsEditing(false)
      onUpdate()
    } catch {
      toast.error("Fehler beim Speichern")
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Stammdaten bearbeiten</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setIsEditing(false); reset() }}
              className="gap-1.5 text-muted-foreground"
            >
              <IconX className="h-3.5 w-3.5" /> Abbrechen
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || isSaving} className="gap-1.5">
              {isSaving
                ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                : <IconCheck className="h-3.5 w-3.5" />}
              Speichern
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { name: "vorname" as const, label: "Vorname", type: "text" },
              { name: "nachname" as const, label: "Nachname", type: "text" },
              { name: "geburtsdatum" as const, label: "Geburtsdatum", type: "date" },
              { name: "email" as const, label: "E-Mail", type: "email" },
              { name: "telefon" as const, label: "Telefon", type: "text" },
              { name: "adresse" as const, label: "Wohnort / Adresse", type: "text" },
            ]
          ).map(({ name, label, type }) => (
            <div key={name}>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <Input {...field} type={type} className="mt-1" />
                )}
              />
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notizen</Label>
          <Controller
            control={control}
            name="notizen"
            render={({ field }) => (
              <Textarea {...field} className="mt-1 resize-none" rows={4} />
            )}
          />
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-5">
      {isAgentur && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-1.5"
          >
            <IconPencil className="h-3.5 w-3.5" /> Bearbeiten
          </Button>
        </div>
      )}

      <div className="divide-y divide-border">
        <FieldRow label="Vorname" value={ressource.vorname} />
        <FieldRow label="Nachname" value={ressource.nachname} />
        <FieldRow
          label="Geburtsdatum"
          value={
            ressource.geburtsdatum
              ? new Date(ressource.geburtsdatum).toLocaleDateString("de-DE")
              : null
          }
        />
        <FieldRow label="E-Mail" value={ressource.email} />
        <FieldRow label="Telefon" value={ressource.telefon} />
        <FieldRow label="Wohnort" value={ressource.wohnort} />
      </div>

      {ressource.notizen && (
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Notizen
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {ressource.notizen}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Beauftragungen Tab ─────────────────────────────────────────────────────────

function BeauftragungTab({ beauftragungen }: { beauftragungen: Beauftragung[] }) {
  if (beauftragungen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <IconBriefcase className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Keine Beauftragungen</p>
        <p className="text-xs text-muted-foreground mt-1">
          Diese Ressource wurde noch nicht beauftragt.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-6">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-6">Vakanz</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>Ende</TableHead>
            <TableHead className="pr-6">Agentur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {beauftragungen.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="pl-6 font-medium font-mono text-xs text-muted-foreground">
                {b.vakanz_nr}
              </TableCell>
              <TableCell className="font-medium">{b.vakanz_titel}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-xs ${BEAUFTRAGUNG_STATUS[b.status] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"}`}
                >
                  {b.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {b.startdatum ? new Date(b.startdatum).toLocaleDateString("de-DE") : "—"}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {b.enddatum ? new Date(b.enddatum).toLocaleDateString("de-DE") : "—"}
              </TableCell>
              <TableCell className="pr-6 text-sm text-muted-foreground">{b.agentur_name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Zeitnachweise Tab ──────────────────────────────────────────────────────────

function ZeitnachweisTab({
  zeitnachweise,
}: {
  ressource: Ressource
  zeitnachweise: Zeitnachweis[]
  onUpdate: () => void
}) {
  const totalStunden = zeitnachweise.reduce((sum, z) => sum + z.stunden, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
            Gesamt
          </p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">
            {totalStunden}
            <span className="text-sm font-normal text-muted-foreground ml-1">Stunden</span>
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5">
          <IconUpload className="h-3.5 w-3.5" /> Hochladen
        </Button>
      </div>

      {zeitnachweise.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <IconClock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Keine Zeitnachweise</p>
          <p className="text-xs text-muted-foreground mt-1">
            Noch keine Stunden erfasst.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Datum</TableHead>
                <TableHead>Stunden</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="pr-6">Hochgeladen von</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zeitnachweise.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="pl-6 tabular-nums">
                    {new Date(z.datum).toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">{z.stunden}h</TableCell>
                  <TableCell className="text-muted-foreground">{z.beschreibung}</TableCell>
                  <TableCell className="pr-6 text-muted-foreground">{z.hochgeladen_von}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RessourceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = React.useState("stammdaten")
  const [ressource, setRessource] = React.useState<Ressource | null>(null)
  const [zeitnachweise, setZeitnachweise] = React.useState<Zeitnachweis[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    if (!params.id) return
    try {
      const [ressourceRes, zeitnachweiseRes] = await Promise.all([
        fetch(`/api/ressourcen/${params.id}`),
        fetch(`/api/ressourcen/${params.id}/zeitnachweise`),
      ])
      if (ressourceRes.ok) setRessource(await ressourceRes.json())
      if (zeitnachweiseRes.ok) setZeitnachweise(await zeitnachweiseRes.json())
    } catch {
      toast.error("Fehler beim Laden der Daten")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => { loadData() }, [loadData])

  const isManager = user?.rolle === "Admin" || user?.rolle === "Staffhub Manager"
  const isAgentur = isManager || (user?.rolle === "Agentur" && user?.agentur_id === ressource?.agentur_id)

  // Loading skeleton
  if (userLoading || loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex h-96 items-center justify-center">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  // Not found
  if (!ressource) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex h-96 flex-col items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">Ressource nicht gefunden.</p>
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
              <IconArrowLeft className="h-4 w-4" /> Zurück
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const displayName =
    ressource.vorname || ressource.nachname
      ? `${ressource.vorname ?? ""} ${ressource.nachname ?? ""}`.trim()
      : ressource.name

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-col flex-1 min-h-0">
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            >
              <IconArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
            {ressource.ressource_code && (
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                {ressource.ressource_code}
              </span>
            )}
          </div>

          {/* ── Page header ── */}
          <div className="px-6 pt-6 pb-5 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
                  {displayName}
                </h1>
                {ressource.rolle && (
                  <p className="text-sm text-muted-foreground mt-0.5">{ressource.rolle}</p>
                )}
              </div>
              {/* Status pill — right side of header */}
              <div className="flex items-center gap-1.5 shrink-0 mt-1">
                <span
                  className={`h-2 w-2 rounded-full ${VERFUEGBARKEIT_DOT[ressource.verfuegbarkeit] ?? "bg-zinc-400"}`}
                />
                <span className={`text-sm font-medium ${VERFUEGBARKEIT_TEXT[ressource.verfuegbarkeit] ?? "text-muted-foreground"}`}>
                  {ressource.verfuegbarkeit}
                </span>
              </div>
            </div>
          </div>

          {/* ── Body: sidebar + tabs ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left metadata sidebar */}
            <SidebarPanel ressource={ressource} isAgentur={isAgentur} onUpdate={loadData} />

            {/* Right content */}
            <div className="flex-1 overflow-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                {/* Tab nav */}
                <div className="border-b border-border px-6">
                  <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none">
                    {[
                      { value: "stammdaten", label: "Stammdaten", icon: IconUser },
                      { value: "beauftragungen", label: "Beauftragungen", icon: IconBriefcase },
                      { value: "zeitnachweise", label: "Zeitnachweise", icon: IconClock },
                    ].map(({ value, label, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="relative h-11 rounded-none bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:text-foreground data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5 mr-1.5" />
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-auto px-6 py-6">
                  <TabsContent value="stammdaten" className="mt-0 focus-visible:outline-none">
                    <StammdatenTab ressource={ressource} isAgentur={isAgentur} onUpdate={loadData} />
                  </TabsContent>

                  <TabsContent value="beauftragungen" className="mt-0 focus-visible:outline-none">
                    <BeauftragungTab beauftragungen={ressource.beauftragungen ?? []} />
                  </TabsContent>

                  <TabsContent value="zeitnachweise" className="mt-0 focus-visible:outline-none">
                    <ZeitnachweisTab
                      ressource={ressource}
                      zeitnachweise={zeitnachweise}
                      onUpdate={loadData}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
