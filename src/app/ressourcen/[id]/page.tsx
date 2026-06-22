"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconArrowLeft, IconPencil } from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  agentur_id?: string | null
  agenturen?: { name: string } | null
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

const VERFUEGBARKEIT_COLORS: Record<string, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-blue-100 text-blue-700 border-blue-200",
  "Nicht verfügbar": "bg-orange-100 text-orange-700 border-orange-200",
  Deaktiviert: "bg-gray-100 text-gray-500 border-gray-200",
}

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

  // ── Render ─────────────────────────────────────────────────────────────────

  const backUrl = isAgentur ? "/pool" : "/ressourcen"
  const backLabel = isAgentur ? "Zurück zu Mein Pool" : "Zurück zu Ressourcen"

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
        <SiteHeader title={loading ? "Ressource" : (ressource?.name ?? "Ressource")} />

        <div className="flex-1 overflow-y-auto">

          {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="px-6 py-3">

              {/* Top bar: back + actions */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => router.push(backUrl)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconArrowLeft className="size-3.5" />
                  {backLabel}
                </button>

                {isManager && !loading && ressource && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => router.push(`/ressourcen?edit=${id}`)}
                  >
                    <IconPencil className="size-3.5" />
                    Bearbeiten
                  </Button>
                )}
              </div>

              {/* Title + Badges */}
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-4 w-80" />
                </div>
              ) : ressource ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-lg font-semibold leading-tight">{ressource.name}</h1>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${VERFUEGBARKEIT_COLORS[ressource.verfuegbarkeit] ?? ""}`}
                      >
                        {ressource.verfuegbarkeit}
                        {ressource.verfuegbarkeit === "Verfügbar ab" && ressource.verfuegbar_ab
                          ? ` ${fmt(ressource.verfuegbar_ab)}`
                          : ""}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {ressource.erfahrungslevel}
                      </Badge>
                      {ressource.arbeitsmodell && (
                        <Badge variant="outline" className="text-xs">
                          {ressource.arbeitsmodell}
                        </Badge>
                      )}
                      {ressource.agenturen?.name && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {ressource.agenturen.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Meta-Zeile: Rolle, Location, Skills-Preview */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {ressource.rolle && <span>{ressource.rolle}</span>}
                    {ressource.location && <span>{ressource.location}</span>}
                    {!isAgentur && ressource.ek_tagesrate != null && (
                      <span className="font-medium text-foreground">
                        {ressource.ek_tagesrate.toLocaleString("de-DE")} €/Tag
                      </span>
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
                  <div className="max-w-xl space-y-1 rounded-lg border p-4">
                    <InfoRow label="Vorname" value={ressource.vorname} />
                    <InfoRow label="Nachname" value={ressource.nachname} />
                    {ressource.titel && <InfoRow label="Titel" value={ressource.titel} />}
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
                  {loadingBeauftragungen ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : beauftragungen.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Keine Beauftragungen vorhanden.
                    </div>
                  ) : (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Start</TableHead>
                            <TableHead>Ende</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {beauftragungen.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="text-sm">{fmt(b.startdatum)}</TableCell>
                              <TableCell className="text-sm">{fmt(b.enddatum)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
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
                            <TableHead>Vakanz</TableHead>
                            <TableHead>Branche</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {links.map((l) => (
                            <TableRow
                              key={l.id}
                              className="cursor-pointer"
                              onClick={() =>
                                router.push(`/vakanzen/${l.vakanz_id}`)
                              }
                            >
                              <TableCell className="text-sm font-medium">
                                {l.vakanzen_data?.rolle ?? "–"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {l.vakanzen_data?.branche ?? "–"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {fmt(l.vakanzen_data?.startdatum)}
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
    </SidebarProvider>
  )
}
