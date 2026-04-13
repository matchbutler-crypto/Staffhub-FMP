"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  IconDownload,
  IconSearch,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { type KandidatenProfil, type ProfilStatus } from "@/components/profil-einreichen-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusColors: Record<ProfilStatus, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Archiviert: "bg-gray-100 text-gray-600 border-gray-200",
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">–</span>
  const color =
    score >= 70
      ? "bg-green-100 text-green-700 border-green-200"
      : score >= 40
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-red-100 text-red-700 border-red-200"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<KandidatenProfil[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("alle")

  async function fetchProfile() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/profile")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProfile(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchProfile()
  }, [])

  async function handleCvDownload(profilId: string, kandidatenname: string) {
    setDownloadingId(profilId)
    try {
      const res = await fetch(`/api/profile/${profilId}/cv`)
      if (!res.ok) {
        toast.error("CV konnte nicht geladen werden.")
        return
      }
      const { url } = await res.json()
      // Open signed URL in new tab
      window.open(url, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Verbindungsfehler beim CV-Download.")
    } finally {
      setDownloadingId(null)
    }
  }

  const filtered = profile.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.kandidatenname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.vakanz_titel ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === "alle" || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Profile" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Alle Profile</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Lädt…" : `${filtered.length} Profile`}
                  </p>
                </div>
              </div>

              {/* Filter */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Kandidat oder Vakanz suchen…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Status</SelectItem>
                    <SelectItem value="Eingereicht">Eingereicht</SelectItem>
                    <SelectItem value="In Prüfung">In Prüfung</SelectItem>
                    <SelectItem value="Präsentiert">Präsentiert</SelectItem>
                    <SelectItem value="Interview">Interview</SelectItem>
                    <SelectItem value="Beauftragt">Beauftragt</SelectItem>
                    <SelectItem value="Abgelehnt">Abgelehnt</SelectItem>
                    <SelectItem value="Archiviert">Archiviert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler beim Laden: {error}
                </div>
              )}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Kandidat</TableHead>
                        <TableHead>Agentur</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">KI-Score</TableHead>
                        <TableHead>Eingereicht</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={8} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                            {profile.length === 0
                              ? "Noch keine Profile eingereicht."
                              : "Keine Profile gefunden."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.kandidatenname}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {/* agentur_name wird in PROJ-3 Backend via JOIN geliefert */}
                              {(p as KandidatenProfil & { agentur_name?: string }).agentur_name ?? "–"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {p.vakanz_titel ?? "–"}
                            </TableCell>
                            <TableCell className="text-sm">{p.erfahrungslevel}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[p.status]}`}>
                                {p.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <ScoreBadge score={p.ki_score} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(p.created_at).toLocaleDateString("de-DE")}
                            </TableCell>
                            <TableCell>
                              {p.cv_pfad && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  disabled={downloadingId === p.id}
                                  onClick={() => handleCvDownload(p.id, p.kandidatenname)}
                                  title="Lebenslauf herunterladen"
                                >
                                  <IconDownload className="size-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
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
