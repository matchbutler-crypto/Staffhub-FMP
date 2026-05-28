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
  IconClock,
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
import { Textarea } from "@/components/ui/textarea"

interface Ressource {
  id: string
  ressource_code?: string | null
  name: string
  vorname?: string | null
  nachname?: string | null
  geburtsdatum?: string | null
  geschlecht?: string | null
  firma?: string | null
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
}

const StammdatenSchema = z.object({
  vorname: z.string().min(1),
  nachname: z.string().min(1),
  geburtsdatum: z.string().optional(),
  geschlecht: z.string().optional(),
  firma: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  telefon: z.string().optional(),
  adresse: z.string().optional(),
  notizen: z.string().optional(),
})

type StammdatenFormValues = z.infer<typeof StammdatenSchema>

const VERFUEGBARKEIT_DOT: Record<string, string> = {
  "Jetzt verfügbar": "bg-emerald-500",
  "Verfügbar ab": "bg-amber-400",
  "Nicht verfügbar": "bg-zinc-400",
  "Deaktiviert": "bg-red-400",
  Beauftragt: "bg-teal-500",
}

const VERFUEGBARKEIT_TEXT: Record<string, string> = {
  "Jetzt verfügbar": "text-emerald-700 dark:text-emerald-300",
  "Verfügbar ab": "text-amber-700 dark:text-amber-300",
  "Nicht verfügbar": "text-zinc-500 dark:text-zinc-400",
  "Deaktiviert": "text-red-600 dark:text-red-300",
  Beauftragt: "text-teal-700 dark:text-teal-300",
}

