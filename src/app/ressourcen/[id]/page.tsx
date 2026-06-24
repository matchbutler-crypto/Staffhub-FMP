"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconClipboard,
  IconDownload,
  IconPencil,
  IconCheck,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TagInput } from "@/components/tag-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ressource {
  id: string
  name: string
  vorname?: string | null
  nachname?: string | null
  rolle?: string | null
  firma?: string | null
  email_geschaeftlich?: string | null
  telefon_geschaeftlich?: string | null
  geburtsdatum?: string | null
  geschlecht?: string | null
  wohnort?: string | null
  namenszusatz?: string | null
  titel?: string | null
  skills: string[]
  erfahrungslevel: string
  verfuegbarkeit: string
  verfuegbar_ab?: string | null
  ek_tagesrate?: number | null
  notizen?: string | null
  arbeitsmodell?: string | null
  location?: string | null
  cv_pfad?: string | null
  agentur_id?: string | null
  agenturen?: { name: string } | null
  created_at?: string
  updated_at?: string
}

interface VakanzLink {
  id: string
  ressource_id: string
  vakanz_id: string
  status: string
  created_at: string
  vakanzen_data?: {
    id: string
    rolle: string
    status: string
    erfahrungslevel: string
    arbeitsmodell: string
    standort?: string | null
    branche?: string | null
    startdatum: string
    enddatum?: string | null
    vakanz_nr?: string | null
  } | null
}

interface HistorieEntry {
  id: string
  typ: string
  text: string
  created_at: string
  profiles?: { id: string; name: string; rolle: string } | null
}

interface Beauftragung {
  id: string
  ressource_link_id: string
  ressource_id: string
  startdatum: string
  enddatum: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────


const LINK_STATUS_COLORS: Record<string, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Zurückgezogen: "bg-gray-100 text-gray-500 border-gray-200",
}


function fmt(iso: string | null | undefined) {
  if (!iso) return "–"
  return new Date(iso).toLocaleDateString("de-DE")
}

function MetaCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
        {label}
      </p>
      <p className="text-xs font-medium">{value || "–"}</p>
    </div>
  )
}

// ── StammdatenEditSheet ───────────────────────────────────────────────────────

interface EditForm {
  name: string
  vorname: string
  nachname: string
  titel: string
  namenszusatz: string
  rolle: string
  firma: string
  email_geschaeftlich: string
  telefon_geschaeftlich: string
  wohnort: string
  geburtsdatum: string
  geschlecht: string
  skills: string[]
  erfahrungslevel: string
  verfuegbarkeit: string
  verfuegbar_ab: string
  ek_tagesrate: string
  arbeitsmodell: string
  location: string
  notizen: string
}

interface StammdatenEditSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  ressource: Ressource
  isManager: boolean
  onSuccess: (updated: Ressource) => void
}

