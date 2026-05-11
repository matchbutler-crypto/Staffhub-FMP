"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  IconBulb,
  IconMessageCircle,
  IconPlus,
  IconThumbUp,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useUser } from "@/context/user-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Idee {
  id: string
  titel: string
  beschreibung: string
  kategorie: string
  status: string
  ersteller_rolle: string
  created_at: string
  ersteller: { name: string; rolle: string } | null
  kommentare_count: { count: number }[]
  upvotes_count: { count: number }[]
  user_upvoted: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function IdeaCard({ idee, onUpvote }: { idee: Idee; onUpvote: (id: string) => void }) {
  const kommentare = idee.kommentare_count?.[0]?.count ?? 0
  const upvotes = idee.upvotes_count?.[0]?.count ?? 0
  return (
    <Link href={`/ideen/${idee.id}`} className="block">
      <div className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm leading-snug">{idee.titel}</h3>
          <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_COLORS[idee.status] ?? ''}`}>
            {idee.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{idee.beschreibung}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${KATEGORIE_COLORS[idee.kategorie] ?? ''}`}>
              {idee.kategorie}
            </Badge>
            <span>{idee.ersteller?.name ?? '–'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.preventDefault(); onUpvote(idee.id) }}
              className={`flex items-center gap-1 transition-colors hover:text-primary ${idee.user_upvoted ? 'text-primary font-medium' : ''}`}
            >
              <IconThumbUp className={`size-3.5 ${idee.user_upvoted ? 'fill-primary' : ''}`} />
              {upvotes}
            </button>
            <span className="flex items-center gap-1">
              <IconMessageCircle className="size-3.5" />
              {kommentare}
            </span>
            <span>{formatDate(idee.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function IdeaCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export default function IdeenPage() {
  const { user } = useUser()
  const [ideen, setIdeen] = React.useState<Idee[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<string>('manager')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({ titel: '', beschreibung: '', kategorie: 'Sonstiges' })

  const isAdmin = user?.rolle === 'Admin'
  const canSubmit = user?.rolle === 'Staffhub Manager' || user?.rolle === 'Agentur'

  async function loadIdeen(rolleFilter?: string) {
    setLoading(true)
    try {
      const url = rolleFilter ? `/api/ideen?rolle=${rolleFilter}` : '/api/ideen'
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`
        toast.error(`Ideen konnten nicht geladen werden: ${msg}`)
        setIdeen([])
        return
      }
      const data = await res.json()
      setIdeen(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (!user) return
    if (isAdmin) {
      loadIdeen(activeTab)
    } else {
      loadIdeen()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab])

  async function handleUpvote(ideeId: string) {
    setIdeen(prev => prev.map(i => i.id === ideeId ? {
      ...i,
      user_upvoted: !i.user_upvoted,
      upvotes_count: [{ count: (i.upvotes_count?.[0]?.count ?? 0) + (i.user_upvoted ? -1 : 1) }],
    } : i))
    try {
      await fetch(`/api/ideen/${ideeId}/upvote`, { method: 'POST' })
    } catch {
      loadIdeen(isAdmin ? activeTab : undefined)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/ideen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`
        toast.error(`Fehler beim Einreichen: ${msg}`)
        return
      }
      toast.success('Idee eingereicht')
      setDialogOpen(false)
      setForm({ titel: '', beschreibung: '', kategorie: 'Sonstiges' })
      loadIdeen(isAdmin ? activeTab : undefined)
    } catch (err) {
      toast.error(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <div className="space-y-4">
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <IdeaCardSkeleton key={i} />)
        : ideen.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <IconBulb className="size-10 opacity-30" />
            <p className="text-sm">Noch keine Ideen vorhanden.</p>
          </div>
        )
        : ideen.map((idee) => <IdeaCard key={idee.id} idee={idee} onUpvote={handleUpvote} />)
      }
    </div>
  )

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Ideen-Board</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isAdmin
                  ? 'Alle eingereichten Ideen von Managern und Agenturen'
                  : 'Ideen einreichen und mit anderen diskutieren'}
              </p>
            </div>
            {canSubmit && (
              <Button onClick={() => setDialogOpen(true)}>
                <IconPlus className="size-4 mr-2" />
                Neue Idee
              </Button>
            )}
          </div>

          {/* Content — Admin sieht Tabs, andere direkt */}
          {isAdmin ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="manager">Staffhub Manager</TabsTrigger>
                <TabsTrigger value="agentur">Agenturen</TabsTrigger>
              </TabsList>
              <TabsContent value="manager" className="mt-4">{content}</TabsContent>
              <TabsContent value="agentur" className="mt-4">{content}</TabsContent>
            </Tabs>
          ) : content}
        </div>

        {/* Dialog: Neue Idee */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) document.body.style.pointerEvents = ''
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Idee einreichen</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="titel">Titel</Label>
                <Input
                  id="titel"
                  placeholder="Kurzer, prägnanter Titel"
                  value={form.titel}
                  onChange={(e) => setForm(f => ({ ...f, titel: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="beschreibung">Beschreibung</Label>
                <Textarea
                  id="beschreibung"
                  placeholder="Was soll verbessert werden? Warum ist das sinnvoll?"
                  rows={4}
                  value={form.beschreibung}
                  onChange={(e) => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Select value={form.kategorie} onValueChange={(v) => setForm(f => ({ ...f, kategorie: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feature">Feature</SelectItem>
                    <SelectItem value="Verbesserung">Verbesserung</SelectItem>
                    <SelectItem value="Bug">Bug</SelectItem>
                    <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Einreichen…' : 'Einreichen'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
