"use client"

import * as React from "react"
import {
  IconBrandSlack,
  IconCheck,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

interface SlackLogEntry {
  id: string
  vakanz_id: string | null
  vakanz_titel: string | null
  post_type: "detail" | "update"
  workspace: string
  channel: string
  status: "success" | "error"
  error_msg: string | null
  posted_by: string | null
  posted_by_name: string | null
  posted_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const workspaceLabels: Record<string, string> = {
  freelance: "Freelance",
  partner: "Partner",
}

const channelLabels: Record<string, string> = {
  testing: "Testing",
  germany: "Germany",
  global: "Global",
}

function ChannelBadge({ workspace, channel }: { workspace: string; channel: string }) {
  const channelColor: Record<string, string> = {
    testing: "bg-yellow-100 text-yellow-700 border-yellow-200",
    germany: "bg-blue-100 text-blue-700 border-blue-200",
    global: "bg-purple-100 text-purple-700 border-purple-200",
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted-foreground">
        {workspaceLabels[workspace] ?? workspace}
      </span>
      <span className="text-muted-foreground/40">→</span>
      <span
        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${channelColor[channel] ?? "bg-muted text-muted-foreground border-border"}`}
      >
        {channelLabels[channel] ?? channel}
      </span>
    </div>
  )
}

function PostTypeBadge({ type }: { type: "detail" | "update" }) {
  return type === "detail" ? (
    <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
      <IconBrandSlack className="size-3" />
      Detailpost
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
      <IconRefresh className="size-3" />
      Updatepost
    </span>
  )
}

function StatusBadge({ status, errorMsg }: { status: "success" | "error"; errorMsg: string | null }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <IconCheck className="size-3" />
        Erfolgreich
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <IconX className="size-3" />
        Fehler
      </span>
      {errorMsg && (
        <span className="max-w-[200px] truncate text-[10px] text-red-500" title={errorMsg}>
          {errorMsg}
        </span>
      )}
    </div>
  )
}

// ── SlackLogPage ───────────────────────────────────────────────────────────────

export default function SlackLogPage() {
  const { user } = useUser()

  const [logs, setLogs] = React.useState<SlackLogEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  async function fetchLogs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/slack/logs")
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
    fetchLogs()
  }, [])

  const isManagerOrAdmin =
    user?.rolle === "Admin" || user?.rolle === "Staffhub Manager"

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Slack Posting-Log" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Slack Posting-Log</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading
                      ? "Lädt…"
                      : `${logs.length} Einträge — neueste zuerst`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchLogs}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <IconRefresh className={`size-4 ${loading ? "animate-spin" : ""}`} />
                  Aktualisieren
                </Button>
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
                        <TableHead className="w-40">Datum / Uhrzeit</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gepostet von</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <>
                          {Array.from({ length: 6 }).map((_, i) => (
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
                          <TableCell
                            colSpan={6}
                            className="h-32 text-center text-muted-foreground"
                          >
                            Noch keine Slack-Posts gesendet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log) => (
                          <TableRow
                            key={log.id}
                            className={
                              log.status === "error"
                                ? "bg-red-50/60 hover:bg-red-50"
                                : undefined
                            }
                          >
                            {/* Datum */}
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(log.posted_at).toLocaleString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>

                            {/* Typ */}
                            <TableCell>
                              <PostTypeBadge type={log.post_type} />
                            </TableCell>

                            {/* Channel */}
                            <TableCell>
                              <ChannelBadge
                                workspace={log.workspace}
                                channel={log.channel}
                              />
                            </TableCell>

                            {/* Vakanz */}
                            <TableCell className="text-sm">
                              {log.vakanz_titel ? (
                                <span className="font-medium">{log.vakanz_titel}</span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  Alle Vakanzen
                                </span>
                              )}
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <StatusBadge
                                status={log.status}
                                errorMsg={log.error_msg}
                              />
                            </TableCell>

                            {/* Gepostet von */}
                            <TableCell className="text-sm text-muted-foreground">
                              {log.posted_by_name ?? "–"}
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
