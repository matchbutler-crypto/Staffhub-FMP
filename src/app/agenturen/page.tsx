"use client"

import * as React from "react"
import {
  IconBuilding,
  IconCurrencyEuro,
  IconLock,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Beauftragung {
  id: string
  agentur: string
  kandidat: string
  vakanz: string
  stunden: number
  einkaufspreis: number
  margenaufschlag: number
  beauftragSeit: string
  stundenMonat: number
}

const mockBeauftragungen: Beauftragung[] = [
  {
    id: "1",
    agentur: "TechTalents GmbH",
    kandidat: "A. Wagner",
    vakanz: "Senior React Developer",
    stunden: 40,
    einkaufspreis: 680,
    margenaufschlag: 120,
    beauftragSeit: "01.04.2026",
    stundenMonat: 160,
  },
  {
    id: "2",
    agentur: "TechTalents GmbH",
    kandidat: "P. Richter",
    vakanz: "Data Scientist",
    stunden: 32,
    einkaufspreis: 720,
    margenaufschlag: 130,
    beauftragSeit: "15.03.2026",
    stundenMonat: 128,
  },
  {
    id: "3",
    agentur: "TechTalents GmbH",
    kandidat: "J. Klein",
    vakanz: "Cloud Architect",
    stunden: 40,
    einkaufspreis: 820,
    margenaufschlag: 150,
    beauftragSeit: "01.02.2026",
    stundenMonat: 160,
  },
  {
    id: "4",
    agentur: "ProStaff AG",
    kandidat: "T. Schulz",
    vakanz: "Cloud Architect",
    stunden: 40,
    einkaufspreis: 750,
    margenaufschlag: 140,
    beauftragSeit: "01.04.2026",
    stundenMonat: 160,
  },
  {
    id: "5",
    agentur: "ProStaff AG",
    kandidat: "M. Hoffmann",
    vakanz: "Senior React Developer",
    stunden: 40,
    einkaufspreis: 700,
    margenaufschlag: 125,
    beauftragSeit: "15.03.2026",
    stundenMonat: 160,
  },
  {
    id: "6",
    agentur: "ProStaff AG",
    kandidat: "C. Braun",
    vakanz: "Backend Java Developer",
    stunden: 32,
    einkaufspreis: 640,
    margenaufschlag: 110,
    beauftragSeit: "01.03.2026",
    stundenMonat: 128,
  },
  {
    id: "7",
    agentur: "Digital Experts",
    kandidat: "R. Neumann",
    vakanz: "DevOps Engineer",
    stunden: 40,
    einkaufspreis: 710,
    margenaufschlag: 135,
    beauftragSeit: "15.02.2026",
    stundenMonat: 160,
  },
  {
    id: "8",
    agentur: "Digital Experts",
    kandidat: "E. Schwarz",
    vakanz: "UI/UX Designer",
    stunden: 24,
    einkaufspreis: 580,
    margenaufschlag: 95,
    beauftragSeit: "01.04.2026",
    stundenMonat: 96,
  },
]

function calcVerkaufspreis(b: Beauftragung) {
  return b.einkaufspreis + b.margenaufschlag
}

function calcMarge(b: Beauftragung) {
  return b.margenaufschlag
}

function calcMargePercent(b: Beauftragung) {
  const vp = calcVerkaufspreis(b)
  return vp > 0 ? ((b.margenaufschlag / vp) * 100).toFixed(1) : "0.0"
}

function calcMonatsumsatz(b: Beauftragung) {
  return calcVerkaufspreis(b) * b.stundenMonat
}

function calcMonatskosten(b: Beauftragung) {
  return b.einkaufspreis * b.stundenMonat
}

function calcMonatsmarge(b: Beauftragung) {
  return calcMonatsumsatz(b) - calcMonatskosten(b)
}

function fmt(n: number) {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  })
}

export default function AgenturenPage() {
  const totalUmsatz = mockBeauftragungen.reduce(
    (s, b) => s + calcMonatsumsatz(b),
    0
  )
  const totalKosten = mockBeauftragungen.reduce(
    (s, b) => s + calcMonatskosten(b),
    0
  )
  const totalMarge = totalUmsatz - totalKosten

  const summaryCards = [
    {
      title: "Gesamt-Umsatz / Monat",
      value: fmt(totalUmsatz),
      icon: IconCurrencyEuro,
    },
    {
      title: "Gesamt-Kosten / Monat",
      value: fmt(totalKosten),
      icon: IconCurrencyEuro,
    },
    {
      title: "Gesamt-Marge / Monat",
      value: fmt(totalMarge),
      icon: IconCurrencyEuro,
    },
    {
      title: "Aktive Beauftragungen",
      value: String(mockBeauftragungen.length),
      icon: IconUserCheck,
    },
  ]

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Agenturen" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="px-4 lg:px-6">
                <h2 className="text-xl font-semibold">
                  Agentur-Übersicht – Aktive Beauftragungen
                </h2>
                <p className="text-sm text-muted-foreground">April 2026</p>
              </div>

              {/* Summary Cards */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                {summaryCards.map((c) => (
                  <Card key={c.title} className="@container/card">
                    <CardHeader>
                      <CardDescription>{c.title}</CardDescription>
                      <div className="flex items-end justify-between gap-2">
                        <CardTitle className="text-2xl font-semibold tabular-nums">
                          {c.value}
                        </CardTitle>
                        <c.icon className="mb-1 size-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Agentur</TableHead>
                        <TableHead>Kandidat</TableHead>
                        <TableHead>Vakanz / Rolle</TableHead>
                        <TableHead className="text-right">h/Woche</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />
                            EK €/Tag
                          </span>
                        </TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />
                            Aufschlag €
                          </span>
                        </TableHead>
                        <TableHead className="text-right">VK €/Tag</TableHead>
                        <TableHead className="text-right">
                          <span className="inline-flex items-center gap-1">
                            <IconLock className="size-3 text-muted-foreground" />
                            Marge
                          </span>
                        </TableHead>
                        <TableHead>Seit</TableHead>
                        <TableHead className="text-right">h/Monat</TableHead>
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
                            Monatsmarge
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockBeauftragungen.map((b) => {
                        const vk = calcVerkaufspreis(b)
                        const marge = calcMarge(b)
                        const margeP = calcMargePercent(b)
                        const umsatz = calcMonatsumsatz(b)
                        const kosten = calcMonatskosten(b)
                        const monatsmarge = calcMonatsmarge(b)
                        return (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium">
                              {b.agentur}
                            </TableCell>
                            <TableCell>{b.kandidat}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                              {b.vakanz}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.stunden}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {b.einkaufspreis} €
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {b.margenaufschlag} €
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {vk} €
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {marge} € / {margeP}%
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {b.beauftragSeit}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {b.stundenMonat}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmt(umsatz)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmt(kosten)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-green-700">
                              {fmt(monatsmarge)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/60 font-semibold">
                        <TableCell colSpan={10} className="text-right">
                          Gesamt
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
