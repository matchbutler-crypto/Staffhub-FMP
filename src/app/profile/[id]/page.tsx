"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useUser } from "@/context/user-context"
import {
  IconArrowLeft,
  IconBrain,
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconMessage,
  IconRefresh,
  IconSend,
  IconTrash,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { type KandidatenProfil, type ProfilStatus } from "@/components/profil-einreichen-sheet"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"

// ── Types ──────────────────────────────────────────────────────────────────────

interface KiBewertung {
  id: string
  score: number
  empfehlung: string
  begruendung: string
  skill_vorhanden: string[]
  skill_fehlend: string[]
  model: string
  created_at: string
}

interface Kommentar {
  id: string
  autor_id: string
  autor_rolle: string
  text: string
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ProfilStatus[] = [
  "Eingereicht",
  "In Prüfung",
  "Präsentiert",
  "Interview",
  "Beauftragt",
  "Abgelehnt",
  "Archiviert",
]

const statusColors: Record<ProfilStatus, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Archiviert: "bg-gray-100 text-gray-600 border-gray-200",
}

const rolleLabel: Record<string, string> = {
  "Staffhub Manager": "Manager",
  Admin: "Admin",
  Agentur: "Agentur",
}

function KommentarBubble({ k }: { k: Kommentar }) {
  const isManager = k.autor_rolle === "Staffhub Manager" || k.autor_rolle === "Admin"
  return (
    <div className={`flex flex-col gap-1 ${isManager ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isManager
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {k.text}
      </div>
      <span className="text-xs text-muted-foreground">
        {rolleLabel[k.autor_rolle] ?? k.autor_rolle} ·{" "}
        {new Date(k.created_at).toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const isManager = user?.rolle === 'Admin' || user?.rolle === 'Staffhub Manager'

  const [profil, setProfil] = React.useState<(KandidatenProfil & { agentur_name?: string }) | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [kommentare, setKommentare] = React.useState<Kommentar[]>([])
  const [kommentarText, setKommentarText] = React.useState("")
  const [sendingKommentar, setSendingKommentar] = React.useState(false)
  const [updatingStatus, setUpdatingStatus] = React.useState(false)
  const [downloadingCv, setDownloadingCv] = React.useState(false)
  const [kiBewertung, setKiBewertung] = React.useState<KiBewertung | null>(null)
  const [triggeringKi, setTriggeringKi] = React.useState(false)
  const [kiExpanded, setKiExpanded] = React.useState(false)
  const kommentarEndRef = React.useRef<HTMLDivElement>(null)

  // Beauftragung-Dialog
  const [beauftragungDialog, setBeauftragungDialog] = React.useState(false)
  const [beauftragungForm, setBeauftragungForm] = React.useState({
    agentur_rohpreis: "",
    marge_inkludiert: false,
    margenaufschlag: "75",
    startdatum: "",
    stunden_woche: "",
  })
  const [savingBeauftragung, setSavingBeauftragung] = React.useState(false)
  const [deleteDialog, setDeleteDialog] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  async function fetchProfil() {
    try {
      const res = await fetch(`/api/profile/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProfil(data)
    } catch {
      toast.error("Profil konnte nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  async function fetchKommentare() {
    try {
      const res = await fetch(`/api/profile/${id}/kommentare`)
      if (res.ok) {
        const data = await res.json()
        setKommentare(data)
      }
    } catch {
      // silent
    }
  }

  async function fetchKiBewertung() {
    try {
      const res = await fetch(`/api/profile/${id}/ki-bewertung`)
      if (res.ok) {
        const data = await res.json()
        setKiBewertung(data.bewertung ?? null)
      }
    } catch {
      // silent
    }
  }

  async function handleTriggerKi() {
    setTriggeringKi(true)
    try {
      const res = await fetch(`/api/profile/${id}/ki-bewertung`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "KI-Bewertung fehlgeschlagen.")
        return
      }
      const data = await res.json()
      setKiBewertung(data.bewertung)
      setProfil((p) => p ? { ...p, ki_score: data.bewertung.score } : p)
      setKiExpanded(true)
      toast.success("KI-Bewertung abgeschlossen.")
    } catch {
      toast.error("Ollama nicht erreichbar.")
    } finally {
      setTriggeringKi(false)
    }
  }

  React.useEffect(() => {
    fetchProfil()
    fetchKommentare()
    fetchKiBewertung()
  }, [id])

  React.useEffect(() => {
    kommentarEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [kommentare])

  async function handleStatusChange(newStatus: ProfilStatus) {
    if (!profil) return
    // Beauftragung-Dialog öffnen statt direkt Status setzen
    if (newStatus === "Beauftragt") {
      setBeauftragungForm({ agentur_rohpreis: "", marge_inkludiert: false, margenaufschlag: "75", startdatum: "", stunden_woche: "" })
      setBeauftragungDialog(true)
      return
    }
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/profile/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Fehler beim Aktualisieren des Status.")
        return
      }
      setProfil((p) => p ? { ...p, status: newStatus } : p)
      toast.success(`Status auf „${newStatus}" geändert.`)
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleBeauftragungSubmit() {
    if (!profil) return
    const rohpreis = parseFloat(beauftragungForm.agentur_rohpreis)
    const mg = parseFloat(beauftragungForm.margenaufschlag || "75")
    const stunden = parseInt(beauftragungForm.stunden_woche)
    const margeInkludiert = beauftragungForm.marge_inkludiert

    if (isNaN(rohpreis) || rohpreis <= 0) { toast.error("Agentur-Preis ungültig."); return }
    if (isNaN(mg) || mg < 0) { toast.error("Margenaufschlag ungültig."); return }
    if (margeInkludiert && rohpreis <= mg) { toast.error("Rohpreis muss größer als Marge sein."); return }
    if (isNaN(stunden) || stunden < 1 || stunden > 168) { toast.error("Stunden/Woche: Wert zwischen 1 und 168."); return }
    if (!beauftragungForm.startdatum) { toast.error("Startdatum ist erforderlich."); return }

    setSavingBeauftragung(true)
    try {
      // 1. Status auf "Beauftragt" setzen
      const statusRes = await fetch(`/api/profile/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Beauftragt" }),
      })
      if (!statusRes.ok) {
        const b = await statusRes.json().catch(() => ({}))
        toast.error(b.error ?? "Fehler beim Status-Update.")
        return
      }

      // 2. Beauftragung anlegen
      const bRes = await fetch("/api/beauftragungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profil_id: id,
          agentur_id: profil.agentur_id,
          agentur_rohpreis: rohpreis,
          marge_inkludiert: margeInkludiert,
          margenaufschlag: mg,
          startdatum: beauftragungForm.startdatum,
          stunden_woche: stunden,
        }),
      })
      if (!bRes.ok) {
        const b = await bRes.json().catch(() => ({}))
        toast.error(b.error ?? "Fehler beim Anlegen der Beauftragung.")
        return
      }

      setProfil((p) => p ? { ...p, status: "Beauftragt" } : p)
      setBeauftragungDialog(false)
      toast.success("Beauftragung angelegt und Status gesetzt.")
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setSavingBeauftragung(false)
    }
  }

  async function handleSendKommentar() {
    if (!kommentarText.trim()) return
    setSendingKommentar(true)
    try {
      const res = await fetch(`/api/profile/${id}/kommentare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: kommentarText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Fehler beim Senden.")
        return
      }
      setKommentarText("")
      await fetchKommentare()
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setSendingKommentar(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/profile/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Fehler beim Löschen.")
        return
      }
      toast.success("Profil gelöscht.")
      router.back()
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setDeleting(false)
      setDeleteDialog(false)
    }
  }

  async function handleCvDownload() {
    if (!profil?.cv_pfad) return
    setDownloadingCv(true)
    try {
      const res = await fetch(`/api/profile/${id}/cv`)
      if (!res.ok) {
        toast.error("CV konnte nicht geladen werden.")
        return
      }
      const { url } = await res.json()
      window.open(url, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setDownloadingCv(false)
    }
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Profil-Detail" />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">

            {/* Zurück-Button */}
            <div>
              <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
                <IconArrowLeft className="mr-1 size-4" />
                Zurück
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : !profil ? (
              <p className="text-muted-foreground">Profil nicht gefunden.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

                {/* ── Linke Spalte: Profildaten ── */}
                <div className="space-y-6">

                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold">{profil.kandidatenname}</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {profil.vakanz_titel ?? "–"} · {profil.erfahrungslevel}
                        {profil.agentur_name && ` · ${profil.agentur_name}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Eingereicht am {new Date(profil.created_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {profil.cv_pfad && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingCv}
                          onClick={handleCvDownload}
                        >
                          <IconDownload className="mr-1.5 size-4" />
                          Lebenslauf
                        </Button>
                      )}
                      {isManager && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                          onClick={() => setDeleteDialog(true)}
                        >
                          <IconTrash className="mr-1.5 size-4" />
                          Löschen
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Status + KI-Score */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                      <Select
                        value={profil.status}
                        onValueChange={(v) => handleStatusChange(v as ProfilStatus)}
                        disabled={updatingStatus}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[s]}`}>
                                {s}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {profil.ki_score !== null && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KI-Score</p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-semibold ${
                          profil.ki_score >= 70
                            ? "bg-green-100 text-green-700 border-green-200"
                            : profil.ki_score >= 40
                            ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }`}>
                          {profil.ki_score} / 100
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Profil-Details */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Verfügbarkeit</p>
                      <p className="text-sm">{profil.verfuegbarkeit_stunden} Std/Woche</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Verfügbar ab</p>
                      <p className="text-sm">{new Date(profil.verfuegbar_ab).toLocaleDateString("de-DE")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tagessatz</p>
                      <p className="text-sm">{profil.verkaufspreis.toLocaleString("de-DE")} €/Tag</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Erfahrungslevel</p>
                      <p className="text-sm">{profil.erfahrungslevel}</p>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profil.skills.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Profiltext */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Profiltext</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{profil.profiltext}</p>
                  </div>

                  {/* KI-Bewertung */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconBrain className="size-4 text-muted-foreground" />
                        <p className="text-sm font-medium">KI-Bewertung</p>
                        {kiBewertung && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            kiBewertung.score >= 70
                              ? "bg-green-100 text-green-700 border-green-200"
                              : kiBewertung.score >= 40
                              ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }`}>
                            {kiBewertung.score}/100
                          </span>
                        )}
                        {kiBewertung && (
                          <span className="text-xs text-muted-foreground">{kiBewertung.empfehlung}</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={triggeringKi}
                        onClick={handleTriggerKi}
                        className="gap-1.5"
                      >
                        <IconRefresh className={`size-3.5 ${triggeringKi ? "animate-spin" : ""}`} />
                        {triggeringKi ? "Läuft…" : kiBewertung ? "Neu bewerten" : "Bewerten"}
                      </Button>
                    </div>

                    {kiBewertung ? (
                      <>
                        <p className="text-sm text-muted-foreground">{kiBewertung.begruendung}</p>
                        <button
                          className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer"
                          onClick={() => setKiExpanded((v) => !v)}
                        >
                          {kiExpanded ? "Details ausblenden" : "Skill-Coverage anzeigen"}
                        </button>
                        {kiExpanded && (
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">Vorhanden</p>
                              <div className="flex flex-wrap gap-1">
                                {kiBewertung.skill_vorhanden.length > 0
                                  ? kiBewertung.skill_vorhanden.map((s) => (
                                    <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
                                      <IconCircleCheck className="size-3" />{s}
                                    </span>
                                  ))
                                  : <span className="text-xs text-muted-foreground">–</span>
                                }
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-red-700 mb-1">Fehlend</p>
                              <div className="flex flex-wrap gap-1">
                                {kiBewertung.skill_fehlend.length > 0
                                  ? kiBewertung.skill_fehlend.map((s) => (
                                    <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700">
                                      <IconCircleX className="size-3" />{s}
                                    </span>
                                  ))
                                  : <span className="text-xs text-muted-foreground">–</span>
                                }
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Bewertet mit {kiBewertung.model} · {new Date(kiBewertung.created_at).toLocaleDateString("de-DE")}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Noch keine KI-Bewertung. Klicke „Bewerten" um Ollama zu starten.
                      </p>
                    )}
                  </div>

                  {/* Kommentar Agentur */}
                  {profil.kommentar_agentur && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Kommentar der Agentur</p>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{profil.kommentar_agentur}</p>
                    </div>
                  )}
                </div>

                {/* ── Rechte Spalte: Kommentar-Thread ── */}
                <div className="flex flex-col rounded-lg border">
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    <IconMessage className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Kommentare ({kommentare.length})</h3>
                  </div>

                  {/* Kommentar-Liste */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[240px] max-h-[480px]">
                    {kommentare.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">
                        Noch keine Kommentare.
                      </p>
                    ) : (
                      kommentare.map((k) => <KommentarBubble key={k.id} k={k} />)
                    )}
                    <div ref={kommentarEndRef} />
                  </div>

                  {/* Kommentar-Eingabe */}
                  <div className="border-t p-3 space-y-2">
                    <Textarea
                      rows={2}
                      placeholder="Kommentar schreiben…"
                      value={kommentarText}
                      onChange={(e) => setKommentarText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleSendKommentar()
                        }
                      }}
                      className="resize-none text-sm"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!kommentarText.trim() || sendingKommentar}
                      onClick={handleSendKommentar}
                    >
                      <IconSend className="mr-1.5 size-3.5" />
                      {sendingKommentar ? "Wird gesendet…" : "Senden"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Cmd+Enter zum Senden
                    </p>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ── Beauftragung-Dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={beauftragungDialog}
        onOpenChange={(open) => { if (!savingBeauftragung) setBeauftragungDialog(open) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Beauftragung anlegen</DialogTitle>
            <DialogDescription>
              Preise und Einsatzdetails für{" "}
              <span className="font-medium text-foreground">
                {profil?.kandidatenname ?? "Kandidat"}
              </span>{" "}
              eintragen. Der Status wird automatisch auf „Beauftragt" gesetzt.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="b-rohpreis">Agentur-Preis (€ / Tag)</Label>
              <Input
                id="b-rohpreis"
                type="number"
                min={0}
                step={1}
                placeholder="z.B. 600"
                value={beauftragungForm.agentur_rohpreis}
                onChange={(e) =>
                  setBeauftragungForm((f) => ({ ...f, agentur_rohpreis: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="b-mg">Marge (€ / Tag)</Label>
              <Input
                id="b-mg"
                type="number"
                min={0}
                step={1}
                placeholder="z.B. 75"
                value={beauftragungForm.margenaufschlag}
                onChange={(e) =>
                  setBeauftragungForm((f) => ({ ...f, margenaufschlag: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={beauftragungForm.marge_inkludiert}
                  onChange={(e) =>
                    setBeauftragungForm((f) => ({ ...f, marge_inkludiert: e.target.checked }))
                  }
                  className="rounded"
                />
                Marge bereits im Preis enthalten
              </label>
              {beauftragungForm.agentur_rohpreis && (() => {
                const rohpreis = parseFloat(beauftragungForm.agentur_rohpreis || "0")
                const mg = parseFloat(beauftragungForm.margenaufschlag || "75")
                const inkl = beauftragungForm.marge_inkludiert
                const ek = inkl ? rohpreis - mg : rohpreis
                const vk = inkl ? rohpreis : rohpreis + mg
                const valid = ek > 0
                return (
                  <div className={`mt-1 rounded border px-3 py-2 text-xs ${valid ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/10"}`}>
                    <div className="flex justify-between"><span className="text-muted-foreground">EK (an Agentur):</span><span>{valid ? `${ek.toLocaleString("de-DE")} €` : "–"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Staffhub-Marge:</span><span>{mg.toLocaleString("de-DE")} €</span></div>
                    <div className="flex justify-between font-medium"><span>VK (an Kunden):</span><span>{valid ? `${vk.toLocaleString("de-DE")} €` : "–"}</span></div>
                    {!valid && <p className="mt-1 text-destructive">Rohpreis muss größer als Marge sein.</p>}
                  </div>
                )
              })()}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="b-start">Startdatum</Label>
              <Input
                id="b-start"
                type="date"
                value={beauftragungForm.startdatum}
                onChange={(e) =>
                  setBeauftragungForm((f) => ({ ...f, startdatum: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="b-stunden">Stunden / Woche</Label>
              <Input
                id="b-stunden"
                type="number"
                min={1}
                max={168}
                step={1}
                placeholder="z.B. 40"
                value={beauftragungForm.stunden_woche}
                onChange={(e) =>
                  setBeauftragungForm((f) => ({ ...f, stunden_woche: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingBeauftragung}
              onClick={() => setBeauftragungDialog(false)}
            >
              Abbrechen
            </Button>
            <Button disabled={savingBeauftragung} onClick={handleBeauftragungSubmit}>
              {savingBeauftragung ? "Wird gespeichert…" : "Beauftragung anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Löschen-Dialog ─────────────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialog} onOpenChange={(open) => { if (!deleting) setDeleteDialog(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Profil löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{profil?.kandidatenname ?? "Dieses Profil"}</strong> wird dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Wird gelöscht…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </SidebarProvider>
  )
}
