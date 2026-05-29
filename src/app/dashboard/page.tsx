"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconAlertTriangle,
  IconBriefcase,
  IconCalendarCheck,
  IconClock,
  IconStack2,
} from "@tabler/icons-react"
import {
  Ban,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Play,
  Send,
  Settings,
  ShoppingCart,
  Undo2,
  UserCheck,
  XCircle,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { UnauthorizedToast } from "@/components/unauthorized-toast"
import { LINK_STATUS_ORDER, getLinkStatusConfig } from "@/lib/link-status-config"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

interface VakanzOhneProfile {
  id: string
  rolle: string
  alter_tage: number
}

interface BaldAuslaufend {
  id: string
  rolle: string
  enddatum: string
}

interface RessourcePipelineRow {
  id: string
  status: string
  updated_at: string
  ressource_id: string
  ressource_name: string
  ressource_rolle: string | null
  ressource_ek_tagesrate: number | null
}

interface ManagerData {
  rolle: 'Manager'
  kpis: { aktive_vakanzen: number; aktive_beauftragungen: number; monats_marge: number }
  neueste_vakanzen: { id: string; rolle: string; created_at: string }[]
  pool_stats: { total: number; by_link_status: Record<string, number> }
  bald_verfuegbar: { id: string; name: string; rolle: string | null; verfuegbar_ab: string }[]
  vakanzen_ohne_profile: VakanzOhneProfile[]
  bald_auslaufend: BaldAuslaufend[]
  ressourcen_pipeline: RessourcePipelineRow[]
}

interface AgenturData {
  rolle: 'Agentur'
  pool_stats: { total: number; by_link_status: Record<string, number> }
  aktive_vakanzen: number
  neueste_vakanzen: { id: string; rolle: string; created_at: string }[]
  bald_verfuegbar: { id: string; name: string; rolle: string | null; verfuegbar_ab: string }[]
  ressourcen_pipeline: RessourcePipelineRow[]
}

type DashboardData = ManagerData | AgenturData

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-8 w-20" /></CardHeader>
      <div className="px-6 pb-4"><Skeleton className="h-3 w-40" /></div>
    </Card>
  )
}

// Icons are UI-specific — not part of the shared link-status-config
const LINK_STATUS_ICONS: Record<string, React.ReactNode> = {
  "Gespielt":                      <Send className="h-3 w-3" />,
  "Interview geplant":             <CalendarClock className="h-3 w-3" />,
  "Zugesagt":                      <CheckCircle2 className="h-3 w-3" />,
  "Stammdaten anfordern":          <FileText className="h-3 w-3" />,
  "Freelancer Prozess gestartet":  <UserCheck className="h-3 w-3" />,
  "Einkauf gestartet":             <ShoppingCart className="h-3 w-3" />,
  "Genehmigung gestartet":         <ClipboardCheck className="h-3 w-3" />,
  "Beauftragt":                    <Briefcase className="h-3 w-3" />,
  "Setup externe Mail & Hardware": <Settings className="h-3 w-3" />,
  "Running":                       <Play className="h-3 w-3" />,
  "Abgesagt":                      <XCircle className="h-3 w-3" />,
  "Abgelehnt":                     <Ban className="h-3 w-3" />,
  "Zurückgezogen":                 <Undo2 className="h-3 w-3" />,
}

function LinkStatusBadge({ status }: { status: string }) {
  const cfg = getLinkStatusConfig(status)
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {LINK_STATUS_ICONS[status] ?? null}
      {cfg.label || status}
    </span>
  )
}

// ── Manager Dashboard ──────────────────────────────────────────────────────────

