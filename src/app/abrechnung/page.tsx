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
  IconDotsVertical,
  IconCheck,
} from "@tabler/icons-react"
import { toast } from "sonner"

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Beauftragung {
  id: string
  profil_id: string
  agentur_id: string
  agentur_name: string
  kandidatenname: string
  erfahrungslevel: string
  vakanz_titel: string
  vakanz_nr?: string | null
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
  tage_ist_override?: number | null
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

function calcTageIst(zn: Zeitnachweis | undefined): number {
  if (!zn) return 0
  if (zn.tage_ist_override !== null && zn.tage_ist_override !== undefined) return zn.tage_ist_override
  if (zn.stunden_ist !== null && zn.stunden_ist !== undefined) return Math.round(zn.stunden_ist / 8)
  return 0
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
  const [sortColumn, setSortColumn] = React.useState<string>("Ressource")
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")

  // Upload state
  const [uploadingId, setUploadingId] = React.useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = React.useState<Record<string, string>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const uploadTargetRef = React.useRef<{ beauftragungId: string; monat: string } | null>(null)

  // IST-Tage Dialog state
  const [editTageDialogOpen, setEditTageDialogOpen] = React.useState(false)
  const [editTageZn, setEditTageZn] = React.useState<Zeitnachweis | null>(null)
  const [editTageBeauf, setEditTageBeauf] = React.useState<Beauftragung | null>(null)
  const [editTageValue, setEditTageValue] = React.useState<string>("")
  const [savingTage, setSavingTage] = React.useState(false)

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

  const isFinancial = rolle === 'Staffhub Manager' || rolle === 'Admin'
  const isController = rolle === 'Controller'

  const monatLabel = monate.find((m) => m.value === monat)?.label ?? monat

  // Filtered + sorted data
  let filtered = gefiltert.filter((b) => filterAgentur === 'Alle' || b.agentur_id === filterAgentur)

  filtered.sort((a, b) => {
    let aVal: string | number = ''
    let bVal: string | number = ''

    switch (sortColumn) {
      case 'Ressource':
        aVal = a.kandidatenname
        bVal = b.kandidatenname
        break
      case 'Marge/Tag':
        aVal = a.margenaufschlag ?? 0
        bVal = b.margenaufschlag ?? 0
        break
      case 'Gesamtbetrag (Forecast)':
        aVal = (a.margenaufschlag ?? 0) * 20
        bVal = (b.margenaufschlag ?? 0) * 20
        break
      case 'Gesamtbetrag (IST)':
        aVal = (a.margenaufschlag ?? 0) * calcTageIst(zeitnachweise.get(a.id))
        bVal = (b.margenaufschlag ?? 0) * calcTageIst(zeitnachweise.get(b.id))
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

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
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

    setUploadingId(target.beauftragungId)
    setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: '' }))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('beauftragung_id', target.beauftragungId)
    formData.append('monat', target.monat)

    try {
      const res = await fetch('/api/zeitnachweise', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        throw new Error(err.error ?? 'Fehler beim Upload')
      }
      const { zeitnachweis } = await res.json()
      setZeitnachweise((prev) => new Map(prev).set(target.beauftragungId, zeitnachweis))
      toast.success('Zeitnachweis hochgeladen')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Upload'
      setUploadErrors((prev) => ({ ...prev, [target.beauftragungId]: msg }))
      toast.error(msg)
    } finally {
      setUploadingId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function openEditTageDialog(beauftragung: Beauftragung, zeitnachweis: Zeitnachweis) {
    setEditTageZn(zeitnachweis)
    setEditTageBeauf(beauftragung)
    setEditTageValue(String(calcTageIst(zeitnachweis)))
    setEditTageDialogOpen(true)
  }

  async function saveEditTage() {
    if (!editTageZn) return
    const value = parseInt(editTageValue, 10)
    if (isNaN(value) || value < 0) {
      toast.error('Bitte geben Sie eine gültige Zahl ein')
      return
    }

    setSavingTage(true)
    try {
      const res = await fetch(`/api/zeitnachweise/${editTageZn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tage_ist_override: value }),
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      const { zeitnachweis } = await res.json()
      setZeitnachweise((prev) => new Map(prev).set(editTageZn.beauftragung_id, zeitnachweis))
      toast.success('Tage aktualisiert')
      setEditTageDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setSavingTage(false)
    }
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Abrechnung" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* ── Filter Bar ──────────────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-4 px-4 lg:px-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Monat:</label>
                  <select
                    value={monat}
                    onChange={(e) => setMonat(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {monate.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Agentur:</label>
                  <select
                    value={filterAgentur}
                    onChange={(e) => setFilterAgentur(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="Alle">Alle</option>
                    {Array.from(new Set(beauftragungen.map((b) => b.agentur_id))).map((id) => {
                      const b = beauftragungen.find((x) => x.agentur_id === id)
                      return (
                        <option key={id} value={id}>{b?.agentur_name ?? '–'}</option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* ── Error ───────────────────────────────────────────────────── */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler beim Laden: {error}
                </div>
              )}

              {/* ── Table ───────────────────────────────────────────────────── */}
              <div className="overflow-x-auto px-4 lg:px-6">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('Ressource')}>
                        <div className="flex items-center gap-2">
                          Ressource
                          <SortIcon column="Ressource" active={sortColumn === 'Ressource'} direction={sortDirection} />
                        </div>
                      </TableHead>
                      <TableHead>Agentur</TableHead>
                      <TableHead>Vakanz</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('Marge/Tag')}>
                        <div className="flex items-center justify-end gap-2">
                          Marge/Tag
                          <SortIcon column="Marge/Tag" active={sortColumn === 'Marge/Tag'} direction={sortDirection} />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Tage (Forecast)</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('Gesamtbetrag (Forecast)')}>
                        <div className="flex items-center justify-end gap-2">
                          Gesamtbetrag (Forecast)
                          <SortIcon column="Gesamtbetrag (Forecast)" active={sortColumn === 'Gesamtbetrag (Forecast)'} direction={sortDirection} />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Tage (IST)</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort('Gesamtbetrag (IST)')}>
                        <div className="flex items-center justify-end gap-2">
                          Gesamtbetrag (IST)
                          <SortIcon column="Gesamtbetrag (IST)" active={sortColumn === 'Gesamtbetrag (IST)'} direction={sortDirection} />
                        </div>
                      </TableHead>
                      <TableHead>Zeitnachweis</TableHead>
                      {isFinancial && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableSkeletonRows cols={isFinancial ? 10 : 9} />
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isFinancial ? 10 : 9} className="h-32 text-center text-muted-foreground">
                          Keine Beauftragungen für diesen Monat
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((b) => {
                        const zn = zeitnachweise.get(b.id)
                        const tageIst = calcTageIst(zn)
                        const margeTg = b.margenaufschlag ?? 0
                        const gesamtForecast = margeTg * 20
                        const gesamtIst = zn ? margeTg * tageIst : null

                        return (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium">{b.kandidatenname}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{b.agentur_name}</TableCell>
                            <TableCell className="text-sm max-w-[180px]">
                              {b.vakanz_nr && (
                                <span className="font-mono text-[11px] text-muted-foreground mr-1.5">{b.vakanz_nr}</span>
                              )}
                              <span className="text-muted-foreground truncate">{b.vakanz_titel}</span>
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmt(margeTg)}</TableCell>
                            <TableCell className="text-right text-sm">20</TableCell>
                            <TableCell className="text-right text-sm">{fmt(gesamtForecast)}</TableCell>
                            <TableCell className="text-right text-sm">
                              {zn ? tageIst : '–'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {gesamtIst !== null ? fmt(gesamtIst) : '–'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {uploadErrors[b.id] && (
                                <span className="text-xs text-destructive">{uploadErrors[b.id]}</span>
                              )}
                              {!zn ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => triggerUpload(b.id)}
                                  disabled={uploadingId === b.id}
                                  className="gap-1.5"
                                >
                                  <IconUpload className="h-3.5 w-3.5" />
                                  {uploadingId === b.id ? '…' : 'Upload'}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {zn.stunden_ist} h
                                </span>
                              )}
                            </TableCell>
                            {isFinancial && (
                              <TableCell>
                                {zn ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                        <IconDotsVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditTageDialog(b, zn)}>
                                        Tage anpassen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : null}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

            </div>
          </div>
        </div>
      </SidebarInset>

      {/* ── Tage (IST) Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={editTageDialogOpen} onOpenChange={setEditTageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tage (IST) anpassen</DialogTitle>
          </DialogHeader>
          {editTageBeauf && editTageZn && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{editTageBeauf.kandidatenname}</span>
                  {' '} – {editTageBeauf.vakanz_titel}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tage-input">Tage (IST)</Label>
                <Input
                  id="tage-input"
                  type="number"
                  min="0"
                  value={editTageValue}
                  onChange={(e) => setEditTageValue(e.target.value)}
                  placeholder="z.B. 15"
                  disabled={savingTage}
                />
                <p className="text-xs text-muted-foreground">
                  Automatisch berechnet: {Math.round((editTageZn.stunden_ist ?? 0) / 8)} Tage
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTageDialogOpen(false)} disabled={savingTage}>
              Abbrechen
            </Button>
            <Button onClick={saveEditTage} disabled={savingTage} className="gap-1.5">
              {savingTage ? '…' : <IconCheck className="h-4 w-4" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hidden File Input ──────────────────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </SidebarProvider>
  )
}
