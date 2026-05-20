"use client"

import * as React from "react"
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsUpDown,
  IconChevronDown,
  IconChevronRight,
  IconCurrencyEuro,
  IconDownload,
  IconLock,
  IconPrinter,
  IconUpload,
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
  agentur_name: string
  kandidatenname: string
  erfahrungslevel: string
  vakanz_titel: string
  einkaufspreis?: number
  margenaufschlag?: number
  verkaufspreis?: number
  marge_prozent?: number
  startdatum: string
  stunden_woche: number
  aktiv: boolean
}

interface Zeitnachweis {
  id: string
  beauftragung_id: string
  monat: string
  stunden_ist: number | null
  uploaded_at: string
}

interface Rechnung {
  id: string
  beauftragung_id: string
  monat: string
  gesamtbetrag: number
  status: 'Entwurf' | 'Versendet' | 'Bezahlt'
  betrag_bezahlt: number
  created_at: string
  sent_at: string | null
  paid_at: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
}

function effectiveStunden(b: Beauftragung, zn: Zeitnachweis | undefined): number {
  return zn?.stunden_ist ?? (b.stunden_woche * 4)
}

function calcMarge(b: Beauftragung, zn?: Zeitnachweis): number {
  return ((b.verkaufspreis ?? 0) - (b.einkaufspreis ?? 0)) * effectiveStunden(b, zn)
}

function calcGesamtbetrag(b: Beauftragung, zn?: Zeitnachweis): number {
  return (b.verkaufspreis ?? 0) * effectiveStunden(b, zn)
}

// Legacy helpers for backward compatibility with existing JSX
function calcUmsatz(b: Beauftragung, zn?: Zeitnachweis) {
  return (b.verkaufspreis ?? 0) * effectiveStunden(b, zn)
}

function calcKosten(b: Beauftragung, zn?: Zeitnachweis) {
  return (b.einkaufspreis ?? 0) * effectiveStunden(b, zn)
}

interface AgenturGruppe {
  agentur_name: string
  agentur_id: string
  zeilen: Beauftragung[]
  umsatz: number
  kosten: number
  marge: number
}