function ManagerDashboard({ data }: { data: ManagerData }) {
  const { kpis, neueste_vakanzen, pool_stats, bald_verfuegbar, vakanzen_ohne_profile, bald_auslaufend, ressourcen_pipeline } = data
  const [statusFilter, setStatusFilter] = React.useState<string>("alle")

  const filteredPipeline = statusFilter === "alle"
    ? ressourcen_pipeline
    : ressourcen_pipeline.filter(r => r.status === statusFilter)

  // Statuses that actually have data
  const activeLinkStatuses = LINK_STATUS_ORDER.filter(s => ressourcen_pipeline.some(r => r.status === s))

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6">

      {/* ── Row 1: 3 KPI Tiles ── */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-3">

        {/* Tile 1: Offene Vakanzen */}
        <Link href="/vakanzen" className="block group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">Offene Vakanzen</CardDescription>
                <IconBriefcase className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums">{kpis.aktive_vakanzen}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {neueste_vakanzen.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine offenen Vakanzen</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {neueste_vakanzen.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground truncate font-medium">{v.rolle}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {new Date(v.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Alle anzeigen →</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Tile 2: Pool Ressourcen */}
        <Link href="/pool" className="block group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">Pool Ressourcen</CardDescription>
                <IconStack2 className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums">{pool_stats.total}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {Object.keys(pool_stats.by_link_status).length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Einreichungen</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {LINK_STATUS_ORDER.filter(s => pool_stats.by_link_status[s]).map((s) => {
                    const cfg = getLinkStatusConfig(s)
                    const count = pool_stats.by_link_status[s] ?? 0
                    return (
                      <div key={s} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                          <span className="text-xs text-muted-foreground truncate">{s}</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">{count}</span>
                      </div>
                    )
                  })}
                  <p className="text-[11px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Pool anzeigen →</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Tile 3: Bald verfügbar (free choice) */}
        <Link href="/pool" className="block group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">Bald verfügbar</CardDescription>
                <IconCalendarCheck className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums">{bald_verfuegbar.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {bald_verfuegbar.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Ressourcen in den nächsten 30 Tagen</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {bald_verfuegbar.slice(0, 3).map((r) => {
                    const days = Math.ceil((new Date(r.verfuegbar_ab).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
                          {r.rolle && <span className="text-[11px] text-muted-foreground truncate">{r.rolle}</span>}
                        </div>
                        <span className={`text-[11px] shrink-0 font-semibold tabular-nums ${days <= 7 ? "text-orange-600" : "text-emerald-600"}`}>
                          {days === 0 ? "Heute" : `in ${days}d`}
                        </span>
                      </div>
                    )
                  })}
                  {bald_verfuegbar.length > 3 && (
                    <p className="text-[11px] text-muted-foreground">+{bald_verfuegbar.length - 3} weitere</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Pool anzeigen →</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Row 2: Vakanzen ohne Profile + Bald auslaufend ── */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @2xl/main:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Vakanzen ohne Profile</CardTitle>
              <CardDescription>Offene Vakanzen mit 0 Einreichungen</CardDescription>
            </div>
            <Link href="/vakanzen" className="text-xs text-muted-foreground hover:text-foreground hover:underline">Alle →</Link>
          </CardHeader>
          <CardContent>
            {vakanzen_ohne_profile.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alle offenen Vakanzen haben Profile. ✓</p>
            ) : (
              <div className="space-y-1">
                {vakanzen_ohne_profile.map((v) => (
                  <Link key={v.id} href="/vakanzen" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                    <div className="flex items-center gap-2 min-w-0">
                      {v.alter_tage > 14 && <IconAlertTriangle className="size-3.5 shrink-0 text-yellow-500" />}
                      <span className="text-sm truncate group-hover:underline">{v.rolle}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{v.alter_tage}d offen</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Bald auslaufend</CardTitle>
              <CardDescription>Vakanzen mit Enddatum ≤ 30 Tage</CardDescription>
            </div>
            <Link href="/vakanzen" className="text-xs text-muted-foreground hover:text-foreground hover:underline">Alle →</Link>
          </CardHeader>
          <CardContent>
            {bald_auslaufend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Vakanzen laufen in den nächsten 30 Tagen aus.</p>
            ) : (
              <div className="space-y-1">
                {bald_auslaufend.map((v) => {
                  const days = Math.ceil((new Date(v.enddatum).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <Link key={v.id} href="/vakanzen" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <IconClock className={`size-3.5 shrink-0 ${days <= 7 ? "text-red-500" : "text-yellow-500"}`} />
                        <span className="text-sm truncate group-hover:underline">{v.rolle}</span>
                      </div>
                      <span className={`text-xs shrink-0 tabular-nums font-medium ${days <= 7 ? "text-red-600" : "text-yellow-600"}`}>
                        {new Date(v.enddatum).toLocaleDateString("de-DE")}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Ressourcen-Pipeline (replaces Letzte Aktivitäten) ── */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 @md/main:flex-row @md/main:items-center @md/main:justify-between">
              <div>
                <CardTitle className="text-base">Ressourcen-Pipeline</CardTitle>
                <CardDescription>Alle eingereichten Pool-Ressourcen</CardDescription>
              </div>
              {/* Status-Schnellfilter */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setStatusFilter("alle")}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === "alle"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Alle {ressourcen_pipeline.length > 0 && <span className="ml-1 tabular-nums">{ressourcen_pipeline.length}</span>}
                </button>
                {activeLinkStatuses.map((s) => {
                  const cfg = getLinkStatusConfig(s)
                  const count = ressourcen_pipeline.filter(r => r.status === s).length
                  const isActive = statusFilter === s
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(statusFilter === s ? "alle" : s)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isActive ? cfg.color + " shadow-sm" : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                      <span className="tabular-nums ml-0.5">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Statusupdate</TableHead>
                  <TableHead className="text-right">EK-Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPipeline.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {ressourcen_pipeline.length === 0 ? "Noch keine Ressourcen eingereicht." : "Keine Einträge für diesen Filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPipeline.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <Link href="/pool" className="hover:underline">{row.ressource_name}</Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.ressource_rolle ?? <span className="text-muted-foreground/50">–</span>}
                      </TableCell>
                      <TableCell>
                        <LinkStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.ressource_ek_tagesrate != null
                          ? <span className="font-medium">{row.ressource_ek_tagesrate.toLocaleString("de-DE")} €</span>
                          : <span className="text-muted-foreground">–</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Agentur Dashboard ─────────────────────────────────────────────────────────

function AgenturDashboard({ data }: { data: AgenturData }) {
  const { pool_stats, aktive_vakanzen, neueste_vakanzen, bald_verfuegbar, ressourcen_pipeline } = data
  const [statusFilter, setStatusFilter] = React.useState<string>("alle")

  const filteredPipeline = statusFilter === "alle"
    ? ressourcen_pipeline
    : ressourcen_pipeline.filter(r => r.status === statusFilter)

  const activeLinkStatuses = LINK_STATUS_ORDER.filter(s => ressourcen_pipeline.some(r => r.status === s))

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6">

      {/* ── Row 1: 3 KPI Tiles ── */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-3">

        {/* Tile 1: Mein Pool */}
        <Link href="/pool" className="block group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">Mein Pool</CardDescription>
                <IconStack2 className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums">{pool_stats.total}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {Object.keys(pool_stats.by_link_status).length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Ressourcen eingereicht</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {LINK_STATUS_ORDER.filter(s => pool_stats.by_link_status[s]).map((s) => {
                    const cfg = getLinkStatusConfig(s)
                    const count = pool_stats.by_link_status[s] ?? 0
                    return (
                      <div key={s} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                          <span className="text-xs text-muted-foreground truncate">{s}</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">{count}</span>
                      </div>
                    )
                  })}
                  <p className="text-[11px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Pool anzeigen →</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Tile 2: Offene Vakanzen */}
        <Link href="/vakanzen" className="block group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">Offene Vakanzen</CardDescription>
                <IconBriefcase className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums">{aktive_vakanzen}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {neueste_vakanzen.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine offenen Vakanzen</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {neueste_vakanzen.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground truncate font-medium">{v.rolle}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {new Date(v.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Alle anzeigen →</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Tile 3: Bald verfügbar */}
        <Link href="/pool" className="block group">
          <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">Bald verfügbar</CardDescription>
                <IconCalendarCheck className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums">{bald_verfuegbar.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {bald_verfuegbar.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Ressourcen in den nächsten 30 Tagen</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {bald_verfuegbar.slice(0, 3).map((r) => {
                    const days = Math.ceil((new Date(r.verfuegbar_ab).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
                          {r.rolle && <span className="text-[11px] text-muted-foreground truncate">{r.rolle}</span>}
                        </div>
                        <span className={`text-[11px] shrink-0 font-semibold tabular-nums ${days <= 7 ? "text-orange-600" : "text-emerald-600"}`}>
                          {days === 0 ? "Heute" : `in ${days}d`}
                        </span>
                      </div>
                    )
                  })}
                  {bald_verfuegbar.length > 3 && (
                    <p className="text-[11px] text-muted-foreground">+{bald_verfuegbar.length - 3} weitere</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Pool anzeigen →</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Row 2: Ressourcen-Pipeline ── */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 @md/main:flex-row @md/main:items-center @md/main:justify-between">
              <div>
                <CardTitle className="text-base">Meine Ressourcen-Pipeline</CardTitle>
                <CardDescription>Alle eingereichten Pool-Ressourcen</CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setStatusFilter("alle")}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === "alle"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Alle {ressourcen_pipeline.length > 0 && <span className="ml-1 tabular-nums">{ressourcen_pipeline.length}</span>}
                </button>
                {activeLinkStatuses.map((s) => {
                  const cfg = getLinkStatusConfig(s)
                  const count = ressourcen_pipeline.filter(r => r.status === s).length
                  const isActive = statusFilter === s
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(statusFilter === s ? "alle" : s)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isActive ? cfg.color + " shadow-sm" : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                      <span className="tabular-nums ml-0.5">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Statusupdate</TableHead>
                  <TableHead className="text-right">EK-Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPipeline.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {ressourcen_pipeline.length === 0 ? "Noch keine Ressourcen eingereicht." : "Keine Einträge für diesen Filter."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPipeline.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <Link href="/pool" className="hover:underline">{row.ressource_name}</Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.ressource_rolle ?? <span className="text-muted-foreground/50">–</span>}
                      </TableCell>
                      <TableCell>
                        <LinkStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.ressource_ek_tagesrate != null
                          ? <span className="font-medium">{row.ressource_ek_tagesrate.toLocaleString("de-DE")} €</span>
                          : <span className="text-muted-foreground">–</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <UnauthorizedToast />
        <SiteHeader title="Dashboard" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">

            {error && (
              <div className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                Fehler beim Laden: {error}
              </div>
            )}

            {loading && (
              <div className="grid grid-cols-1 gap-4 px-4 py-6 lg:px-6 @xl/main:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)}
              </div>
            )}

            {!loading && data && (
              data.rolle === 'Manager'
                ? <ManagerDashboard data={data} />
                : <AgenturDashboard data={data} />
            )}

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
