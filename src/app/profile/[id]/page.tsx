"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconDownload,
  IconMessage,
  IconSend,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { type KandidatenProfil, type ProfilStatus } from "@/components/profil-einreichen-sheet"
import { Button } from "@/components/ui/button"
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

  const [profil, setProfil] = React.useState<(KandidatenProfil & { agentur_name?: string }) | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [kommentare, setKommentare] = React.useState<Kommentar[]>([])
  const [kommentarText, setKommentarText] = React.useState("")
  const [sendingKommentar, setSendingKommentar] = React.useState(false)
  const [updatingStatus, setUpdatingStatus] = React.useState(false)
  const [downloadingCv, setDownloadingCv] = React.useState(false)
  const kommentarEndRef = React.useRef<HTMLDivElement>(null)

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

  React.useEffect(() => {
    fetchProfil()
    fetchKommentare()
  }, [id])

  React.useEffect(() => {
    kommentarEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [kommentare])

  async function handleStatusChange(newStatus: ProfilStatus) {
    if (!profil) return
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
    </SidebarProvider>
  )
}