function gruppiereNachAgentur(
  daten: Beauftragung[],
  zeitnachweise: Map<string, Zeitnachweis>
): AgenturGruppe[] {
  const map = new Map<string, AgenturGruppe>()
  for (const b of daten) {
    if (!map.has(b.agentur_id)) {
      map.set(b.agentur_id, { agentur_name: b.agentur_name, agentur_id: b.agentur_id, zeilen: [], umsatz: 0, kosten: 0, marge: 0 })
    }
    const g = map.get(b.agentur_id)!
    const zn = zeitnachweise.get(b.id)
    const u = calcUmsatz(b, zn)
    const k = calcKosten(b, zn)
    g.zeilen.push(b)
    g.umsatz += u
    g.kosten += k
    g.marge += u - k
  }
  return Array.from(map.values()).sort((a, b) => a.agentur_name.localeCompare(b.agentur_name, "de"))
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

function exportCSV(
  beauftragungen: Beauftragung[],
  zeitnachweise: Map<string, Zeitnachweis>,
  rechnungen: Map<string, Rechnung>,
  monatLabel: string
) {
  const BOM = "\uFEFF"
  const sep = ";"
  const header = [
    "Ressource",
    "Vakanz",
    "h/Woche",
    "Stunden (Ist)",
    "EK €/Tag",
    "VK €/Tag",
    "Marge%",
    "Umsatz",
    "Kosten",
    "Marge €",
    "Status",
    "Offene Beträge",
  ].join(sep)
  const zeilen: string[] = [BOM + header]
  for (const b of beauftragungen) {
    const zn = zeitnachweise.get(b.id)
    const rech = rechnungen.get(b.id)
    const stunden = effectiveStunden(b, zn)
    const umsatz = calcGesamtbetrag(b, zn)
    const kosten = (b.einkaufspreis ?? 0) * stunden
    const marge = calcMarge(b, zn)
    const offene = rech && rech.status !== "Bezahlt" ? rech.gesamtbetrag - rech.betrag_bezahlt : 0
    zeilen.push(
      [
        b.kandidatenname,
        b.vakanz_titel,
        b.stunden_woche,
        stunden,
        (b.einkaufspreis ?? 0).toFixed(2).replace(".", ","),
        (b.verkaufspreis ?? 0).toFixed(2).replace(".", ","),
        `${b.marge_prozent ?? 0}%`,
        umsatz.toFixed(2).replace(".", ","),
        kosten.toFixed(2).replace(".", ","),
        marge.toFixed(2).replace(".", ","),
        rech?.status ?? "—",
        offene.toFixed(2).replace(".", ","),
      ].join(sep)
    )
  }
  const blob = new Blob([zeilen.join("\r\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Abrechnung_${monatLabel.replace(/\s/g, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function SortIcon({ column, active, direction }: { column: string; active: boolean; direction?: "asc" | "desc" }) {
  if (!active) return <IconArrowsUpDown className="h-4 w-4 text-muted-foreground" />
  return direction === "asc" ? (
    <IconArrowUp className="h-4 w-4" />
  ) : (
    <IconArrowDown className="h-4 w-4" />
  )
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
  const [zeitnachweise, setZeitnachweise] = React.useState<Map<string, Zeitnachweis>>(new Map())
  const [rechnungen, setRechnungen] = React.useState<Map<string, Rechnung>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [monat, setMonat] = React.useState(aktuellerMonat())
  const [rolle, setRolle] = React.useState<string>("")

  // Filtering & Sorting
  const [filterAgentur, setFilterAgentur] = React.useState<string>("Alle")
  const [filterStatus, setFilterStatus] = React.useState<string>("Alle")
  const [sortColumn, setSortColumn] = React.useState<string>("Ressource")
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")

  // Upload state
  const [uploadingId, setUploadingId] = React.useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = React.useState<Record<string, string>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const uploadTargetRef = React.useRef<{ beauftragungId: string; monat: string } | null>(null)

  // Legacy state for backward compatibility with existing JSX
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [margenOverrides, setMargenOverrides] = React.useState<Record<string, number>>({})
  const [savingMarge, setSavingMarge] = React.useState<Record<string, boolean>>({})

  const monate = React.useMemo(() => monateListe(), [])

  React.useEffect(() => {
    const [year, month] = monat.split("-").map(Number)
    const monatDate = `${year}-${String(month).padStart(2, "0")}-01`

    Promise.all([
      fetch("/api/beauftragungen").then((r) => (r.ok ? r.json() : { data: [], rolle: "" })),
      fetch(`/api/zeitnachweise?beauftragung_ids=all&monat=${monatDate}`).then((r) =>
        r.ok ? r.json() : { zeitnachweise: [] }
      ),
      fetch(`/api/rechnungen?beauftragung_ids=all&monat=${monatDate}`).then((r) =>
        r.ok ? r.json() : { rechnungen: [] }
      ),
    ])
      .then(([beauftragungen, { zeitnachweise: znList }, { rechnungen: rechnungList }]) => {
        const filtered: Beauftragung[] = Array.isArray(beauftragungen) ? beauftragungen : (beauftragungen.data ?? [])
        setBeauftragungen(filtered)
        if (beauftragungen.rolle) setRolle(beauftragungen.rolle)

        // Initialize expanded state for agencies
        const ids = [...new Set(filtered.map((b: Beauftragung) => b.agentur_id))]
        setExpanded(Object.fromEntries(ids.map((id) => [id, true])))

        const znMap = new Map<string, Zeitnachweis>()
        for (const zn of (znList ?? [])) znMap.set(zn.beauftragung_id, zn)
        setZeitnachweise(znMap)

        const rMap = new Map<string, Rechnung>()
        for (const r of (rechnungList ?? [])) rMap.set(r.beauftragung_id, r)
        setRechnungen(rMap)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [monat])

  const [monatJahr, monatMonat] = monat.split("-").map(Number)
  const monatEnde = new Date(monatJahr, monatMonat, 0)
  const gefiltert = beauftragungen.filter((b) => new Date(b.startdatum) <= monatEnde && b.aktiv)

  const gruppen = React.useMemo(
    () => gruppiereNachAgentur(gefiltert, zeitnachweise),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monat, beauftragungen, zeitnachweise]
  )

  const isFinancial = rolle === 'Staffhub Manager' || rolle === 'Admin'
  const isController = rolle === 'Controller'
  const isAgentur = rolle === 'Agentur'
  const canEditMarge = rolle === 'Admin'
  const colCount = loading || isFinancial ? (canEditMarge ? 12 : 11) : isController ? 8 : 5

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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function toggleAgentur(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function saveMarge(beauftragungId: string, value: number) {
    setSavingMarge((prev) => ({ ...prev, [beauftragungId]: true }))
    try {
      const r = await fetch(`/api/beauftragungen/${beauftragungId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ margenaufschlag: value }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? "Fehler")
      setBeauftragungen((prev) =>
        prev.map((b) => b.id === beauftragungId ? { ...b, margenaufschlag: value } : b)
      )
    } catch {
      setMargenOverrides((prev) => { const next = { ...prev }; delete next[beauftragungId]; return next })
    } finally {
      setSavingMarge((prev) => ({ ...prev, [beauftragungId]: false }))
    }
  }

  function triggerUpload(beauftragungId: string) {
    const [year, month] = monat.split("-").map(Number)
    uploadTargetRef.current = {
      beauftragungId,
      monat: `${year}-${String(month).padStart(2, "0")}-01`,
    }
    fileInputRef.current?.click()
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const target = uploadTargetRef.current
    if (!file || !target) return
    e.target.value = ""
    setUploadingId(target.beauftragungId)
    setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: "" }))
    const fd = new FormData()
    fd.append("file", file)
    fd.append("beauftragung_id", target.beauftragungId)
    fd.append("monat", target.monat)
    try {
      const r = await fetch("/api/zeitnachweise", { method: "POST", body: fd })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? "Upload fehlgeschlagen")
      const zn: Zeitnachweis = body.zeitnachweis
      setZeitnachweise((prev) => { const next = new Map(prev); next.set(zn.beauftragung_id, zn); return next })
      if (zn.stunden_ist === null) {
        setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: "Stunden konnten nicht extrahiert werden." }))
      }
    } catch (err) {
      setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: err instanceof Error ? err.message : "Upload fehlgeschlagen" }))
    } finally {
      setUploadingId(null)
      uploadTargetRef.current = null
    }
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
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
                    onClick={() => exportCSV(beauftragungen, zeitnachweise, rechnungen, monatLabel)}
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
                        {(isFinancial || isAgentur) && (
                          <TableHead className="text-right">h/Woche</TableHead>
                        )}
                        {isFinancial && (
                          <>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />EK €/Tag</span>
                            </TableHead>
                            <TableHead className="text-right">VK €/Tag</TableHead>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge%</span>
                            </TableHead>
                            <TableHead className="text-right">Umsatz/Mo</TableHead>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Kosten/Mo</span>
                            </TableHead>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge/Mo</span>
                            </TableHead>
                          </>
                        )}
                        {canEditMarge && (
                          <TableHead className="text-right">Marge €/Std</TableHead>
                        )}
                        {isController && (
                          <>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />EK €/Tag</span>
                            </TableHead>
                            <TableHead className="text-right">VK €/Tag</TableHead>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge €/Tag</span>
                            </TableHead>
                            <TableHead className="text-right">Std/Mo (Ist)</TableHead>
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1"><IconLock className="size-3 text-muted-foreground" />Marge/Mo</span>
                            </TableHead>
                          </>
                        )}
                        {!isController && (
                          <TableHead className="text-right print:hidden">Zeitnachweis</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={colCount} />
                      ) : gefiltert.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={colCount} className="h-32 text-center text-muted-foreground">
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
                                  {isOpen ? <IconChevronDown className="size-4 text-muted-foreground" /> : <IconChevronRight className="size-4 text-muted-foreground" />}
                                </TableCell>
                                <TableCell colSpan={2} className="font-semibold">
                                  {g.agentur_name}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">({g.zeilen.length} Beauftragungen)</span>
                                </TableCell>
                                {isFinancial && (
                                  <>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right tabular-nums font-semibold">{fmt(g.umsatz)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(g.kosten)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-green-700 font-semibold">{fmt(g.marge)}</TableCell>
                                    {canEditMarge && <TableCell></TableCell>}
                                  </>
                                )}
                                {isController && (
                                  <>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right tabular-nums text-green-700 font-semibold">
                                      {fmt(g.zeilen.reduce((sum, b) => {
                                        const zn = zeitnachweise.get(b.id)
                                        const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
                                        return sum + marge * effectiveStunden(b, zn)
                                      }, 0))}
                                    </TableCell>
                                  </>
                                )}
                                {isAgentur && (
                                  <>
                                    <TableCell></TableCell>
                                  </>
                                )}
                                {!isController && <TableCell className="print:hidden"></TableCell>}
                              </TableRow>

                              {/* Kandidaten-Zeilen */}
                              {isOpen && g.zeilen.map((b) => {
                                return (
                                  <TableRow key={b.id}>
                                    <TableCell></TableCell>
                                    <TableCell className="pl-6 text-sm">{b.kandidatenname}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{b.vakanz_titel}</TableCell>
                                    {(isFinancial || isAgentur) && (
                                      <TableCell className="text-right tabular-nums text-sm">{b.stunden_woche}</TableCell>
                                    )}
                                    {isFinancial && (
                                      <>
                                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                          {(b.einkaufspreis ?? 0).toLocaleString("de-DE")} €
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm font-medium">
                                          {(b.verkaufspreis ?? 0).toLocaleString("de-DE")} €
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                          {b.marge_prozent ?? 0}%
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm">{fmt(calcUmsatz(b, zeitnachweise.get(b.id)))}</TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmt(calcKosten(b, zeitnachweise.get(b.id)))}</TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-green-700">
                                          {fmt(calcUmsatz(b, zeitnachweise.get(b.id)) - calcKosten(b, zeitnachweise.get(b.id)))}
                                        </TableCell>
                                      </>
                                    )}
                                    {canEditMarge && (
                                      <TableCell className="text-right tabular-nums text-sm">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={margenOverrides[b.id] ?? b.margenaufschlag ?? 0}
                                          onChange={(e) => setMargenOverrides((prev) => ({ ...prev, [b.id]: parseFloat(e.target.value) || 0 }))}
                                          onBlur={(e) => saveMarge(b.id, parseFloat(e.target.value) || 0)}
                                          disabled={savingMarge[b.id]}
                                          className="w-20 rounded border border-input bg-background px-2 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                                        />
                                      </TableCell>
                                    )}
                                    {isController && (() => {
                                      const zn = zeitnachweise.get(b.id)
                                      const stunden = effectiveStunden(b, zn)
                                      const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
                                      return (
                                        <>
                                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                            {(b.einkaufspreis ?? 0).toLocaleString("de-DE")} €
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums text-sm font-medium">
                                            {(b.verkaufspreis ?? 0).toLocaleString("de-DE")} €
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums text-sm">
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={margenOverrides[b.id] ?? b.margenaufschlag ?? 0}
                                              onChange={(e) => setMargenOverrides((prev) => ({ ...prev, [b.id]: parseFloat(e.target.value) || 0 }))}
                                              onBlur={(e) => saveMarge(b.id, parseFloat(e.target.value) || 0)}
                                              disabled={savingMarge[b.id]}
                                              className="w-20 rounded border border-input bg-background px-2 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                                            />
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                            {stunden}{zn?.stunden_ist != null ? "" : <span className="ml-1 text-[10px] text-muted-foreground/60">est.</span>}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums text-sm text-green-700">
                                            {fmt(marge * stunden)}
                                          </TableCell>
                                        </>
                                      )
                                    })()}
                                    {!isController && (
                                      <TableCell className="text-right print:hidden">
                                        {uploadErrors[b.id] && (
                                          <p className="text-[10px] text-destructive mb-1">{uploadErrors[b.id]}</p>
                                        )}
                                        {zeitnachweise.has(b.id) ? (
                                          <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-[10px] text-green-700 font-medium">
                                              {zeitnachweise.get(b.id)!.stunden_ist != null ? `${zeitnachweise.get(b.id)!.stunden_ist} Std.` : "Parsing fehlgeschlagen"}
                                            </span>
                                            <button
                                              className="text-[10px] text-muted-foreground hover:underline disabled:opacity-50"
                                              onClick={() => triggerUpload(b.id)}
                                              disabled={uploadingId === b.id}
                                            >
                                              {uploadingId === b.id ? "Lädt…" : "Ersetzen"}
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
                                            onClick={() => triggerUpload(b.id)}
                                            disabled={uploadingId === b.id}
                                          >
                                            <IconUpload className="size-3" />
                                            {uploadingId === b.id ? "Lädt…" : "Upload"}
                                          </button>
                                        )}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                )
                              })}
                            </React.Fragment>
                          )
                        })
                      )}
                    </TableBody>
                    {!loading && gefiltert.length > 0 && (isFinancial || isController) && (
                      <TableFooter>
                        <TableRow className="bg-muted/80 font-bold">
                          {isFinancial && (
                            <>
                              <TableCell colSpan={8} className="text-right">Gesamt {monatLabel}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(totalUmsatz)}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(totalKosten)}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-700">{fmt(totalMarge)}</TableCell>
                              {canEditMarge && <TableCell></TableCell>}
                              <TableCell className="print:hidden"></TableCell>
                            </>
                          )}
                          {isController && (
                            <>
                              <TableCell colSpan={7} className="text-right">Gesamt {monatLabel}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-700">
                                {fmt(gefiltert.reduce((sum, b) => {
                                  const zn = zeitnachweise.get(b.id)
                                  const marge = margenOverrides[b.id] ?? b.margenaufschlag ?? 0
                                  return sum + marge * effectiveStunden(b, zn)
                                }, 0))}
                              </TableCell>
                            </>
                          )}
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
    </>
  )
}
