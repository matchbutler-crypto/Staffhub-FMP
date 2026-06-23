"use client"

import * as React from "react"
import {
  IconCurrencyEuro,
  IconLock,
  IconUserCheck,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Beauftragung {
  id: string
  profil_id: string
  agentur_id: string
  kandidatenname: string
  erfahrungslevel: string
  vakanz_titel: string
  agentur_name: string
  einkaufspreis: number
  margenaufschlag: number
  verkaufspreis: number
  marge_prozent: number
  startdatum: string
  stunden_woche: number
  aktiv: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function calcMonatsumsatz(b: Beauftragung) {
  // Stunden/Woche × 4,33 Wochen/Monat × Tagessatz/8h ≈ vereinfacht: stunden_woche × 4 × verkaufspreis/8
  // Einfacher für MVP: Monatsstunden = stunden_woche × 4
  return b.verkaufspreis * b.stunden_woche * 4
}

function calcMonatskosten(b: Beauftragung) {
  return b.einkaufspreis * b.stunden_woche * 4
}

function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AgenturenPage() {
  const [beauftragungen, setBeauftragungen] = React.useState<Beauftragung[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/beauftragungen?aktiv=true")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((body) => setBeauftragungen(Array.isArray(body) ? body : (body.data ?? [])))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalUmsatz = beauftragungen.reduce((s, b) => s + calcMonatsumsatz(b), 0)
  const totalKosten = beauftragungen.reduce((s, b) => s + calcMonatskosten(b), 0)
  const totalMarge = totalUmsatz - totalKosten

  const summaryCards = [
    { title: "Gesamt-Umsatz / Monat", value: loading ? "–" : fmt(totalUmsatz), icon: IconCurrencyEuro },
    { title: "Gesamt-Kosten / Monat", value: loading ? "–" : fmt(totalKosten), icon: IconCurrencyEuro },
    { title: "Gesamt-Marge / Monat",  value: loading ? "–" : fmt(totalMarge),  icon: IconCurrencyEuro },
    { title: "Aktive Beauftragungen", value: loading ? "–" : String(beauftragungen.length), icon: IconUserCheck },
  ]

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Agenturen" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="px-4 lg:px-6">
                <h2 className="text-xl font-semibold">Agentur-Übersicht – Aktive Beauftragungen</h2>
                <p className="text-sm text-muted-foreground">
                  {loading ? "Lädt…" : `${beauftragungen.length} aktive Beauftragungen`}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                {summaryCards.map((c) => (
                  <Card key={c.title} className="@container/card">
                    <CardHeader>
                      <CardDescription>{c.title}</CardDescription>
                      <div className="flex items-end justify-between gap-2">
                        <CardTitle className="text-2xl font-semibold tabular-nums">{c.value}</CardTitle>
                        <c.icon className="mb-1 size-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler beim Laden: {error}
                </div>
              )}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Agentur</TableHead>
                        <TableHead>Kandidat</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead className="text-right">h/Woche</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />Tagesrate
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />Aufschlag €
                          </span>
                        </TableHead>
                        <TableHead className="text-right">VK €/Tag</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />Marge
                          </span>
                        </TableHead>
                        <TableHead>Seit</TableHead>
                        <TableHead className="text-right">Umsatz/Mo</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />Kosten/Mo
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />Marge/Mo
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={12} />
                      ) : beauftragungen.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                            Keine aktiven Beauftragungen vorhanden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        beauftragungen.map((b) => {
                          const umsatz = calcMonatsumsatz(b)
                          const kosten = calcMonatskosten(b)
                          const monatsmarge = umsatz - kosten
                          return (
                            <TableRow key={b.id}>
                              <TableCell className="font-medium">{b.agentur_name}</TableCell>
                              <TableCell>{b.kandidatenname}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                                {b.vakanz_titel}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{b.stunden_woche}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {Number(b.einkaufspreis).toLocaleString("de-DE")} €
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {Number(b.margenaufschlag).toLocaleString("de-DE")} €
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {Number(b.verkaufspreis).toLocaleString("de-DE")} €
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {Number(b.margenaufschlag).toLocaleString("de-DE")} € / {b.marge_prozent}%
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {new Date(b.startdatum).toLocaleDateString("de-DE")}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{fmt(umsatz)}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(kosten)}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium text-green-700">{fmt(monatsmarge)}</TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                    {!loading && beauftragungen.length > 0 && (
                      <TableFooter>
                        <TableRow className="bg-muted/60 font-semibold">
                          <TableCell colSpan={9} className="text-right">Gesamt</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(totalUmsatz)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(totalKosten)}</TableCell>
                          <TableCell className="text-right tabular-nums text-green-700">{fmt(totalMarge)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
