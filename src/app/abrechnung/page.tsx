"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconChevronRight,
  IconCurrencyEuro,
  IconDownload,
  IconLock,
  IconPrinter,
  IconUserCheck,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
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

interface AgenturGruppe {
  agentur_name: string
  agentur_id: string
  zeilen: Beauftragung[]
  umsatz: number
  kosten: number
  marge: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function calcUmsatz(b: Beauftragung) {
  return Number(b.verkaufspreis) * b.stunden_woche * 4
}

function calcKosten(b: Beauftragung) {
  return Number(b.einkaufspreis) * b.stunden_woche * 4
}

function gruppiereNachAgentur(daten: Beauftragung[]): AgenturGruppe[] {
  const map = new Map<string, AgenturGruppe>()
  for (const b of daten) {
    if (!map.has(b.agentur_id)) {
      map.set(b.agentur_id, {
        agentur_name: b.agentur_name,
        agentur_id: b.agentur_id,
        zeilen: [],
        umsatz: 0,
        kosten: 0,
        marge: 0,
      })
    }
    const g = map.get(b.agentur_id)!
    const u = calcUmsatz(b)
    const k = calcKosten(b)
    g.zeilen.push(b)
    g.umsatz += u
    g.kosten += k
    g.marge += u - k
  }
  return Array.from(map.values()).sort((a, b) =>
    a.agentur_name.localeCompare(b.agentur_name, "de")
  )
}

function monateListe() {
  const heute = new Date()
  const monate: { value: string; label: string }[] = []
  for (let i = -11; i <= 1; i++) {
    const d = new Date(heute.getFullYear(), heute.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    monate.push({ value, label })
  }
  return monate.reverse()
}

function aktuellerMonat() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function exportCSV(gruppen: AgenturGruppe[], monatLabel: string) {
  const BOM = "\uFEFF"
  const sep = ";"
  const header = [
    "Agentur", "Kandidat", "Vakanz", "h/Woche",
    "EK €/Tag", "VK €/Tag", "Marge%",
    "Umsatz/Mo", "Kosten/Mo", "Marge/Mo",
  ].join(sep)

  const zeilen: string[] = [BOM + header]

  for (const g of gruppen) {
    for (const b of g.zeilen) {
      const u = calcUmsatz(b)
      const k = calcKosten(b)
      zeilen.push([
        b.agentur_name,
        b.kandidatenname,
        b.vakanz_titel,
        b.stunden_woche,
        Number(b.einkaufspreis).toFixed(2).replace(".", ","),
        Number(b.verkaufspreis).toFixed(2).replace(".", ","),
        `${b.marge_prozent}%`,
        u.toFixed(2).replace(".", ","),
        k.toFixed(2).replace(".", ","),
        (u - k).toFixed(2).replace(".", ","),
      ].join(sep))
    }
    zeilen.push([
      `GESAMT ${g.agentur_name}`, "", "", "", "", "", "",
      g.umsatz.toFixed(2).replace(".", ","),
      g.kosten.toFixed(2).replace(".", ","),
      g.marge.toFixed(2).replace(".", ","),
    ].join(sep))
    zeilen.push("")
  }

  const blob = new Blob([zeilen.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Abrechnung_${monatLabel.replace(/\s/g, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
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

export default function AbrechnungPage() {
  const [beauftragungen, setBeauftragungen] = React.useState<Beauftragung[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [monat, setMonat] = React.useState(aktuellerMonat())
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const monate = React.useMemo(() => monateListe(), [])

  React.useEffect(() => {
    fetch("/api/beauftragungen")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Beauftragung[]) => {
        setBeauftragungen(data)
        // Expand all agencies by default
        const ids = [...new Set(data.map((b) => b.agentur_id))]
        setExpanded(Object.fromEntries(ids.map((id) => [id, true])))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Filter: aktiv + startdatum <= Ende des gewählten Monats
  const [monatJahr, monatMonat] = monat.split("-").map(Number)
  const monatEnde = new Date(monatJahr, monatMonat, 0) // letzter Tag des Monats
  const gefiltert = beauftragungen.filter((b) => {
    return new Date(b.startdatum) <= monatEnde && b.aktiv
  })

  const gruppen = React.useMemo(
    () => gruppiereNachAgentur(gefiltert),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monat, beauftragungen]
  )

  const totalUmsatz = gruppen.reduce((s, g) => s + g.umsatz, 0)
  const totalKosten = gruppen.reduce((s, g) => s + g.kosten, 0)
  const totalMarge = totalUmsatz - totalKosten

  const monatLabel = monate.find((m) => m.value === monat)?.label ?? monat

  const summaryCards = [
    { title: `Gesamt-Umsatz ${monatLabel}`, value: loading ? "–" : fmt(totalUmsatz), icon: IconCurrencyEuro },
    { title: `Gesamt-Kosten ${monatLabel}`, value: loading ? "–" : fmt(totalKosten), icon: IconLock },
    { title: `Gesamt-Marge ${monatLabel}`,  value: loading ? "–" : fmt(totalMarge),  icon: IconLock },
    { title: "Aktive Beauftragungen",        value: loading ? "–" : String(gefiltert.length), icon: IconUserCheck },
  ]

  function toggleAgentur(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Abrechnung" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header + Controls */}
              <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <div>
                  <h2 className="text-xl font-semibold">Monatliche Abrechnung</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Lädt…" : `${gefiltert.length} aktive Beauftragungen · ${monatLabel}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={monat}
                    onChange={(e) => setMonat(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {monate.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || gefiltert.length === 0}
                    onClick={() => exportCSV(gruppen, monatLabel)}
                    className="gap-1.5"
                  >
                    <IconDownload className="size-4" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || gefiltert.length === 0}
                    onClick={() => window.print()}
                    className="gap-1.5"
                  >
                    <IconPrinter className="size-4" />
                    PDF / Drucken
                  </Button>
                </div>
              </div>

              {/* Print-only header */}
              <div className="hidden print:block px-4 pb-4">
                <h1 className="text-2xl font-bold">Staffhub FMP — Monatsabrechnung</h1>
                <p className="text-lg">{monatLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Erstellt am {new Date().toLocaleDateString("de-DE")} · {gefiltert.length} Beauftragungen
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                {summaryCards.map((c) => (
                  <Card key={c.title} className="@container/card">
                    <CardHeader>
                      <CardDescription>{c.title}</CardDescription>
                      <div className="flex items-end justify-between gap-2">
                        <CardTitle
                          className={`text-2xl font-semibold tabular-nums ${
                            c.title.startsWith("Gesamt-Marge") ? "text-green-700" : ""
                          }`}
                        >
                          {c.value}
                        </CardTitle>
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
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Kandidat / Agentur</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead className="text-right">h/Woche</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />EK €/Tag
                          </span>
                        </TableHead>
                        <TableHead className="text-right">VK €/Tag</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />Marge%
                          </span>
                        </TableHead>
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
                        <TableSkeletonRows cols={10} />
                      ) : gefiltert.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                            Keine aktiven Beauftragungen für {monatLabel}.
                          </TableCell>
                        </TableRow>
                      ) : (
                        gruppen.map((g) => {
                          const isOpen = expanded[g.agentur_id] ?? true
                          return (
                            <React.Fragment key={g.agentur_id}>
                              {/* Agentur-Header-Zeile */}
                              <TableRow
                                className="bg-muted/40 cursor-pointer hover:bg-muted/60 font-medium"
                                onClick={() => toggleAgentur(g.agentur_id)}
                              >
                                <TableCell className="py-2">
                                  {isOpen
                                    ? <IconChevronDown className="size-4 text-muted-foreground" />
                                    : <IconChevronRight className="size-4 text-muted-foreground" />}
                                </TableCell>
                                <TableCell colSpan={2} className="font-semibold">
                                  {g.agentur_name}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    ({g.zeilen.length} Beauftragungen)
                                  </span>
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">{fmt(g.umsatz)}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(g.kosten)}</TableCell>
                                <TableCell className="text-right tabular-nums text-green-700 font-semibold">{fmt(g.marge)}</TableCell>
                              </TableRow>

                              {/* Kandidaten-Zeilen */}
                              {isOpen && g.zeilen.map((b) => {
                                const u = calcUmsatz(b)
                                const k = calcKosten(b)
                                return (
                                  <TableRow key={b.id}>
                                    <TableCell></TableCell>
                                    <TableCell className="pl-6 text-sm">{b.kandidatenname}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                                      {b.vakanz_titel}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">{b.stunden_woche}</TableCell>
                                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                      {Number(b.einkaufspreis).toLocaleString("de-DE")} €
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm font-medium">
                                      {Number(b.verkaufspreis).toLocaleString("de-DE")} €
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                      {b.marge_prozent}%
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">{fmt(u)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmt(k)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-sm text-green-700">{fmt(u - k)}</TableCell>
                                  </TableRow>
                                )
                              })}
                            </React.Fragment>
                          )
                        })
                      )}
                    </TableBody>
                    {!loading && gefiltert.length > 0 && (
                      <TableFooter>
                        <TableRow className="bg-muted/80 font-bold">
                          <TableCell colSpan={7} className="text-right">Gesamt {monatLabel}</TableCell>
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
