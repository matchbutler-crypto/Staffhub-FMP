"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconDotsVertical,
  IconPencil,
  IconPlayerStop,
  IconUser,
  IconUserCheck,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

interface Beauftragung {
  id: string
  profil_id: string | null
  ressource_link_id?: string | null
  ressource_id?: string | null
  is_pool?: boolean
  agentur_id: string
  kandidatenname: string
  erfahrungslevel: string
  vakanz_titel: string
  vakanz_nr?: string | null
  agentur_name: string
  einkaufspreis?: number
  agentur_rohpreis?: number
  marge_inkludiert?: boolean
  margenaufschlag?: number
  verkaufspreis?: number
  marge_prozent?: number
  startdatum: string
  enddatum?: string | null
  stunden_woche: number
  aktiv: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Gibt ein sicheres de-DE Datum zurück oder '–' bei ungültigem Wert */
function fmtDate(value: string | null | undefined): string {
  if (!value) return '–'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '–' : d.toLocaleDateString('de-DE')
}

/** Extrahiert lesbaren Fehlertext aus einer API-Fehlerantwort */
function extractApiError(body: { error?: string; details?: Record<string, string[]> }): string {
  if (body.details) {
    const msgs = Object.entries(body.details)
      .flatMap(([field, errs]) => errs.map((e) => `${field}: ${e}`))
    if (msgs.length > 0) return msgs.join(' · ')
  }
  return body.error ?? 'Unbekannter Fehler'
}

function TableSkeletonRows({ cols = 9, rows = 5 }: { cols?: number; rows?: number }) {
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

export default function BeauftragungPage() {
  const router = useRouter()
  const { user } = useUser()
  const isAgentur = user?.rolle === 'Agentur'
  const isManager = user?.rolle === 'Staffhub Manager' || user?.rolle === 'Admin'

  const [items, setItems] = React.useState<Beauftragung[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [nurAktive, setNurAktive] = React.useState(true)

  // Edit-Dialog
  const [editItem, setEditItem] = React.useState<Beauftragung | null>(null)
  const [editForm, setEditForm] = React.useState({
    agentur_rohpreis: "",
    marge_inkludiert: false,
    margenaufschlag: "75",
    startdatum: "",
    stunden_woche: "",
  })
  const [saving, setSaving] = React.useState(false)

  // Beenden-Dialog
  const [beendenItem, setBeendenItem] = React.useState<Beauftragung | null>(null)
  const [beending, setBeending] = React.useState(false)


  async function load() {
    setLoading(true)
    setError(null)
    try {
      const url = nurAktive ? "/api/beauftragungen" : "/api/beauftragungen?aktiv=false"
      const r = await fetch(url)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${r.status}`)
      }
      const body = await r.json()
      // API gibt jetzt { data, total, page, pageSize } zurück
      const data: Beauftragung[] = Array.isArray(body) ? body : (body.data ?? [])
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [nurAktive])

  function openEdit(b: Beauftragung) {
    setEditItem(b)
    setEditForm({
      agentur_rohpreis: String(b.agentur_rohpreis ?? b.einkaufspreis ?? ""),
      marge_inkludiert: b.marge_inkludiert ?? false,
      margenaufschlag: String(b.margenaufschlag ?? "75"),
      startdatum: b.startdatum,
      stunden_woche: String(b.stunden_woche),
    })
  }

  async function handleSave() {
    if (!editItem) return
    const rohpreis = parseFloat(editForm.agentur_rohpreis)
    const mg = parseFloat(editForm.margenaufschlag || "75")
    const stunden = parseInt(editForm.stunden_woche)
    const margeInkludiert = editForm.marge_inkludiert

    if (isNaN(rohpreis) || rohpreis <= 0) { toast.error("Agentur-Preis ungültig."); return }
    if (isNaN(mg) || mg < 0) { toast.error("Margenaufschlag ungültig."); return }
    if (margeInkludiert && rohpreis <= mg) { toast.error("Rohpreis muss größer als Marge sein."); return }
    if (isNaN(stunden) || stunden < 1 || stunden > 168) { toast.error("Stunden/Woche ungültig."); return }
    if (!editForm.startdatum) { toast.error("Startdatum fehlt."); return }

    setSaving(true)
    try {
      const r = await fetch(`/api/beauftragungen/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentur_rohpreis: rohpreis, marge_inkludiert: margeInkludiert, margenaufschlag: mg, startdatum: editForm.startdatum, stunden_woche: stunden }),
      })
      if (!r.ok) {
        const b = await r.json().catch(() => ({}))
        toast.error(extractApiError(b))
        return
      }
      toast.success("Beauftragung aktualisiert.")
      setEditItem(null)
      load()
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setSaving(false)
    }
  }

  async function handleBeenden() {
    if (!beendenItem) return
    setBeending(true)
    try {
      const r = await fetch(`/api/beauftragungen/${beendenItem.id}/beenden`, { method: "PATCH" })
      if (!r.ok) {
        const b = await r.json().catch(() => ({}))
        toast.error(b.error ?? "Fehler beim Beenden.")
        return
      }
      toast.success(`Beauftragung von ${beendenItem.kandidatenname} beendet.`)
      setBeendenItem(null)
      load()
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setBeending(false)
    }
  }

  const aktiveCount = items.filter((b) => b.aktiv).length

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Beauftragungen" />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

            {/* Header */}
            <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Beauftragungen</h2>
                <p className="text-sm text-muted-foreground">
                  {loading ? "Lädt…" : `${aktiveCount} aktiv · ${items.length} gesamt`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={nurAktive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNurAktive(true)}
                >
                  Aktive
                </Button>
                <Button
                  variant={!nurAktive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNurAktive(false)}
                >
                  Alle
                </Button>
              </div>
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
                      <TableHead>Kandidat</TableHead>
                      {isManager && <TableHead>Agentur</TableHead>}
                      <TableHead>Vakanz</TableHead>
                      <TableHead className="text-right">{isManager ? "EK/Tag" : "Tagesrate"}</TableHead>
                      {isManager && <TableHead className="text-right">Marge</TableHead>}
                      {isManager && <TableHead className="text-right">Hays Fee</TableHead>}
                      {isManager && <TableHead className="text-right">Gesamt</TableHead>}
                      <TableHead>Start</TableHead>
                      <TableHead>Ende</TableHead>
                      <TableHead>Status</TableHead>
                      {isManager && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableSkeletonRows cols={isManager ? 11 : 6} />
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isManager ? 11 : 6} className="h-32 text-center text-muted-foreground">
                          <IconUserCheck className="mx-auto mb-2 size-8 opacity-30" />
                          Keine Beauftragungen gefunden.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((b) => {
                        const ek = b.einkaufspreis ?? 0
                        const marge = b.margenaufschlag ?? 0
                        const haysFee = Math.round((ek + marge) * 0.0134 * 100) / 100
                        const gesamt = ek + marge + haysFee
                        const fmtEur = (v: number) => v > 0 ? `${v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €` : '–'
                        return (
                        <TableRow key={b.id} className={b.aktiv ? "" : "opacity-50"}>
                          <TableCell className="font-medium">
                            {b.is_pool ? (
                              <span>{b.kandidatenname}</span>
                            ) : (
                              <Link href={`/profile/${b.profil_id}`} className="hover:underline">
                                {b.kandidatenname}
                              </Link>
                            )}
                          </TableCell>
                          {isManager && <TableCell className="text-sm">{b.agentur_name}</TableCell>}
                          <TableCell className="text-sm">
                            <span className="font-medium">{b.vakanz_nr ?? b.vakanz_titel}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">{fmtEur(ek)}</TableCell>
                          {isManager && <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">{fmtEur(marge)}</TableCell>}
                          {isManager && <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">{fmtEur(haysFee)}</TableCell>}
                          {isManager && <TableCell className="text-right tabular-nums text-sm whitespace-nowrap font-medium">{fmtEur(gesamt)}</TableCell>}
                          <TableCell className="text-sm whitespace-nowrap">
                            {fmtDate(b.startdatum)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {fmtDate(b.enddatum)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={b.aktiv ? "default" : "secondary"} className="text-xs">
                              {b.aktiv ? "Aktiv" : "Beendet"}
                            </Badge>
                          </TableCell>
                          {isManager && (
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <IconDotsVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {b.is_pool && b.ressource_id && (
                                    <>
                                      <DropdownMenuItem onClick={() => router.push(`/ressourcen/${b.ressource_id}`)}>
                                        <IconUser className="mr-2 size-4" />
                                        Zur Ressource
                                      </DropdownMenuItem>
                                      {b.aktiv && <DropdownMenuSeparator />}
                                    </>
                                  )}
                                  {b.aktiv && (
                                    <>
                                      <DropdownMenuItem onClick={() => openEdit(b)}>
                                        <IconPencil className="mr-2 size-4" />
                                        Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setBeendenItem(b)}
                                      >
                                        <IconPlayerStop className="mr-2 size-4" />
                                        Beauftragung beenden
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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

      {/* ── Edit-Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!saving && !o) setEditItem(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Beauftragung bearbeiten</DialogTitle>
            <DialogDescription>
              {editItem?.kandidatenname} · {editItem?.agentur_name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-rohpreis">Agentur-Preis (€ / Tag)</Label>
              <Input
                id="edit-rohpreis"
                type="number"
                min={0}
                step={1}
                value={editForm.agentur_rohpreis}
                onChange={(e) => setEditForm((f) => ({ ...f, agentur_rohpreis: e.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-mg">Marge (€ / Tag)</Label>
              <Input
                id="edit-mg"
                type="number"
                min={0}
                step={1}
                value={editForm.margenaufschlag}
                onChange={(e) => setEditForm((f) => ({ ...f, margenaufschlag: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.marge_inkludiert}
                  onChange={(e) => setEditForm((f) => ({ ...f, marge_inkludiert: e.target.checked }))}
                  className="rounded"
                />
                Marge bereits im Preis enthalten
              </label>
              {editForm.agentur_rohpreis && (() => {
                const rohpreis = parseFloat(editForm.agentur_rohpreis || "0")
                const mg = parseFloat(editForm.margenaufschlag || "75")
                const inkl = editForm.marge_inkludiert
                const ek = inkl ? rohpreis - mg : rohpreis
                const vk = inkl ? rohpreis : rohpreis + mg
                const valid = ek > 0
                return (
                  <div className={`mt-1 rounded border px-3 py-2 text-xs ${valid ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/10"}`}>
                    <div className="flex justify-between"><span className="text-muted-foreground">EK:</span><span>{valid ? `${ek.toLocaleString("de-DE")} €` : "–"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Marge:</span><span>{mg.toLocaleString("de-DE")} €</span></div>
                    <div className="flex justify-between font-medium"><span>VK:</span><span>{valid ? `${vk.toLocaleString("de-DE")} €` : "–"}</span></div>
                    {!valid && <p className="mt-1 text-destructive">Rohpreis muss größer als Marge sein.</p>}
                  </div>
                )
              })()}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-start">Startdatum</Label>
              <Input
                id="e-start" type="date"
                value={editForm.startdatum}
                onChange={(e) => setEditForm((f) => ({ ...f, startdatum: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="e-stunden">Stunden / Woche</Label>
              <Input
                id="e-stunden" type="number" min={1} max={168} step={1}
                value={editForm.stunden_woche}
                onChange={(e) => setEditForm((f) => ({ ...f, stunden_woche: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setEditItem(null)}>
              Abbrechen
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Beenden-Bestätigung ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!beendenItem} onOpenChange={(o) => { if (!beending && !o) setBeendenItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beauftragung beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Beauftragung von{" "}
              <span className="font-semibold text-foreground">{beendenItem?.kandidatenname}</span>{" "}
              ({beendenItem?.agentur_name}) wird auf inaktiv gesetzt. Diese Aktion kann nicht
              rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={beending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={beending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBeenden}
            >
              {beending ? "Wird beendet…" : "Beauftragung beenden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </SidebarProvider>
  )
}
