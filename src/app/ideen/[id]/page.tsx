"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconSend,
  IconThumbUp,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useUser } from "@/context/user-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Kommentar {
  id: string
  text: string
  created_at: string
  autor: { id: string; name: string; rolle: string } | null
}

interface IdeaDetail {
  id: string
  titel: string
  beschreibung: string
  kategorie: string
  status: string
  ersteller_rolle: string
  ersteller_id: string
  created_at: string
  ersteller: { name: string; rolle: string } | null
  kommentare: Kommentar[]
  upvotes_count: { count: number }[]
  user_upvoted: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Offen', 'In Prüfung', 'Umgesetzt', 'Abgelehnt'] as const

const STATUS_COLORS: Record<string, string> = {
  'Offen': 'bg-blue-100 text-blue-700 border-blue-200',
  'In Prüfung': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Umgesetzt': 'bg-green-100 text-green-700 border-green-200',
  'Abgelehnt': 'bg-red-100 text-red-700 border-red-200',
}

const KATEGORIE_COLORS: Record<string, string> = {
  'Feature': 'bg-purple-100 text-purple-700 border-purple-200',
  'Verbesserung': 'bg-orange-100 text-orange-700 border-orange-200',
  'Bug': 'bg-red-100 text-red-700 border-red-200',
  'Sonstiges': 'bg-gray-100 text-gray-600 border-gray-200',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function KommentarBubble({ k, currentUserId }: { k: Kommentar; currentUserId: string }) {
  const isOwn = k.autor?.id === currentUserId
  const isAdmin = k.autor?.rolle === 'Admin'
  return (
    <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-muted-foreground px-1">
        {k.autor?.name ?? '–'}{isAdmin ? ' · Admin' : ''}
      </span>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
        isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
      }`}>
        {k.text}
      </div>
      <span className="text-xs text-muted-foreground px-1">{formatDateTime(k.created_at)}</span>
    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const [idea, setIdea] = React.useState<IdeaDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [kommentarText, setKommentarText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [statusUpdating, setStatusUpdating] = React.useState(false)
  const kommentarEndRef = React.useRef<HTMLDivElement>(null)

  const isAdmin = user?.rolle === 'Admin'

  async function loadIdea() {
    try {
      const res = await fetch(`/api/ideen/${id}`)
      if (!res.ok) throw new Error()
      setIdea(await res.json())
    } catch {
      toast.error('Idee nicht gefunden')
      router.push('/ideen')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (id) loadIdea()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  React.useEffect(() => {
    kommentarEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [idea?.kommentare.length])

  async function handleKommentar(e: React.FormEvent) {
    e.preventDefault()
    if (!kommentarText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/ideen/${id}/kommentare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: kommentarText.trim() }),
      })
      if (!res.ok) throw new Error()
      const neuerKommentar = await res.json()
      setIdea(prev => prev ? { ...prev, kommentare: [...prev.kommentare, neuerKommentar] } : prev)
      setKommentarText('')
    } catch {
      toast.error('Kommentar konnte nicht gespeichert werden')
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/ideen/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setIdea(prev => prev ? { ...prev, status: newStatus } : prev)
      toast.success(`Status auf "${newStatus}" gesetzt`)
    } catch {
      toast.error('Status konnte nicht geändert werden')
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleUpvote() {
    if (!idea) return
    const wasUpvoted = idea.user_upvoted
    setIdea(prev => prev ? {
      ...prev,
      user_upvoted: !wasUpvoted,
      upvotes_count: [{ count: (prev.upvotes_count?.[0]?.count ?? 0) + (wasUpvoted ? -1 : 1) }],
    } : prev)
    try {
      await fetch(`/api/ideen/${id}/upvote`, { method: 'POST' })
    } catch {
      loadIdea()
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
          <Button variant="ghost" className="w-fit -ml-2" onClick={() => router.push('/ideen')}>
            <IconArrowLeft className="size-4 mr-1" />
            Zurück
          </Button>

          {loading || !idea ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              {/* Idee-Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-semibold leading-snug">{idea.titel}</h1>
                  {isAdmin ? (
                    <Select
                      value={idea.status}
                      onValueChange={handleStatusChange}
                      disabled={statusUpdating}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={`shrink-0 ${STATUS_COLORS[idea.status] ?? ''}`}>
                      {idea.status}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${KATEGORIE_COLORS[idea.kategorie] ?? ''}`}>
                      {idea.kategorie}
                    </Badge>
                    <span>von {idea.ersteller?.name ?? '–'}</span>
                    <span>·</span>
                    <span>{formatDateTime(idea.created_at)}</span>
                  </div>
                  <button
                    onClick={handleUpvote}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors text-sm ${
                      idea.user_upvoted
                        ? 'border-primary text-primary bg-primary/5 font-medium'
                        : 'border-border hover:border-primary hover:text-primary'
                    }`}
                  >
                    <IconThumbUp className={`size-4 ${idea.user_upvoted ? 'fill-primary' : ''}`} />
                    {idea.upvotes_count?.[0]?.count ?? 0}
                  </button>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {idea.beschreibung}
                </p>
              </div>

              <Separator />

              {/* Kommentare */}
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Kommentare ({idea.kommentare.length})
                </h2>
                <div className="space-y-4 min-h-[80px]">
                  {idea.kommentare.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Noch keine Kommentare — schreib den ersten!
                    </p>
                  ) : (
                    idea.kommentare.map(k => (
                      <KommentarBubble key={k.id} k={k} currentUserId={user?.id ?? ''} />
                    ))
                  )}
                  <div ref={kommentarEndRef} />
                </div>
              </div>

              {/* Kommentar eingeben */}
              <form onSubmit={handleKommentar} className="flex gap-2 items-end">
                <Textarea
                  placeholder="Kommentar schreiben…"
                  rows={2}
                  className="flex-1 resize-none"
                  value={kommentarText}
                  onChange={e => setKommentarText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleKommentar(e as unknown as React.FormEvent)
                    }
                  }}
                />
                <Button type="submit" size="icon" disabled={sending || !kommentarText.trim()}>
                  <IconSend className="size-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
