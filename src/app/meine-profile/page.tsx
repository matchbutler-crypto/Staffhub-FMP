"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  IconEdit,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { ProfilEinreichenSheet, type KandidatenProfil, type ProfilStatus } from "@/components/profil-einreichen-sheet"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

export default function MeineProfilePage() {
  const [profile, setProfile] = React.useState<KandidatenProfil[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("alle")

  // Edit Sheet
  const [editSheetOpen, setEditSheetOpen] = React.useState(false)
  const [editingProfil, setEditingProfil] = React.useState<KandidatenProfil | null>(null)

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingProfil, setDeletingProfil] = React.useState<KandidatenProfil | null>(null)
  const [deleting, setDeleting] = React.useState(false)

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

  async function handleProfilSuccess(newProfilId?: string) {
    await fetchProfile()
    // KI-Bewertung asynchron triggern (fire-and-forget)
    if (newProfilId) {
      fetch(`/api/profile/${newProfilId}/ki-bewertung`, { method: "POST" }).catch(() => {})
    }
  }

  React.useEffect(() => {
    fetchProfile()
  }, [])

  async function handleDelete() {
    if (!deletingProfil) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/profile/${deletingProfil.id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? "Fehler beim Zurückziehen.")
        return
      }
      toast.success("Profil zurückgezogen.")
      setDeleteDialogOpen(false)
      fetchProfile()
    } catch {
      toast.error("Verbindungsfehler.")
    } finally {
      setDeleting(false)
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
        <SiteHeader title="Meine Profile" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Meine Profile</h2>
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
                        <TableHead>Vakanz</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">KI-Score</TableHead>
                        <TableHead>Eingereicht</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={6} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            {profile.length === 0
                              ? "Noch keine Profile eingereicht. Gehen Sie zu Vakanzen und reichen Sie Ihr erstes Profil ein."
                              : "Keine Profile gefunden."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((p) => {
                          const canEdit = p.status === "Eingereicht"
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.kandidatenname}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {p.vakanz_titel ?? "–"}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[p.status]}`}
                                >
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
                                <div className="flex items-center gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7"
                                          disabled={!canEdit}
                                          onClick={() => {
                                            setEditingProfil(p)
                                            setEditSheetOpen(true)
                                          }}
                                        >
                                          <IconEdit className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      {!canEdit && (
                                        <TooltipContent>
                                          Bearbeiten nur bei Status „Eingereicht" möglich
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7 text-destructive hover:text-destructive"
                                          disabled={!canEdit}
                                          onClick={() => {
                                            setDeletingProfil(p)
                                            setDeleteDialogOpen(true)
                                          }}
                                        >
                                          <IconTrash className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      {!canEdit && (
                                        <TooltipContent>
                                          Zurückziehen nur bei Status „Eingereicht" möglich
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
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
        </div>
      </SidebarInset>

      {/* Edit Sheet */}
      {editingProfil && (
        <ProfilEinreichenSheet
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          vakanzId={editingProfil.vakanz_id}
          vakanzTitel={editingProfil.vakanz_titel ?? ""}
          editProfil={editingProfil}
          onSuccess={handleProfilSuccess}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Profil zurückziehen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Profil von <strong>{deletingProfil?.kandidatenname}</strong> wird unwiderruflich
              gelöscht — inkl. dem hochgeladenen Lebenslauf. Diese Aktion kann nicht rückgängig
              gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Wird gelöscht…" : "Profil zurückziehen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
