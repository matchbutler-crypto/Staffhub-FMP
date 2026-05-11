"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconAlertTriangle,
  IconBriefcase,
  IconBuilding,
  IconClock,
  IconCurrencyEuro,
  IconStack2,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { UnauthorizedToast } from "@/components/unauthorized-toast"
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

type ProfilStatus = "Eingereicht" | "In Prüfung" | "Präsentiert" | "Interview" | "Beauftragt" | "Abgelehnt" | "Archiviert"

interface Aktivitaet {
  id: string
  kandidatenname: string
  vakanz_titel: string
  agentur_name: string
  status: ProfilStatus
  ki_score: number | null
  created_at: string
}

interface AgenturPerf {
  name: string
  count: number
  avg_score: number | null
}

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

interface ManagerData {
  rolle: 'Manager'
  kpis: { aktive_vakanzen: number; in_pruefung: number; aktive_beauftragungen: number; monats_marge: number }
  pipeline: Record<string, number>
  agentur_performance: AgenturPerf[]
  vakanzen_ohne_profile: VakanzOhneProfile[]
  bald_auslaufend: BaldAuslaufend[]
  aktivitaet: Aktivitaet[]
}

interface AgenturData {
  rolle: 'Agentur'
  kpis: { aktive_vakanzen: number; eingereichte_profile: number; pool_groesse: number; monats_marge: null }
  aktivitaet: Aktivitaet[]
}

type DashboardData = ManagerData | AgenturData

// ── Helpers ────────────────────────────────────────────────────────────────────

const PIPELINE_ORDER: ProfilStatus[] = ["Eingereicht", "In Prüfung", "Präsentiert", "Interview", "Beauftragt", "Abgelehnt"]

const statusColors: Record<ProfilStatus, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Archiviert: "bg-gray-100 text-gray-600 border-gray-200",
}

const pipelineBarColors: Record<string, string> = {
  Eingereicht: "bg-blue-400",
  "In Prüfung": "bg-yellow-400",
  Präsentiert: "bg-purple-400",
  Interview: "bg-orange-400",
  Beauftragt: "bg-green-500",
  Abgelehnt: "bg-red-400",
}

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">–</span>
  const color = score >= 70 ? "bg-green-100 text-green-700 border-green-200" : score >= 40 ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200"
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>{score}</span>
}

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-8 w-20" /></CardHeader>
      <div className="px-6 pb-4"><Skeleton className="h-3 w-40" /></div>
    </Card>
  )
}

// ── Manager Dashboard ──────────────────────────────────────────────────────────

interface KpiCard {
  title: string
  value: string | number
  desc: string
  icon: React.ComponentType<{ className?: string }>
  alert: boolean
  green?: boolean
}

