"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconBriefcase,
  IconCurrencyEuro,
  IconUsers,
  IconUserCheck,
  IconStack2,
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

interface Kpis {
  aktive_vakanzen: number
  eingereichte_profile: number
  aktive_beauftragungen?: number
  pool_groesse?: number
  monats_marge: number | null
}

type ProfilStatus =
  | "Eingereicht"
  | "In Prüfung"
  | "Präsentiert"
  | "Interview"
  | "Beauftragt"
  | "Abgelehnt"
  | "Archiviert"

interface Aktivitaet {
  id: string
  kandidatenname: string
  vakanz_titel: string
  agentur_name: string
  status: ProfilStatus
  ki_score: number | null
  created_at: string
}

interface DashboardData {
  rolle: 'Manager' | 'Agentur'
  kpis: Kpis
  aktivitaet: Aktivitaet[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusColors: Record<ProfilStatus, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Archiviert: "bg-gray-100 text-gray-600 border-gray-200",
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">–</span>
  const color =
    score >= 70
      ? "bg-green-100 text-green-700 border-green-200"
      : score >= 40
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-red-100 text-red-700 border-red-200"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function KpiSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-8 w-20" />
      </CardHeader>
      <div className="px-6 pb-4">
        <Skeleton className="h-3 w-40" />
      </div>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const monatLabel = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })
  const isAgentur = data?.rolle === 'Agentur'

  const kpiCards = loading || !data ? [] : isAgentur ? [
    {
      title: "Offene Vakanzen",
      value: String(data.kpis.aktive_vakanzen),
      description: "Aktuell ausgeschrieben",
      icon: IconBriefcase,
    },
    {
      title: "Eingereichte Profile",
      value: String(data.kpis.eingereichte_profile),
      description: "Ihre Einreichungen gesamt",
      icon: IconUsers,
    },
    {
      title: "Pool-Ressourcen",
      value: String(data.kpis.pool_groesse ?? 0),
      description: "Aktive Ressourcen im Pool",
      icon: IconStack2,
    },
  ] : [
    {
      title: "Aktive Vakanzen",
      value: String(data.kpis.aktive_vakanzen),
      description: "Status = Offen",
      icon: IconBriefcase,
    },
    {
      title: "Eingereichte Profile",
      value: String(data.kpis.eingereichte_profile),
      description: "Alle Agenturen",
      icon: IconUsers,
    },
    {
      title: "Aktive Beauftragungen",
      value: String(data.kpis.aktive_beauftragungen ?? 0),
      description: "Aktuell beauftragt",
      icon: IconUserCheck,
    },
    {
      title: `Monatsmarge ${monatLabel}`,
      value: fmt(data.kpis.monats_marge ?? 0),
      description: "Aufschlag × h/Woche × 4",
      icon: IconCurrencyEuro,
      highlight: true,
    },
  ]

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <UnauthorizedToast />
        <SiteHeader title="Dashboard" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler beim Laden: {error}
                </div>
              )}

              {/* KPI Cards */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
                  : kpiCards.map((card) => (
                    <Card key={card.title} className="@container/card">
                      <CardHeader>
                        <CardDescription>{card.title}</CardDescription>
                        <div className="flex items-end justify-between gap-2">
                          <CardTitle
                            className={`text-2xl font-semibold tabular-nums @[250px]/card:text-3xl ${'highlight' in card && card.highlight ? "text-green-700" : ""}`}
                          >
                            {card.value}
                          </CardTitle>
                          <card.icon className="mb-1 size-5 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <div className="px-6 pb-4">
                        <p className="text-sm text-muted-foreground">{card.description}</p>
                      </div>
                    </Card>
                  ))}
              </div>

              {/* Letzte Aktivitäten */}
              <div className="px-4 lg:px-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Letzte Aktivitäten</CardTitle>
                    <CardDescription>
                      {isAgentur
                        ? "Zuletzt aktualisierte eigene Profile"
                        : "Zuletzt aktualisierte Profile aller Agenturen"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead>Kandidat</TableHead>
                          <TableHead>Vakanz</TableHead>
                          {!isAgentur && <TableHead>Agentur</TableHead>}
                          <TableHead>Status</TableHead>
                          <TableHead>KI-Score</TableHead>
                          <TableHead>Datum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                              {Array.from({ length: isAgentur ? 5 : 6 }).map((_, j) => (
                                <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (data?.aktivitaet ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAgentur ? 5 : 6} className="h-24 text-center text-muted-foreground">
                              Noch keine Profile eingereicht.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (data?.aktivitaet ?? []).map((row) => (
                            <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-medium">
                                <Link href={`/profile/${row.id}`} className="hover:underline">
                                  {row.kandidatenname}
                                </Link>
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-[160px] truncate">
                                {row.vakanz_titel}
                              </TableCell>
                              {!isAgentur && (
                                <TableCell className="text-muted-foreground">
                                  {row.agentur_name}
                                </TableCell>
                              )}
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                    statusColors[row.status] ?? "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </TableCell>
                              <TableCell>
                                <ScoreBadge score={row.ki_score} />
                              </TableCell>
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
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
