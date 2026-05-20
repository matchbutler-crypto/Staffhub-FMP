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

  // Filtered + sorted data calculation
  const [monatJahr2, monatMonat2] = monat.split('-').map(Number)
  const monatEnde2 = new Date(monatJahr2, monatMonat2, 0)
  const monatLabel2 = new Date(monatJahr2, monatMonat2 - 1, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })

  // Filter by date + agentur + status
  let filtered = beauftragungen.filter(
    (b) => new Date(b.startdatum) <= monatEnde2 && b.aktiv && (filterAgentur === 'Alle' || b.agentur_id === filterAgentur)
  )

  // Status filter
  if (filterStatus !== 'Alle') {
    filtered = filtered.filter((b) => {
      const rech = rechnungen.get(b.id)
      if (filterStatus === 'Kein Rechnung') return !rech
      return rech?.status === filterStatus
    })
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal: string | number = ''
    let bVal: string | number = ''

    switch (sortColumn) {
      case 'Ressource':
        aVal = a.kandidatenname
        bVal = b.kandidatenname
        break
      case 'Marge €':
        aVal = calcMarge(a, zeitnachweise.get(a.id))
        bVal = calcMarge(b, zeitnachweise.get(b.id))
        break
      case 'Gesamtbetrag':
        aVal = calcGesamtbetrag(a, zeitnachweise.get(a.id))
        bVal = calcGesamtbetrag(b, zeitnachweise.get(b.id))
        break
      case 'Status':
        aVal = rechnungen.get(a.id)?.status ?? 'Zzz'
        bVal = rechnungen.get(b.id)?.status ?? 'Zzz'
        break
      case 'Offene Beträge':
        const aOffene = rechnungen.get(a.id)
          ? rechnungen.get(a.id)!.status !== 'Bezahlt'
            ? rechnungen.get(a.id)!.gesamtbetrag - rechnungen.get(a.id)!.betrag_bezahlt
            : 0
          : 0
        const bOffene = rechnungen.get(b.id)
          ? rechnungen.get(b.id)!.status !== 'Bezahlt'
            ? rechnungen.get(b.id)!.gesamtbetrag - rechnungen.get(b.id)!.betrag_bezahlt
            : 0
          : 0
        aVal = aOffene
        bVal = bOffene
        break
      default:
        aVal = a.kandidatenname
        bVal = b.kandidatenname
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
  })

  // Calculate KPI metrics
  const gesamtStundenSoll = filtered.reduce((sum, b) => sum + b.stunden_woche * 4, 0)
  const gesamtStundenIst = filtered.reduce((sum, b) => sum + effectiveStunden(b, zeitnachweise.get(b.id)), 0)
  const gesamtUmsatz2 = filtered.reduce((sum, b) => sum + calcGesamtbetrag(b, zeitnachweise.get(b.id)), 0)
  const aktivCount = filtered.length
  const offeneBetraege = Array.from(rechnungen.values())
    .filter((r) => r.status !== 'Bezahlt')
    .reduce((sum, r) => sum + (r.gesamtbetrag - r.betrag_bezahlt), 0)

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
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelect}
      />
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader title="Abrechnung" />
          <main className="flex-1 flex flex-col gap-6 p-6 overflow-auto">
            {/* Header + Controls */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Abrechnung</h1>
              <div className="flex items-center gap-3">
                <select
                  value={monat}
                  onChange={(e) => setMonat(e.target.value)}
                  className="rounded border border-input bg-background px-3 py-2 text-sm"
                >
                  {monate.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => exportCSV(filtered, zeitnachweise, rechnungen, monatLabel2)}
                  className="rounded border border-input px-3 py-2 text-sm hover:bg-muted"
                >
                  📥 CSV
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            {!loading && (
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">Gesamtstunden</div>
                  <div className="mt-2 text-2xl font-bold">
                    {gesamtStundenSoll} <span className="text-base text-muted-foreground">/ {gesamtStundenIst}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Soll / Ist</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">Gesamtumsatz</div>
                  <div className="mt-2 text-2xl font-bold">{fmt(gesamtUmsatz2)}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">Aktive Beauftragungen</div>
                  <div className="mt-2 text-2xl font-bold">{aktivCount}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">Offene Beträge</div>
                  <div className="mt-2 text-2xl font-bold">{fmt(offeneBetraege)}</div>
                </div>
              </div>
            )}

            {/* Filter Controls */}
            {!loading && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Agentur:</label>
                  <select
                    value={filterAgentur}
                    onChange={(e) => setFilterAgentur(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="Alle">Alle</option>
                    {Array.from(new Set(beauftragungen.map((b) => b.agentur_id))).map((id) => {
                      const name = beauftragungen.find((b) => b.agentur_id === id)?.agentur_name
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Zahlungsstatus:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="Alle">Alle</option>
                    <option value="Entwurf">Entwurf</option>
                    <option value="Versendet">Versendet</option>
                    <option value="Bezahlt">Bezahlt</option>
                    <option value="Kein Rechnung">Kein Rechnung</option>
                  </select>
                </div>
              </div>
            )}

            {/* Table */}
            {error && <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            {loading && (
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Array.from({ length: 7 }).map((_, i) => (
                        <TableCell key={i}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="rounded border">
                <Table>
                  <TableHeader className="bg-muted sticky top-0 z-10">
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 select-none"
                        onClick={() => handleSort('Ressource')}
                      >
                        <div className="flex items-center gap-1">
                          Ressource
                          <SortIcon
                            column="Ressource"
                            active={sortColumn === 'Ressource'}
                            direction={sortDirection}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="select-none">Vakanz</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 select-none text-right"
                        onClick={() => handleSort('Marge €')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Marge €<SortIcon column="Marge €" active={sortColumn === 'Marge €'} direction={sortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 select-none text-right"
                        onClick={() => handleSort('Gesamtbetrag')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Gesamtbetrag
                          <SortIcon
                            column="Gesamtbetrag"
                            active={sortColumn === 'Gesamtbetrag'}
                            direction={sortDirection}
                          />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 select-none text-right"
                        onClick={() => handleSort('Status')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Status<SortIcon column="Status" active={sortColumn === 'Status'} direction={sortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 select-none text-right"
                        onClick={() => handleSort('Offene Beträge')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Offene Beträge
                          <SortIcon
                            column="Offene Beträge"
                            active={sortColumn === 'Offene Beträge'}
                            direction={sortDirection}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="text-right print:hidden">Zeitnachweis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((b) => {
                      const zn = zeitnachweise.get(b.id)
                      const rech = rechnungen.get(b.id)
                      const offene =
                        rech && rech.status !== 'Bezahlt' ? rech.gesamtbetrag - rech.betrag_bezahlt : 0
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.kandidatenname}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {b.vakanz_titel}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(calcMarge(b, zn))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(calcGesamtbetrag(b, zn))}
                          </TableCell>
                          <TableCell className="text-right text-sm">{rech?.status ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{offene > 0 ? fmt(offene) : '—'}</TableCell>
                          <TableCell className="text-right print:hidden">
                            {uploadErrors[b.id] && (
                              <p className="text-[10px] text-destructive mb-1">{uploadErrors[b.id]}</p>
                            )}
                            {zn ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-[10px] text-green-700 font-medium">
                                  {zn.stunden_ist != null ? `${zn.stunden_ist} Std.` : 'Parsing fehlgeschlagen'}
                                </span>
                                <button
                                  className="text-[10px] text-muted-foreground hover:underline disabled:opacity-50"
                                  onClick={() => triggerUpload(b.id)}
                                  disabled={uploadingId === b.id}
                                >
                                  {uploadingId === b.id ? 'Lädt…' : 'Ersetzen'}
                                </button>
                              </div>
                            ) : (
                              <button
                                className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
                                onClick={() => triggerUpload(b.id)}
                                disabled={uploadingId === b.id}
                              >
                                <IconUpload className="size-3" />
                                {uploadingId === b.id ? 'Lädt…' : 'Upload'}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="rounded border border-dashed p-6 text-center text-muted-foreground">
                Keine Beauftragungen für diese Filters gefunden.
              </div>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