function StammdatenEditSheet({
  open,
  onOpenChange,
  ressource,
  isManager,
  onSuccess,
}: StammdatenEditSheetProps) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<EditForm>({
    name: "",
    vorname: "",
    nachname: "",
    titel: "",
    namenszusatz: "",
    rolle: "",
    firma: "",
    email_geschaeftlich: "",
    telefon_geschaeftlich: "",
    wohnort: "",
    geburtsdatum: "",
    geschlecht: "",
    skills: [],
    erfahrungslevel: "Senior",
    verfuegbarkeit: "Jetzt verfügbar",
    verfuegbar_ab: "",
    ek_tagesrate: "",
    arbeitsmodell: "Onshore",
    location: "",
    notizen: "",
  })

  React.useEffect(() => {
    if (!open) return
    setForm({
      name: ressource.name ?? "",
      vorname: ressource.vorname ?? "",
      nachname: ressource.nachname ?? "",
      titel: ressource.titel ?? "",
      namenszusatz: ressource.namenszusatz ?? "",
      rolle: ressource.rolle ?? "",
      firma: ressource.firma ?? "",
      email_geschaeftlich: ressource.email_geschaeftlich ?? "",
      telefon_geschaeftlich: ressource.telefon_geschaeftlich ?? "",
      wohnort: ressource.wohnort ?? "",
      geburtsdatum: ressource.geburtsdatum ?? "",
      geschlecht: ressource.geschlecht ?? "",
      skills: ressource.skills ?? [],
      erfahrungslevel: ressource.erfahrungslevel ?? "Senior",
      verfuegbarkeit: ressource.verfuegbarkeit ?? "Jetzt verfügbar",
      verfuegbar_ab: ressource.verfuegbar_ab ?? "",
      ek_tagesrate: ressource.ek_tagesrate != null ? String(ressource.ek_tagesrate) : "",
      arbeitsmodell: ressource.arbeitsmodell ?? "Onshore",
      location: ressource.location ?? "",
      notizen: ressource.notizen ?? "",
    })
  }, [open, ressource])

  function set(field: keyof EditForm, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim() || form.skills.length === 0) {
      toast.error("Name und mindestens ein Skill sind Pflichtfelder.")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        vorname: form.vorname.trim() || null,
        nachname: form.nachname.trim() || null,
        titel: form.titel.trim() || null,
        namenszusatz: form.namenszusatz.trim() || null,
        rolle: form.rolle.trim() || null,
        firma: form.firma.trim() || null,
        email_geschaeftlich: form.email_geschaeftlich.trim() || null,
        telefon_geschaeftlich: form.telefon_geschaeftlich.trim() || null,
        wohnort: form.wohnort.trim() || null,
        geburtsdatum: form.geburtsdatum || null,
        geschlecht: form.geschlecht || null,
        skills: form.skills,
        erfahrungslevel: form.erfahrungslevel,
        verfuegbarkeit: form.verfuegbarkeit,
        verfuegbar_ab: form.verfuegbar_ab || null,
        ek_tagesrate: form.ek_tagesrate ? Number(form.ek_tagesrate) : null,
        arbeitsmodell: form.arbeitsmodell as "Onshore" | "Nearshore" | "Offshore",
        location: form.location.trim() || null,
        notizen: form.notizen.trim() || null,
      }

      const res = await fetch(`/api/ressourcen/${ressource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler beim Speichern")
      }
      await res.json()
      toast.success("Stammdaten gespeichert")
      onSuccess({ ...ressource, ...body } as Ressource)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[520px] flex-col gap-0 overflow-hidden p-0 sm:w-[580px]"
      >
        <SheetHeader className="flex-none border-b px-6 py-4">
          <SheetTitle>Stammdaten bearbeiten</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Identität */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-3">
              Identität
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vorname</Label>
                <Input
                  value={form.vorname}
                  onChange={(e) => set("vorname", e.target.value)}
                  placeholder="Vorname"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nachname</Label>
                <Input
                  value={form.nachname}
                  onChange={(e) => set("nachname", e.target.value)}
                  placeholder="Nachname"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Titel</Label>
                <Input
                  value={form.titel}
                  onChange={(e) => set("titel", e.target.value)}
                  placeholder="Dr., Prof., …"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Namenszusatz</Label>
                <Input
                  value={form.namenszusatz}
                  onChange={(e) => set("namenszusatz", e.target.value)}
                  placeholder="Namenszusatz"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Anzeigename *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Anzeigename"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Geschlecht</Label>
                <Select value={form.geschlecht} onValueChange={(v) => set("geschlecht", v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Männlich", "Weiblich", "Divers", "Keine Angabe"].map((g) => (
                      <SelectItem key={g} value={g} className="text-sm">{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Geburtsdatum</Label>
                <Input
                  type="date"
                  value={form.geburtsdatum}
                  onChange={(e) => set("geburtsdatum", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Kontakt */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-3">
              Kontakt & Firma
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Firma</Label>
                <Input
                  value={form.firma}
                  onChange={(e) => set("firma", e.target.value)}
                  placeholder="Firma"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-Mail</Label>
                <Input
                  type="email"
                  value={form.email_geschaeftlich}
                  onChange={(e) => set("email_geschaeftlich", e.target.value)}
                  placeholder="email@firma.de"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input
                  value={form.telefon_geschaeftlich}
                  onChange={(e) => set("telefon_geschaeftlich", e.target.value)}
                  placeholder="+49 …"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wohnort</Label>
                <Input
                  value={form.wohnort}
                  onChange={(e) => set("wohnort", e.target.value)}
                  placeholder="Stadt"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Profil */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-3">
              Profil
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rolle / Position</Label>
                  <Input
                    value={form.rolle}
                    onChange={(e) => set("rolle", e.target.value)}
                    placeholder="z.B. SAP-Berater"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Erfahrungslevel *</Label>
                  <Select
                    value={form.erfahrungslevel}
                    onValueChange={(v) => set("erfahrungslevel", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Junior", "Mid", "Senior", "Expert"].map((l) => (
                        <SelectItem key={l} value={l} className="text-sm">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Verfügbarkeit *</Label>
                  <Select
                    value={form.verfuegbarkeit}
                    onValueChange={(v) => set("verfuegbarkeit", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Jetzt verfügbar", "Verfügbar ab", "Nicht verfügbar", "Deaktiviert"].map(
                        (v) => (
                          <SelectItem key={v} value={v} className="text-sm">{v}</SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {form.verfuegbarkeit === "Verfügbar ab" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Ab Datum</Label>
                    <Input
                      type="date"
                      value={form.verfuegbar_ab}
                      onChange={(e) => set("verfuegbar_ab", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Arbeitsmodell</Label>
                  <Select
                    value={form.arbeitsmodell}
                    onValueChange={(v) => set("arbeitsmodell", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Onshore", "Nearshore", "Offshore"].map((a) => (
                        <SelectItem key={a} value={a} className="text-sm">{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                    placeholder="z.B. Frankfurt"
                    className="h-8 text-sm"
                  />
                </div>
                {isManager && (
                  <div className="space-y-1">
                    <Label className="text-xs">EK-Tagesrate (€)</Label>
                    <Input
                      type="number"
                      value={form.ek_tagesrate}
                      onChange={(e) => set("ek_tagesrate", e.target.value)}
                      placeholder="0"
                      className="h-8 text-sm"
                      min={0}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Skills *</Label>
                <TagInput
                  value={form.skills}
                  onChange={(v) => set("skills", v)}
                  placeholder="Skill eingeben + Enter"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notizen</Label>
                <Textarea
                  value={form.notizen}
                  onChange={(e) => set("notizen", e.target.value)}
                  placeholder="Interne Notizen …"
                  className="text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-none border-t px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="col-span-2 text-sm">{value || "–"}</span>
    </div>
  )
}

// ── RessourceDetailPage ───────────────────────────────────────────────────────

export default function RessourceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const id = params.id

  const isAgentur = user?.rolle === "Agentur"
  const isManager = user?.rolle === "Admin" || user?.rolle === "Staffhub Manager"

  const [ressource, setRessource] = React.useState<Ressource | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editOpen, setEditOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [cvLoading, setCvLoading] = React.useState(false)

  const [links, setLinks] = React.useState<VakanzLink[]>([])
  const [loadingLinks, setLoadingLinks] = React.useState(false)

  const [historie, setHistorie] = React.useState<HistorieEntry[]>([])
  const [loadingHistorie, setLoadingHistorie] = React.useState(false)

  const [beauftragungen, setBeauftragungen] = React.useState<Beauftragung[]>([])
  const [loadingBeauftragungen, setLoadingBeauftragungen] = React.useState(false)

  // ── Load Ressource ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    fetch(`/api/ressourcen/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ressource) setRessource(d.ressource)
        else toast.error("Ressource nicht gefunden.")
      })
      .catch(() => toast.error("Ressource konnte nicht geladen werden."))
      .finally(() => setLoading(false))
  }, [id])

  // ── Load Tab Data ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!user) return

    setLoadingLinks(true)
    fetch(`/api/ressourcen/${id}/links`)
      .then((r) => r.json())
      .then((d) => setLinks(d.links ?? []))
      .catch(() => {})
      .finally(() => setLoadingLinks(false))

    setLoadingHistorie(true)
    fetch(`/api/ressourcen/${id}/historie`)
      .then((r) => r.json())
      .then((d) => setHistorie(d.historie ?? []))
      .catch(() => {})
      .finally(() => setLoadingHistorie(false))

    setLoadingBeauftragungen(true)
    fetch(`/api/beauftragungen?ressource_id=${id}`)
      .then((r) => r.json())
      .then((d) => setBeauftragungen(d.beauftragungen ?? []))
      .catch(() => {})
      .finally(() => setLoadingBeauftragungen(false))
  }, [user, id])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleCvDownload() {
    if (!ressource?.cv_pfad) return
    setCvLoading(true)
    try {
      const res = await fetch(`/api/ressourcen/${id}/cv`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      const { url } = await res.json()
      window.open(url, "_blank")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CV-Download fehlgeschlagen")
    } finally {
      setCvLoading(false)
    }
  }

  function handleCopyStammdaten() {
    if (!ressource) return
    const lines = [
      ressource.name,
      ressource.titel ? `Titel: ${ressource.titel}` : null,
      ressource.vorname || ressource.nachname
        ? `Name: ${[ressource.titel, ressource.vorname, ressource.nachname].filter(Boolean).join(" ")}`
        : null,
      ressource.namenszusatz ? `Namenszusatz: ${ressource.namenszusatz}` : null,
      ressource.rolle ? `Rolle: ${ressource.rolle}` : null,
      ressource.firma ? `Firma: ${ressource.firma}` : null,
      ressource.email_geschaeftlich ? `E-Mail: ${ressource.email_geschaeftlich}` : null,
      ressource.telefon_geschaeftlich ? `Telefon: ${ressource.telefon_geschaeftlich}` : null,
      ressource.wohnort ? `Wohnort: ${ressource.wohnort}` : null,
      ressource.geburtsdatum ? `Geburtsdatum: ${fmt(ressource.geburtsdatum)}` : null,
      ressource.geschlecht ? `Geschlecht: ${ressource.geschlecht}` : null,
      `Erfahrungslevel: ${ressource.erfahrungslevel}`,
      `Verfügbarkeit: ${ressource.verfuegbarkeit}${(ressource.verfuegbarkeit === "Verfügbar ab" || ressource.verfuegbarkeit === "Nicht verfügbar") && ressource.verfuegbar_ab ? ` (bis ${fmt(ressource.verfuegbar_ab)})` : ""}`,
      ressource.arbeitsmodell ? `Arbeitsmodell: ${ressource.arbeitsmodell}` : null,
      ressource.location ? `Location: ${ressource.location}` : null,
      ressource.skills.length > 0 ? `Skills: ${ressource.skills.join(", ")}` : null,
      isManager && ressource.ek_tagesrate != null
        ? `EK-Tagesrate: ${ressource.ek_tagesrate.toLocaleString("de-DE")} €/Tag`
        : null,
      ressource.notizen ? `Notizen: ${ressource.notizen}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Verfügbar-ab-Datum: Enddatum der letzten Beauftragung hat Vorrang
  const latestBeauftragungEnddatum = React.useMemo(() => {
    return (
      beauftragungen
        .filter((b) => b.enddatum)
        .sort((a, b) => new Date(b.enddatum!).getTime() - new Date(a.enddatum!).getTime())[0]
        ?.enddatum ?? null
    )
  }, [beauftragungen])

  // Stammdaten-Pflichtfelder ausstehend (für Agentur-Banner)
  const PFLICHTFELDER = ['nachname', 'vorname', 'geburtsdatum', 'geschlecht', 'firma', 'email_geschaeftlich', 'telefon_geschaeftlich', 'wohnort'] as const
  const hatBeauftragtenLink = links.some((l) => l.status === 'Beauftragt' || l.status === 'Zugesagt')
  const stammdatenAusstehend = ressource != null && hatBeauftragtenLink && PFLICHTFELDER.some((f) => !ressource[f])

  const backUrl = isAgentur ? "/pool" : "/ressourcen"
  const backLabel = isAgentur ? "Zurück zu Mein Pool" : "Zurück zu Ressourcen"

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={loading ? "Ressource" : (ressource?.name ?? "Ressource")} />

        <div className="flex-1 overflow-y-auto">

          {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="px-6 py-3 space-y-3">

              {/* Row 1: Back + Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => router.push(backUrl)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <IconArrowLeft className="size-3.5" />
                  {backLabel}
                </button>

                {!loading && ressource && (
                  <div className="flex items-center gap-1.5">
                    {/* CV Download */}
                    {ressource.cv_pfad && (
                      <button
                        onClick={handleCvDownload}
                        disabled={cvLoading}
                        title="CV herunterladen"
                        className="inline-flex items-center justify-center size-7 rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        <IconDownload className="size-3.5" />
                      </button>
                    )}

                    {/* Edit — nur Manager */}
                    {isManager && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setEditOpen(true)}
                      >
                        <IconPencil className="size-3.5" />
                        Bearbeiten
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Name + Meta */}
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-56" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : ressource ? (
                <div className="space-y-2.5">
                  {/* Name + Subtitle */}
                  <div>
                    <h1 className="text-lg font-semibold leading-tight">{ressource.name}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {ressource.erfahrungslevel}
                      {" · "}
                      {ressource.verfuegbarkeit === "Verfügbar ab"
                        ? `Verfügbar ab ${fmt(latestBeauftragungEnddatum ?? ressource.verfuegbar_ab)}`
                        : ressource.verfuegbarkeit === "Nicht verfügbar" && ressource.verfuegbar_ab
                          ? `Nicht verfügbar (bis ${fmt(ressource.verfuegbar_ab)})`
                          : ressource.verfuegbarkeit}
                    </p>
                  </div>

                  {/* 2-Spalten Meta-Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-2">
                    {ressource.rolle && (
                      <MetaCell label="Rolle" value={ressource.rolle} />
                    )}
                    {ressource.agenturen?.name && (
                      <MetaCell label="Agentur" value={ressource.agenturen.name} />
                    )}
                    {ressource.arbeitsmodell && (
                      <MetaCell label="Arbeitsmodell" value={ressource.arbeitsmodell} />
                    )}
                    {ressource.location && (
                      <MetaCell label="Location" value={ressource.location} />
                    )}
                    {ressource.firma && (
                      <MetaCell label="Firma" value={ressource.firma} />
                    )}
                    {!isAgentur && ressource.ek_tagesrate != null && (
                      <MetaCell
                        label="Tagesrate"
                        value={`${ressource.ek_tagesrate.toLocaleString("de-DE")} €`}
                      />
                    )}
                  </div>

                  {/* Skills */}
                  {ressource.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ressource.skills.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── CONTENT ────────────────────────────────────────────────────── */}
          {!loading && !ressource && (
            <div className="px-6 py-6">
              <p className="text-muted-foreground">Ressource nicht gefunden.</p>
            </div>
          )}

          {!loading && ressource && (
            <div className="px-6 py-6">
              <Tabs defaultValue="stammdaten">
                <TabsList className="mb-4">
                  <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
                  <TabsTrigger value="beauftragungen">Beauftragungen</TabsTrigger>
                  <TabsTrigger value="gespielt">Gespielt</TabsTrigger>
                  <TabsTrigger value="historie">Historie</TabsTrigger>
                </TabsList>

                {/* ── Tab: Stammdaten ─────────────────────────────────────── */}
                <TabsContent value="stammdaten">
                  {/* Agentur-Hinweis wenn Pflichtfelder fehlen */}
                  {isAgentur && stammdatenAusstehend && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <span className="font-medium">Stammdaten ausstehend</span> — Diese Ressource ist beauftragt. Bitte vervollständige Vorname, Nachname, Geburtsdatum, Geschlecht, Firma, E-Mail, Telefon und Wohnort.
                    </div>
                  )}

                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Stammdaten
                    </p>
                    <div className="flex items-center gap-3">
                      {/* Bearbeiten */}
                      <button
                        onClick={() => setEditOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <IconPencil className="size-3.5" />
                        Bearbeiten
                      </button>
                      {/* Kopieren */}
                      <button
                        onClick={handleCopyStammdaten}
                        title="Stammdaten kopieren"
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copied ? (
                          <>
                            <IconCheck className="size-3.5 text-green-600" />
                            <span className="text-green-600">Kopiert</span>
                          </>
                        ) : (
                          <>
                            <IconClipboard className="size-3.5" />
                            Kopieren
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 rounded-lg border p-4">
                    <InfoRow label="Vorname" value={ressource.vorname} />
                    <InfoRow label="Nachname" value={ressource.nachname} />
                    {ressource.titel && (
                      <InfoRow label="Titel" value={ressource.titel} />
                    )}
                    {ressource.namenszusatz && (
                      <InfoRow label="Namenszusatz" value={ressource.namenszusatz} />
                    )}
                    <InfoRow label="Firma" value={ressource.firma} />
                    <InfoRow label="E-Mail" value={ressource.email_geschaeftlich} />
                    <InfoRow label="Telefon" value={ressource.telefon_geschaeftlich} />
                    <InfoRow label="Wohnort" value={ressource.wohnort} />
                    {ressource.geburtsdatum && (
                      <InfoRow label="Geburtsdatum" value={fmt(ressource.geburtsdatum)} />
                    )}
                    {ressource.geschlecht && (
                      <InfoRow label="Geschlecht" value={ressource.geschlecht} />
                    )}
                    {ressource.notizen && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Notizen</p>
                        <p className="text-sm whitespace-pre-line text-foreground/80">
                          {ressource.notizen}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── Tab: Beauftragungen ─────────────────────────────────── */}
                <TabsContent value="beauftragungen">
                  {(loadingLinks || loadingBeauftragungen) ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (() => {
                    const beauftragtLinks = links.filter((l) => l.status === "Beauftragt")
                    if (beauftragtLinks.length === 0 && beauftragungen.length === 0) {
                      return (
                        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                          Keine Beauftragungen vorhanden.
                        </div>
                      )
                    }
                    return (
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Vakanz-Nr.</TableHead>
                              <TableHead>Vakanz Rolle</TableHead>
                              <TableHead>Rollenbezeichnung</TableHead>
                              <TableHead>Tagesrate</TableHead>
                              <TableHead>Start</TableHead>
                              <TableHead>Ende</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {beauftragtLinks.map((l) => (
                              <TableRow
                                key={`link-${l.id}`}
                                className="cursor-pointer"
                                onClick={() => router.push(`/vakanzen/${l.vakanz_id}`)}
                              >
                                <TableCell className="text-sm text-muted-foreground">
                                  {l.vakanzen_data?.vakanz_nr ?? "–"}
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {l.vakanzen_data?.rolle ?? "–"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {ressource.rolle ?? "–"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {ressource.ek_tagesrate != null
                                    ? `${ressource.ek_tagesrate.toLocaleString("de-DE")} €/Tag`
                                    : "–"}
                                </TableCell>
                                <TableCell className="text-sm">{fmt(l.vakanzen_data?.startdatum)}</TableCell>
                                <TableCell className="text-sm">{fmt(l.vakanzen_data?.enddatum)}</TableCell>
                              </TableRow>
                            ))}
                            {beauftragungen.map((b) => (
                              <TableRow key={`b-${b.id}`}>
                                <TableCell className="text-sm text-muted-foreground">–</TableCell>
                                <TableCell className="text-sm font-medium">–</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {ressource.rolle ?? "–"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {ressource.ek_tagesrate != null
                                    ? `${ressource.ek_tagesrate.toLocaleString("de-DE")} €/Tag`
                                    : "–"}
                                </TableCell>
                                <TableCell className="text-sm">{fmt(b.startdatum)}</TableCell>
                                <TableCell className="text-sm">{fmt(b.enddatum)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  })()}
                </TabsContent>

                {/* ── Tab: Gespielt ───────────────────────────────────────── */}
                <TabsContent value="gespielt">
                  {loadingLinks ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : links.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Noch bei keiner Vakanz eingereicht.
                    </div>
                  ) : (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vakanz-Nr.</TableHead>
                            <TableHead>Vakanz Rolle</TableHead>
                            <TableHead>Rollenbezeichnung</TableHead>
                            <TableHead>Tagesrate</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Ende</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {links.map((l) => (
                            <TableRow
                              key={l.id}
                              className="cursor-pointer"
                              onClick={() => router.push(`/vakanzen/${l.vakanz_id}`)}
                            >
                              <TableCell className="text-sm text-muted-foreground">
                                {l.vakanzen_data?.vakanz_nr ?? "–"}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {l.vakanzen_data?.rolle ?? "–"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {ressource.rolle ?? "–"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {ressource.ek_tagesrate != null
                                  ? `${ressource.ek_tagesrate.toLocaleString("de-DE")} €/Tag`
                                  : "–"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {fmt(l.vakanzen_data?.startdatum)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {fmt(l.vakanzen_data?.enddatum)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${LINK_STATUS_COLORS[l.status] ?? ""}`}
                                >
                                  {l.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Tab: Historie ───────────────────────────────────────── */}
                <TabsContent value="historie">
                  {loadingHistorie ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : historie.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Noch keine Einträge vorhanden.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {historie.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-start gap-3 rounded-lg border px-4 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{h.text}</p>
                            {h.profiles && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {h.profiles.name} · {h.profiles.rolle}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(h.created_at).toLocaleDateString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Edit Sheet */}
      {ressource && (
        <StammdatenEditSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          ressource={ressource}
          isManager={isManager}
          onSuccess={(updated) => setRessource(updated)}
        />
      )}
    </SidebarProvider>
  )
}