function ManagerDashboard({ data }: { data: ManagerData }) {
  const monatLabel = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })
  const { kpis, pipeline, agentur_performance, vakanzen_ohne_profile, bald_auslaufend, aktivitaet } = data

  const pipelineMax = Math.max(...PIPELINE_ORDER.map(s => pipeline[s] ?? 0), 1)

  const kpiCards: KpiCard[] = [
    {
      title: "Offene Vakanzen",
      value: kpis.aktive_vakanzen,
      desc: "Status = Offen",
      icon: IconBriefcase,
      alert: false,
    },
    {
      title: "Warten auf Entscheidung",
      value: kpis.in_pruefung,
      desc: 'Profile mit Status "In Prüfung"',
      icon: kpis.in_pruefung > 0 ? IconAlertTriangle : IconUsers,
      alert: kpis.in_pruefung > 0,
    },
    {
      title: "Aktive Beauftragungen",
      value: kpis.aktive_beauftragungen,
      desc: "Aktuell beauftragt",
      icon: IconUserCheck,
      alert: false,
    },
    {
      title: `Monatsmarge ${monatLabel}`,
      value: fmt(kpis.monats_marge),
      desc: "Aufschlag × h/Woche × 4",
      icon: IconCurrencyEuro,
      alert: false,
      green: true,
    },
  ]

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 px-4 lg:px-6 @xl/main:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className={card.alert ? "border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs">{card.title}</CardDescription>
                <card.icon className={`size-4 ${card.alert ? "text-yellow-600" : "text-muted-foreground"}`} />
              </div>
              <CardTitle className={`text-2xl font-bold tabular-nums ${card.green ? "text-green-700" : card.alert ? "text-yellow-700" : ""}`}>
                {card.value}
              </CardTitle>
            </CardHeader>
            <div className="px-6 pb-4">
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Pipeline + Agentur-Performance */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @2xl/main:grid-cols-2">

        {/* Kandidaten-Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kandidaten-Pipeline</CardTitle>
            <CardDescription>Profile nach Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE_ORDER.map((status) => {
              const count = pipeline[status] ?? 0
              const pct = Math.round((count / pipelineMax) * 100)
              const isAlert = status === "In Prüfung" && count > 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`w-28 shrink-0 text-xs ${isAlert ? "font-semibold text-yellow-700" : "text-muted-foreground"}`}>
                    {isAlert && "⚠ "}{status}
                  </span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-5 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className={`h-full rounded-sm transition-all ${pipelineBarColors[status] ?? "bg-gray-400"}`}
                        style={{ width: count === 0 ? "0%" : `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                    <span className={`w-6 text-right text-xs tabular-nums font-medium ${isAlert ? "text-yellow-700" : "text-foreground"}`}>
                      {count}
                    </span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Agentur-Performance */}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Agentur-Performance</CardTitle>
              <CardDescription>Ø KI-Score · Einreichungen gesamt</CardDescription>
            </div>
            <Link href="/agenturen" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Alle →
            </Link>
          </CardHeader>
          <CardContent>
            {agentur_performance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
            ) : (
              <div className="space-y-2">
                {agentur_performance.map((a) => (
                  <div key={a.name} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <IconBuilding className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">{a.count} Profile</span>
                      <ScoreBadge score={a.avg_score} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vakanzen ohne Profile + Bald auslaufend */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @2xl/main:grid-cols-2">

        {/* Vakanzen ohne Profile */}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Vakanzen ohne Profile</CardTitle>
              <CardDescription>Offene Vakanzen mit 0 Einreichungen</CardDescription>
            </div>
            <Link href="/vakanzen" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Alle →
            </Link>
          </CardHeader>
          <CardContent>
            {vakanzen_ohne_profile.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alle offenen Vakanzen haben Profile. ✓</p>
            ) : (
              <div className="space-y-1">
                {vakanzen_ohne_profile.map((v) => (
                  <Link
                    key={v.id}
                    href="/vakanzen"
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                  >
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

        {/* Bald auslaufende Vakanzen */}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Bald auslaufend</CardTitle>
              <CardDescription>Vakanzen mit Enddatum ≤ 30 Tage</CardDescription>
            </div>
            <Link href="/vakanzen" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Alle →
            </Link>
          </CardHeader>
          <CardContent>
            {bald_auslaufend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Vakanzen laufen in den nächsten 30 Tagen aus.</p>
            ) : (
              <div className="space-y-1">
                {bald_auslaufend.map((v) => {
                  const days = Math.ceil((new Date(v.enddatum).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <Link
                      key={v.id}
                      href="/vakanzen"
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                    >
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

      {/* Letzte Aktivitäten */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Aktivitäten</CardTitle>
            <CardDescription>Zuletzt aktualisierte Profile aller Agenturen</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Kandidat</TableHead>
                  <TableHead>Vakanz</TableHead>
                  <TableHead>Agentur</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KI-Score</TableHead>
                  <TableHead>Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aktivitaet.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Noch keine Profile eingereicht.
                    </TableCell>
                  </TableRow>
                ) : (
                  aktivitaet.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link href={`/profile/${row.id}`} className="hover:underline">{row.kandidatenname}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate">{row.vakanz_titel}</TableCell>
                      <TableCell className="text-muted-foreground">{row.agentur_name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell><ScoreBadge score={row.ki_score} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString("de-DE")}
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

// ── Agentur Dashboard (unverändert) ───────────────────────────────────────────

function AgenturDashboard({ data }: { data: AgenturData }) {
  const { kpis, aktivitaet } = data
  const kpiCards = [
    { title: "Offene Vakanzen", value: String(kpis.aktive_vakanzen), desc: "Aktuell ausgeschrieben", icon: IconBriefcase },
    { title: "Eingereichte Profile", value: String(kpis.eingereichte_profile), desc: "Ihre Einreichungen gesamt", icon: IconUsers },
    { title: "Pool-Ressourcen", value: String(kpis.pool_groesse ?? 0), desc: "Aktive Ressourcen im Pool", icon: IconStack2 },
  ]

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-3">
        {kpiCards.map((card) => (
          <Card key={card.title} className="@container/card">
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <div className="flex items-end justify-between gap-2">
                <CardTitle className="text-2xl font-semibold tabular-nums">{card.value}</CardTitle>
                <card.icon className="mb-1 size-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <div className="px-6 pb-4"><p className="text-sm text-muted-foreground">{card.desc}</p></div>
          </Card>
        ))}
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
            <CardDescription>Zuletzt aktualisierte eigene Profile</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Kandidat</TableHead>
                  <TableHead>Vakanz</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KI-Score</TableHead>
                  <TableHead>Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aktivitaet.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Noch keine Profile eingereicht.</TableCell></TableRow>
                ) : (
                  aktivitaet.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link href={`/profile/${row.id}`} className="hover:underline">{row.kandidatenname}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate">{row.vakanz_titel}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell><ScoreBadge score={row.ki_score} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString("de-DE")}
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
              <div className="grid grid-cols-2 gap-4 px-4 py-6 lg:px-6 @xl/main:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
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