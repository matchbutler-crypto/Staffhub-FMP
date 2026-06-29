"use client"

import * as React from "react"
import {
  IconRefresh,
  IconActivity,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface RessourceRef {
  id: string
  name: string
  ressource_code: string
}

interface VakanzRef {
  id: string
  titel: string
  vakanz_nr: string | null
}

interface LogEntry {
  id: string
  text: string
  typ: "system" | "manuell"
  created_at: string
  source: "ressource" | "vakanz"
  profiles: { id: string; name: string; rolle: string } | null
  // ressource
  link_id?: string | null
  ressource_id?: string | null
  ressourcen?: RessourceRef | null
  // vakanz
  vakanz_id?: string | null
  vakanzen_data?: VakanzRef | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function RolleBadge({ rolle }: { rolle: string }) {
  const colors: Record<string, string> = {
    "Agentur": "bg-purple-50 text-purple-700 border-purple-200",
    "Staffhub Manager": "bg-blue-50 text-blue-700 border-blue-200",
    "Admin": "bg-orange-50 text-orange-700 border-orange-200",
    "Controller": "bg-gray-50 text-gray-700 border-gray-200",
  }
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${colors[rolle] ?? "bg-muted text-muted-foreground border-border"}`}>
      {rolle}
    </span>
  )
}

function TypBadge({ typ }: { typ: "system" | "manuell" }) {
  if (typ === "manuell") {
    return (
      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
        Manuell
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500">
      System
    </span>
  )
}

// ── AdminLogsPage ──────────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  const { user } = useUser()

  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rolleFilter, setRolleFilter] = React.useState("alle")

  async function fetchLogs(rolle: string) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (rolle !== "alle") params.set("rolle", rolle)
      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setLogs(data.logs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logs konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (user?.rolle === "Admin") {
      fetchLogs(rolleFilter)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function handleRolleChange(value: string) {
    setRolleFilter(value)
    fetchLogs(value)
  }

  if (user && user.rolle !== "Admin") {
    return (
      <SidebarProvider
        style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader title="Aktivitäts-Log" />
          <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
            Keine Berechtigung
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Aktivitäts-Log" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Aktivitäts-Log</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading
                      ? "Lädt…"
                      : `${logs.length} Einträge — neueste zuerst`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={rolleFilter} onValueChange={handleRolleChange}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Alle Rollen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Rollen</SelectItem>
                      <SelectItem value="Agentur">Agentur</SelectItem>
                      <SelectItem value="Staffhub Manager">Staffhub Manager</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchLogs(rolleFilter)}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <IconRefresh className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    Aktualisieren
                  </Button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler: {error}
                </div>
              )}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-36">Datum / Uhrzeit</TableHead>
                        <TableHead className="w-32">Benutzer</TableHead>
                        <TableHead className="w-28">Rolle</TableHead>
                        <TableHead className="w-20">Typ</TableHead>
                        <TableHead>Aktivität</TableHead>
                        <TableHead className="w-36">Referenz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <>
                          {Array.from({ length: 8 }).map((_, i) => (
                            <TableRow key={i}>
                              {Array.from({ length: 6 }).map((_, j) => (
                                <TableCell key={j}>
                                  <Skeleton className="h-4 w-full" />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </>
                      ) : logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                              <IconActivity className="size-8 opacity-30" />
                              Keine Einträge gefunden.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log) => (
                          <TableRow key={log.id}>
                            {/* Datum */}
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>

                            {/* Benutzer */}
                            <TableCell className="text-sm font-medium">
                              {log.profiles?.name ?? (
                                <span className="text-muted-foreground italic">System</span>
                              )}
                            </TableCell>

                            {/* Rolle */}
                            <TableCell>
                              {log.profiles?.rolle ? (
                                <RolleBadge rolle={log.profiles.rolle} />
                              ) : (
                                <span className="text-xs text-muted-foreground">–</span>
                              )}
                            </TableCell>

                            {/* Typ */}
                            <TableCell>
                              <TypBadge typ={log.typ} />
                            </TableCell>

                            {/* Aktivität */}
                            <TableCell className="text-sm">
                              {log.text}
                            </TableCell>

                            {/* Referenz */}
                            <TableCell className="text-sm">
                              {log.source === 'vakanz' && log.vakanzen_data ? (
                                <a
                                  href={`/vakanzen/${log.vakanz_id}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {log.vakanzen_data.vakanz_nr
                                    ? `${log.vakanzen_data.vakanz_nr} — ${log.vakanzen_data.titel}`
                                    : log.vakanzen_data.titel}
                                </a>
                              ) : log.ressourcen ? (
                                <a
                                  href={`/ressourcen/${log.ressource_id}`}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {log.ressourcen.ressource_code
                                    ? `${log.ressourcen.ressource_code} — ${log.ressourcen.name}`
                                    : log.ressourcen.name}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">–</span>
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
