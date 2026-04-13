"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconChevronRight,
  IconCurrencyEuro,
  IconDownload,
  IconFileText,
  IconLock,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

interface AbrechnungsZeile {
  kandidat: string
  vakanz: string
  stunden: number
  einkaufspreis: number
  verkaufspreis: number
}

interface AgenturAbrechnung {
  agentur: string
  zeilen: AbrechnungsZeile[]
}

const abrechnungsDaten: AgenturAbrechnung[] = [
  {
    agentur: "TechTalents GmbH",
    zeilen: [
      {
        kandidat: "A. Wagner",
        vakanz: "Senior React Developer",
        stunden: 160,
        einkaufspreis: 680,
        verkaufspreis: 800,
      },
      {
        kandidat: "P. Richter",
        vakanz: "Data Scientist",
        stunden: 128,
        einkaufspreis: 720,
        verkaufspreis: 850,
      },
      {
        kandidat: "J. Klein",
        vakanz: "Cloud Architect",
        stunden: 160,
        einkaufspreis: 820,
        verkaufspreis: 970,
      },
    ],
  },
  {
    agentur: "ProStaff AG",
    zeilen: [
      {
        kandidat: "T. Schulz",
        vakanz: "Cloud Architect",
        stunden: 160,
        einkaufspreis: 750,
        verkaufspreis: 890,
      },
      {
        kandidat: "M. Hoffmann",
        vakanz: "Senior React Developer",
        stunden: 160,
        einkaufspreis: 700,
        verkaufspreis: 825,
      },
      {
        kandidat: "C. Braun",
        vakanz: "Backend Java Developer",
        stunden: 128,
        einkaufspreis: 640,
        verkaufspreis: 750,
      },
    ],
  },
  {
    agentur: "Digital Experts",
    zeilen: [
      {
        kandidat: "R. Neumann",
        vakanz: "DevOps Engineer",
        stunden: 160,
        einkaufspreis: 710,
        verkaufspreis: 845,
      },
      {
        kandidat: "E. Schwarz",
        vakanz: "UI/UX Designer",
        stunden: 96,
        einkaufspreis: 580,
        verkaufspreis: 675,
      },
    ],
  },
]

function umsatz(z: AbrechnungsZeile) {
  return z.stunden * z.verkaufspreis
}

function kosten(z: AbrechnungsZeile) {
  return z.stunden * z.einkaufspreis
}

function marge(z: AbrechnungsZeile) {
  return umsatz(z) - kosten(z)
}

function agenturUmsatz(a: AgenturAbrechnung) {
  return a.zeilen.reduce((s, z) => s + umsatz(z), 0)
}

function agenturKosten(a: AgenturAbrechnung) {
  return a.zeilen.reduce((s, z) => s + kosten(z), 0)
}

function agenturMarge(a: AgenturAbrechnung) {
  return agenturUmsatz(a) - agenturKosten(a)
}

function fmt(n: number) {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  })
}

const MONATE = [
  "Januar 2026",
  "Februar 2026",
  "März 2026",
  "April 2026",
  "Mai 2026",
  "Juni 2026",
]

export default function AbrechnungPage() {
  const [monat, setMonat] = React.useState("April 2026")
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(
    Object.fromEntries(abrechnungsDaten.map((a) => [a.agentur, true]))
  )

  function toggleAgentur(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const totalUmsatz = abrechnungsDaten.reduce(
    (s, a) => s + agenturUmsatz(a),
    0
  )
  const totalKosten = abrechnungsDaten.reduce(
    (s, a) => s + agenturKosten(a),
    0
  )
  const totalMarge = totalUmsatz - totalKosten

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
        <SiteHeader title="Abrechnung" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Abrechnung</h2>
                  <p className="text-sm text-muted-foreground">
                    Monatliche Übersicht nach Agentur
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={monat} onValueChange={setMonat}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONATE.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <IconDownload className="size-4" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <IconFileText className="size-4" />
                    PDF
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
                <Card className="@container/card">
                  <CardHeader>
                    <CardDescription>Gesamt-Umsatz {monat}</CardDescription>
                    <CardTitle className="text-3xl font-semibold tabular-nums">
                      {fmt(totalUmsatz)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="@container/card">
                  <CardHeader>
                    <CardDescription>
                      <span className="inline-flex items-center gap-1">
                        <IconLock className="size-3" />
                        Gesamt-Kosten {monat}
                      </span>
                    </CardDescription>
                    <CardTitle className="text-3xl font-semibold tabular-nums text-muted-foreground">
                      {fmt(totalKosten)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="@container/card">
                  <CardHeader>
                    <CardDescription>
                      <span className="inline-flex items-center gap-1">
                        <IconLock className="size-3" />
                        Gesamt-Marge {monat}
                      </span>
                    </CardDescription>
                    <CardTitle className="text-3xl font-semibold tabular-nums text-green-700">
                      {fmt(totalMarge)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Grouped Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Kandidat / Agentur</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead className="text-right">Stunden</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />
                            EK €/h
                          </span>
                        </TableHead>
                        <TableHead className="text-right">VK €/h</TableHead>
                        <TableHead className="text-right">Umsatz</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />
                            Kosten
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />
                            Marge
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abrechnungsDaten.map((a) => {
                        const isOpen = expanded[a.agentur] ?? true
                        const au = agenturUmsatz(a)
                        const ak = agenturKosten(a)
                        const am = agenturMarge(a)
                        return (
                          <React.Fragment key={a.agentur}>
                            {/* Agency Header Row */}
                            <TableRow
                              className="bg-muted/40 cursor-pointer hover:bg-muted/60 font-medium"
                              onClick={() => toggleAgentur(a.agentur)}
                            >
                              <TableCell className="py-2">
                                {isOpen ? (
                                  <IconChevronDown className="size-4 text-muted-foreground" />
                                ) : (
                                  <IconChevronRight className="size-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell colSpan={2} className="font-semibold">
                                {a.agentur}{" "}
                                <span className="text-xs font-normal text-muted-foreground">
                                  ({a.zeilen.length} Beauftragungen)
                                </span>
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">
                                {fmt(au)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {fmt(ak)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-green-700 font-semibold">
                                {fmt(am)}
                              </TableCell>
                            </TableRow>

                            {/* Detail Rows */}
                            {isOpen &&
                              a.zeilen.map((z, i) => (
                                <TableRow key={i} className="border-b last:border-b-0">
                                  <TableCell></TableCell>
                                  <TableCell className="pl-6 text-sm">
                                    {z.kandidat}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {z.vakanz}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">
                                    {z.stunden}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                    {z.einkaufspreis} €
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">
                                    {z.verkaufspreis} €
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm">
                                    {fmt(umsatz(z))}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                    {fmt(kosten(z))}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-sm text-green-700">
                                    {fmt(marge(z))}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/80 font-bold">
                        <TableCell colSpan={6} className="text-right">
                          Gesamt {monat}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(totalUmsatz)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmt(totalKosten)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-green-700">
                          {fmt(totalMarge)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
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