const BEAUFTRAGUNG_STATUS: Record<string, string> = {
  Aktiv: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  Beauftragt: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  Abgeschlossen: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  Abgebrochen: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  Geplant: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
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

function HeaderMetaBar({
  ressource,
  canEdit,
  onUpdate,
}: {
  ressource: Ressource
  canEdit: boolean
  onUpdate: () => void
}) {
  const [savingStatus, setSavingStatus] = React.useState(false)
  const [currentStatus, setCurrentStatus] = React.useState(ressource.verfuegbarkeit)
  const [verfuegbarAb, setVerfuegbarAb] = React.useState(ressource.verfuegbar_ab?.slice(0, 10) ?? "")
  const today = new Date().toISOString().slice(0, 10)

  React.useEffect(() => {
    setCurrentStatus(ressource.verfuegbarkeit)
    setVerfuegbarAb(ressource.verfuegbar_ab?.slice(0, 10) ?? "")
  }, [ressource.verfuegbarkeit, ressource.verfuegbar_ab])

  const laufendeBeauftragung = React.useMemo(() => {
    return (ressource.beauftragungen ?? []).find((b) => {
      const start = (b.startdatum ?? "").slice(0, 10)
      const end = b.enddatum ? b.enddatum.slice(0, 10) : null
      const inTimeRange = start ? start <= today && (!end || end >= today) : true
      const isActiveStatus = b.status === "Beauftragt" || b.status === "Aktiv"
      return isActiveStatus && inTimeRange
    }) ?? null
  }, [ressource.beauftragungen, today])

  const statusImHeader = laufendeBeauftragung ? "Beauftragt" : currentStatus
  const statusLocked = !!laufendeBeauftragung
  const verfuegbarAbText = laufendeBeauftragung?.enddatum
    ? new Date(laufendeBeauftragung.enddatum).toLocaleDateString("de-DE")
    : null

  const updateStatus = async (newStatus: string, dateValue?: string | null) => {
    setSavingStatus(true)
    try {
      const payload = {
        verfuegbarkeit: newStatus,
        verfuegbar_ab: newStatus === "Verfügbar ab" ? (dateValue ?? null) : null,
      }
      const res = await fetch(`/api/ressourcen/${ressource.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Fehler beim Aktualisieren")
      }
      setCurrentStatus(newStatus)
      if (newStatus === "Verfügbar ab") setVerfuegbarAb(dateValue ?? "")
      toast.success("Status aktualisiert")
      onUpdate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktualisieren")
    } finally {
      setSavingStatus(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setCurrentStatus(newStatus)
    if (newStatus !== "Verfügbar ab") {
      await updateStatus(newStatus, null)
    }
  }

  return (
    <div className="border-b border-border">
      <div className="px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {ressource.vorname || ressource.nachname
                ? `${ressource.vorname ?? ""} ${ressource.nachname ?? ""}`.trim()
                : ressource.name}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
              <span className={`h-2 w-2 rounded-full ${VERFUEGBARKEIT_DOT[statusImHeader] ?? "bg-zinc-400"}`} />
              <span className={VERFUEGBARKEIT_TEXT[statusImHeader] ?? "text-foreground"}>
                {statusImHeader}
              </span>
            </span>
            {statusLocked && verfuegbarAbText && (
              <span className="inline-flex items-center rounded-full border border-teal-300/40 bg-teal-500/10 px-3 py-1 text-sm text-teal-700 dark:text-teal-300">
                Verfügbar ab {verfuegbarAbText}
              </span>
            )}
            {ressource.erfahrungslevel && (
              <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-foreground">
                {ressource.erfahrungslevel}
              </span>
            )}
            {ressource.arbeitsmodell && (
              <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-foreground">
                {ressource.arbeitsmodell}
              </span>
            )}
            {(ressource.location || ressource.rolle) && (
              <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-foreground">
                {ressource.location ?? ressource.rolle}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !statusLocked ? (
              <Select value={currentStatus} onValueChange={handleStatusChange} disabled={savingStatus}>
                <SelectTrigger className="h-9 w-auto min-w-[170px] gap-2 rounded-md border-border bg-muted/40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jetzt verfügbar">Jetzt verfügbar</SelectItem>
                  <SelectItem value="Verfügbar ab">Verfügbar ab</SelectItem>
                  <SelectItem value="Nicht verfügbar">Nicht verfügbar</SelectItem>
                  <SelectItem value="Deaktiviert">Deaktiviert</SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            {canEdit && !statusLocked && currentStatus === "Verfügbar ab" ? (
              <>
                <Input
                  type="date"
                  value={verfuegbarAb}
                  min={today}
                  onChange={(e) => setVerfuegbarAb(e.target.value)}
                  className="h-9 w-[170px]"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={!verfuegbarAb || savingStatus}
                  onClick={() => updateStatus("Verfügbar ab", verfuegbarAb)}
                >
                  Speichern
                </Button>
              </>
            ) : null}

            {ressource.cv_pfad ? (
              <a
                href={ressource.cv_pfad}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted/40"
              >
                <IconDownload className="h-4 w-4" />
                CV herunterladen
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ID</p>
            <p className="text-sm leading-snug font-medium text-foreground">{ressource.ressource_code ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Angelegt</p>
            <p className="text-sm leading-snug font-medium text-foreground">
              {new Date(ressource.created_at).toLocaleDateString("de-DE")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Agentur</p>
            <p className="text-sm leading-snug font-medium text-foreground">{ressource.agentur_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">EK</p>
            <p className="text-sm leading-snug font-medium text-foreground">
              {ressource.ek_tagesrate != null ? `${ressource.ek_tagesrate.toLocaleString("de-DE")}€` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Standort</p>
            <p className="text-sm leading-snug font-medium text-foreground">{ressource.location ?? "—"}</p>
          </div>
        </div>

        {ressource.skills && ressource.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Must Have</p>
            <div className="flex flex-wrap gap-2">
              {ressource.skills.map((s) => (
                <span key={s} className="rounded-full border border-border px-3 py-1 text-sm text-foreground bg-muted/30">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StammdatenTab({
  ressource,
  canEdit,
  onUpdate,
}: {
  ressource: Ressource
  canEdit: boolean
  onUpdate: () => void
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const { control, handleSubmit, reset, formState: { isDirty } } = useForm<StammdatenFormValues>({
    resolver: zodResolver(StammdatenSchema),
    defaultValues: {
      vorname: ressource.vorname ?? "",
      nachname: ressource.nachname ?? "",
      geburtsdatum: ressource.geburtsdatum ?? "",
      geschlecht: ressource.geschlecht ?? "",
      firma: ressource.firma ?? "",
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
              {isSaving ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconCheck className="h-3.5 w-3.5" />}
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
              { name: "firma" as const, label: "Firma", type: "text" },
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
                render={({ field }) => <Input {...field} type={type} className="mt-1" />}
              />
            </div>
          ))}

          {/* Geschlecht */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Geschlecht</Label>
            <Controller
              control={control}
              name="geschlecht"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="männlich">Männlich</SelectItem>
                    <SelectItem value="weiblich">Weiblich</SelectItem>
                    <SelectItem value="divers">Divers</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notizen</Label>
          <Controller
            control={control}
            name="notizen"
            render={({ field }) => <Textarea {...field} className="mt-1 resize-none" rows={4} />}
          />
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-5">
      {canEdit && (
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

      <div className="divide-y divide-border rounded-md border border-border bg-background">
        <div className="px-4"><FieldRow label="Vorname" value={ressource.vorname} /></div>
        <div className="px-4"><FieldRow label="Nachname" value={ressource.nachname} /></div>
        <div className="px-4">
          <FieldRow
            label="Geburtsdatum"
            value={ressource.geburtsdatum ? new Date(ressource.geburtsdatum).toLocaleDateString("de-DE") : null}
          />
        </div>
        <div className="px-4"><FieldRow label="E-Mail" value={ressource.email} /></div>
        <div className="px-4"><FieldRow label="Telefon" value={ressource.telefon} /></div>
        <div className="px-4"><FieldRow label="Wohnort" value={ressource.wohnort} /></div>
      </div>

      {ressource.notizen && (
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notizen</p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ressource.notizen}</p>
        </div>
      )}
    </div>
  )
}

function BeauftragungTab({ beauftragungen }: { beauftragungen: Beauftragung[] }) {
  if (beauftragungen.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-14 text-center text-muted-foreground">
        Noch keine Beauftragungen vorhanden.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Vakanz</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>Ende</TableHead>
            <TableHead>Agentur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {beauftragungen.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium font-mono text-xs text-muted-foreground">{b.vakanz_nr}</TableCell>
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
              <TableCell className="text-sm text-muted-foreground">{b.agentur_name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ZeitnachweisTab({ zeitnachweise }: { zeitnachweise: Zeitnachweis[] }) {
  const totalStunden = zeitnachweise.reduce((sum, z) => sum + z.stunden, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Gesamt</p>
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
        <div className="rounded-xl border border-dashed border-border py-14 text-center text-muted-foreground">
          Noch keine Zeitnachweise erfasst.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Datum</TableHead>
                <TableHead>Stunden</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Hochgeladen von</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zeitnachweise.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="tabular-nums">{new Date(z.datum).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{z.stunden}h</TableCell>
                  <TableCell className="text-muted-foreground">{z.beschreibung}</TableCell>
                  <TableCell className="text-muted-foreground">{z.hochgeladen_von}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

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
  const canEdit = isManager || (user?.rolle === "Agentur" && user?.agentur_id === ressource?.agentur_id)

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-3 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/pool')}
              className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            >
              <IconArrowLeft className="h-4 w-4" />
              Zurück zu Ressourcen
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <HeaderMetaBar ressource={ressource} canEdit={canEdit} onUpdate={loadData} />

            <div className="px-6 pt-6 pb-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                <div className="border-b border-border">
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

                <div className="pt-6">
                  <TabsContent value="stammdaten" className="mt-0 focus-visible:outline-none">
                    <StammdatenTab ressource={ressource} canEdit={canEdit} onUpdate={loadData} />
                  </TabsContent>
                  <TabsContent value="beauftragungen" className="mt-0 focus-visible:outline-none">
                    <BeauftragungTab beauftragungen={ressource.beauftragungen ?? []} />
                  </TabsContent>
                  <TabsContent value="zeitnachweise" className="mt-0 focus-visible:outline-none">
                    <ZeitnachweisTab zeitnachweise={zeitnachweise} />
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
