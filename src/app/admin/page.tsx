"use client"

import * as React from "react"
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconUserOff,
  IconUserCheck,
  IconShield,
  IconTrash,
  IconKey,
  IconCopy,
  IconCheck,
  IconToggleRight,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"
import { toast } from "sonner"

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FEATURE_KEYS, FEATURE_META, type FeatureKey } from "@/lib/features"

// ── Types ──────────────────────────────────────────────────────────────────────

type Rolle = "Admin" | "Staffhub Manager" | "Controller" | "Agentur"

interface Agentur {
  id: string
  name: string
  kontakt_email: string
  user_anzahl: number
  created_at: string
  features: Record<string, boolean>
  agency_webhook_url: string | null
}

interface User {
  id: string
  name: string
  email: string
  rolle: Rolle
  aktiv: boolean
  agentur_id: string | null
  agenturen: { name: string } | null
}

type ApiPermission =
  | 'vakanzen:read'
  | 'vakanzen:create'
  | 'vakanzen:update'
  | 'vorschlaege:read'
  | 'vorschlaege:update'
  | 'profile:read'
  | 'demand:write'
  | 'supply:read'
  | 'supply:write'
  | 'agency:positions:read'
  | 'agency:profiles:read'
  | 'agency:profiles:write'

interface ApiKey {
  id: string
  name: string
  key_preview: string
  permissions: ApiPermission[]
  aktiv: boolean
  last_used_at: string | null
  created_at: string
}

const PERMISSION_LABELS: Record<ApiPermission, string> = {
  'vakanzen:read': 'Vakanzen lesen',
  'vakanzen:create': 'Vakanz erstellen',
  'vakanzen:update': 'Vakanz aktualisieren',
  'vorschlaege:read': 'Vorschläge lesen',
  'vorschlaege:update': 'Vorschlag-Status setzen',
  'profile:read': 'Profile lesen',
  'demand:write': 'Vakanzen schreiben (MagentaOS)',
  'supply:read': 'Kandidaten-Profile lesen',
  'supply:write': 'Kandidaten reservieren/buchen',
  'agency:positions:read': 'Positionen lesen',
  'agency:profiles:read': 'Eigene Profile lesen',
  'agency:profiles:write': 'Profile anlegen & einreichen',
}

const ALL_PERMISSIONS: ApiPermission[] = [
  'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
  'vorschlaege:read', 'vorschlaege:update', 'profile:read',
  'demand:write', 'supply:read', 'supply:write',
  'agency:positions:read', 'agency:profiles:read', 'agency:profiles:write',
]

const LAYER_PERMISSIONS: Record<'demand' | 'supply' | 'agency', ApiPermission[]> = {
  demand: ['vakanzen:read', 'vakanzen:create', 'vakanzen:update', 'vorschlaege:read', 'vorschlaege:update', 'demand:write'],
  supply: ['profile:read', 'supply:read', 'supply:write'],
  agency: ['agency:positions:read', 'agency:profiles:read', 'agency:profiles:write'],
}

// ── Color maps ─────────────────────────────────────────────────────────────────

const rolleColors: Record<Rolle, string> = {
  Admin: "bg-red-100 text-red-700 border-red-200",
  "Staffhub Manager": "bg-blue-100 text-blue-700 border-blue-200",
  Controller: "bg-green-100 text-green-700 border-green-200",
  Agentur: "bg-purple-100 text-purple-700 border-purple-200",
}

// ── TableSkeletonRows ──────────────────────────────────────────────────────────

function TableSkeletonRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
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

// ── NeuerBenutzerSheet ─────────────────────────────────────────────────────────

interface NeuerBenutzerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agenturen: Agentur[]
  onSuccess: () => void
}

function NeuerBenutzerSheet({
  open,
  onOpenChange,
  agenturen,
  onSuccess,
}: NeuerBenutzerSheetProps) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [rolle, setRolle] = React.useState<string>("")
  const [agenturId, setAgenturId] = React.useState<string>("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPassword(""); setRolle(""); setAgenturId(""); setError(null)
    }
  }, [open])

  async function handleSubmit() {
    if (!name || !email || !password || !rolle) { setError("Bitte alle Pflichtfelder ausfüllen."); return }
    if (rolle === "Agentur" && !agenturId) { setError("Bitte eine Agentur auswählen."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, rolle, agentur_id: agenturId || null }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Anlegen") }
      toast.success(`Benutzer „${name}" wurde angelegt`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[440px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Neuen Benutzer anlegen</SheetTitle>
          <SheetDescription>Legen Sie einen neuen Benutzer an und weisen Sie eine Rolle zu.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-name">Name *</Label>
              <Input id="b-name" placeholder="Vor- und Nachname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-email">E-Mail *</Label>
              <Input id="b-email" type="email" placeholder="name@beispiel.de" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-rolle">Rolle *</Label>
              <Select value={rolle} onValueChange={setRolle}>
                <SelectTrigger id="b-rolle"><SelectValue placeholder="Rolle wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Staffhub Manager">Staffhub Manager</SelectItem>
                  <SelectItem value="Controller">Controller</SelectItem>
                  <SelectItem value="Agentur">Agentur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rolle === "Agentur" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-agentur">Agentur *</Label>
                <Select value={agenturId} onValueChange={setAgenturId}>
                  <SelectTrigger id="b-agentur"><SelectValue placeholder="Agentur wählen…" /></SelectTrigger>
                  <SelectContent>
                    {agenturen.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-passwort">Temporäres Passwort *</Label>
              <Input id="b-passwort" type="password" placeholder="Mindestens 8 Zeichen" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">Der Benutzer kann sein Passwort unter Einstellungen ändern.</p>
            </div>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Anlegen…" : "Benutzer erstellen"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── BenutzerBearbeitenSheet ────────────────────────────────────────────────────

interface BenutzerBearbeitenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  agenturen: Agentur[]
  onSuccess: () => void
}

function BenutzerBearbeitenSheet({ open, onOpenChange, user, agenturen, onSuccess }: BenutzerBearbeitenSheetProps) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [rolle, setRolle] = React.useState<string>("")
  const [agenturId, setAgenturId] = React.useState<string>("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && user) {
      setName(user.name)
      setEmail(user.email)
      setPassword("")
      setRolle(user.rolle)
      setAgenturId(user.agentur_id ?? "")
      setError(null)
    }
  }, [open, user])

  async function handleSubmit() {
    if (!name || !email || !rolle) { setError("Name, E-Mail und Rolle sind Pflichtfelder."); return }
    if (rolle === "Agentur" && !agenturId) { setError("Bitte eine Agentur auswählen."); return }
    if (password && password.length < 8) { setError("Passwort muss mindestens 8 Zeichen haben."); return }
    if (!user) return
    setSaving(true); setError(null)
    try {
      const body: Record<string, unknown> = { name, email, rolle, agentur_id: agenturId || null }
      if (password) body.password = password
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Speichern") }
      toast.success(`Benutzer „${name}" wurde aktualisiert`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[440px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Benutzer bearbeiten</SheetTitle>
          <SheetDescription>Stammdaten, Rolle und Zugangsdaten von <span className="font-medium text-foreground">{user?.name}</span> ändern.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-5">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

            <fieldset className="flex flex-col gap-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Stammdaten</legend>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-name">Name *</Label>
                <Input id="e-name" placeholder="Vor- und Nachname" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-email">E-Mail *</Label>
                <Input id="e-email" type="email" placeholder="name@beispiel.de" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Rolle & Agentur</legend>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-rolle">Rolle *</Label>
                <Select value={rolle} onValueChange={setRolle}>
                  <SelectTrigger id="e-rolle"><SelectValue placeholder="Rolle wählen…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Staffhub Manager">Staffhub Manager</SelectItem>
                    <SelectItem value="Controller">Controller</SelectItem>
                    <SelectItem value="Agentur">Agentur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rolle === "Agentur" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="e-agentur">Agentur *</Label>
                  <Select value={agenturId} onValueChange={setAgenturId}>
                    <SelectTrigger id="e-agentur"><SelectValue placeholder="Agentur wählen…" /></SelectTrigger>
                    <SelectContent>
                      {agenturen.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Passwort zurücksetzen</legend>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-passwort">Neues Passwort</Label>
                <Input id="e-passwort" type="password" placeholder="Leer lassen = kein Wechsel" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">Nur ausfüllen, wenn das Passwort geändert werden soll.</p>
              </div>
            </fieldset>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Speichern…" : "Änderungen speichern"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── NeueAgenturSheet ───────────────────────────────────────────────────────────

interface NeueAgenturSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function NeueAgenturSheet({ open, onOpenChange, onSuccess }: NeueAgenturSheetProps) {
  const [name, setName] = React.useState("")
  const [kontaktEmail, setKontaktEmail] = React.useState("")
  const [features, setFeatures] = React.useState<Record<string, boolean>>({})
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) { setName(""); setKontaktEmail(""); setFeatures({}); setError(null) }
  }, [open])

  async function handleSubmit() {
    if (!name || !kontaktEmail) { setError("Bitte alle Pflichtfelder ausfüllen."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/agenturen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kontakt_email: kontaktEmail, features }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Anlegen") }
      toast.success(`Agentur „${name}" wurde angelegt`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[400px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Neue Agentur anlegen</SheetTitle>
          <SheetDescription>Legen Sie eine neue Agentur an.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-name">Agentur-Name *</Label>
              <Input id="a-name" placeholder="z.B. TechTalents GmbH" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-kontakt">Kontakt-E-Mail *</Label>
              <Input id="a-kontakt" type="email" placeholder="kontakt@agentur.de" value={kontaktEmail} onChange={(e) => setKontaktEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Features freigeben</Label>
              <div className="flex flex-col gap-2">
                {FEATURE_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{FEATURE_META[key].label}</span>
                      <span className="text-xs text-muted-foreground">{FEATURE_META[key].beschreibung}</span>
                    </div>
                    <Switch
                      checked={!!features[key]}
                      onCheckedChange={(checked) =>
                        setFeatures((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Anlegen…" : "Agentur erstellen"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── AgenturBearbeitenSheet ─────────────────────────────────────────────────────

interface AgenturBearbeitenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentur: Agentur | null
  onSuccess: () => void
}

function AgenturBearbeitenSheet({ open, onOpenChange, agentur, onSuccess }: AgenturBearbeitenSheetProps) {
  const [name, setName] = React.useState("")
  const [kontaktEmail, setKontaktEmail] = React.useState("")
  const [webhookUrl, setWebhookUrl] = React.useState("")
  const [webhookAlreadyConfigured, setWebhookAlreadyConfigured] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [newSecret, setNewSecret] = React.useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = React.useState(false)

  React.useEffect(() => {
    if (open && agentur) {
      setName(agentur.name)
      setKontaktEmail(agentur.kontakt_email)
      setWebhookUrl(agentur.agency_webhook_url ?? "")
      setWebhookAlreadyConfigured(!!agentur.agency_webhook_url)
      setError(null)
      setNewSecret(null)
      setCopiedSecret(false)
    }
  }, [open, agentur])

  async function handleSubmit(regenerateSecret = false) {
    if (!name || !kontaktEmail) { setError("Bitte alle Pflichtfelder ausfüllen."); return }
    if (!agentur) return
    setSaving(true); setError(null); setNewSecret(null)
    try {
      const body: Record<string, unknown> = { name, kontakt_email: kontaktEmail }
      const trimmedUrl = webhookUrl.trim()
      if (trimmedUrl !== (agentur.agency_webhook_url ?? "") || regenerateSecret) {
        body.agency_webhook_url = trimmedUrl || null
        if (regenerateSecret) body.regenerate_webhook_secret = true
      }
      const res = await fetch(`/api/admin/agenturen/${agentur.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const details = err.details ? ' — ' + Object.entries(err.details).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ') : ''
        throw new Error((err.error ?? "Fehler beim Speichern") + details)
      }
      const result = await res.json()
      if (result.newSecret) {
        setNewSecret(result.newSecret)
        setWebhookAlreadyConfigured(true)
        setWebhookUrl(webhookUrl.trim())
      } else {
        toast.success(`Agentur „${name}" wurde aktualisiert`)
        onOpenChange(false); onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  async function handleTestWebhook() {
    if (!agentur) return
    setTesting(true)
    try {
      const res = await fetch(`/api/admin/agenturen/${agentur.id}/test-webhook`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.ok) {
        toast.success(`Webhook erreichbar — HTTP ${data.status}`)
      } else {
        toast.error(`Webhook antwortete mit HTTP ${data.status}`)
      }
    } catch (err) {
      toast.error(`Webhook nicht erreichbar: ${err instanceof Error ? err.message : "Fehler"}`)
    } finally { setTesting(false) }
  }

  async function copySecret() {
    if (!newSecret) return
    await navigator.clipboard.writeText(newSecret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  function handleClose() {
    if (newSecret) { onSuccess() }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o) }}>
      <SheetContent side="right" className="flex w-[460px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Agentur bearbeiten</SheetTitle>
          <SheetDescription>Stammdaten und Webhook-Konfiguration für <span className="font-medium text-foreground">{agentur?.name}</span>.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-5">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

            {/* Neues Secret — einmalig anzeigen */}
            {newSecret && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 flex flex-col gap-2">
                <p className="text-sm font-medium text-green-800">Neues Webhook-Secret generiert!</p>
                <p className="text-xs text-green-700">Dieses Secret wird nicht erneut angezeigt. Jetzt kopieren und sicher an die Agentur übermitteln.</p>
                <div className="flex items-center gap-2 rounded border bg-white px-3 py-2 font-mono text-xs break-all">
                  <span className="flex-1 select-all">{newSecret}</span>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copySecret}>
                    {copiedSecret ? <IconCheck className="size-4 text-green-600" /> : <IconCopy className="size-4" />}
                  </Button>
                </div>
              </div>
            )}

            <fieldset className="flex flex-col gap-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Stammdaten</legend>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ae-name">Agentur-Name *</Label>
                <Input id="ae-name" placeholder="z.B. TechTalents GmbH" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ae-kontakt">Kontakt-E-Mail *</Label>
                <Input id="ae-kontakt" type="email" placeholder="kontakt@agentur.de" value={kontaktEmail} onChange={(e) => setKontaktEmail(e.target.value)} />
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Agency API – Webhook</legend>
              <p className="text-xs text-muted-foreground -mt-2">Staffhub sendet Events per POST an diese URL. Das Secret wird automatisch generiert.</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ae-webhook-url">Webhook-URL</Label>
                <Input
                  id="ae-webhook-url"
                  type="url"
                  placeholder="https://agentur.de/webhooks/staffhub"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              {webhookAlreadyConfigured && !newSecret && (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">Webhook-Secret</span>
                    <span className="text-xs text-muted-foreground">Konfiguriert — Secret ist serverseitig gespeichert</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSubmit(true)}
                    disabled={saving}
                  >
                    <IconKey className="size-3 mr-1" />Neu generieren
                  </Button>
                </div>
              )}
              {webhookAlreadyConfigured && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestWebhook}
                  disabled={testing || saving}
                  className="self-start"
                >
                  {testing ? "Sende Ping…" : "Test-Ping senden"}
                </Button>
              )}
            </fieldset>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            {newSecret ? "Schließen" : "Abbrechen"}
          </Button>
          {!newSecret && (
            <Button onClick={() => handleSubmit(false)} disabled={saving}>
              {saving ? "Speichern…" : "Änderungen speichern"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── AgenturLoeschenDialog ──────────────────────────────────────────────────────

interface AgenturLoeschenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentur: Agentur | null
  onSuccess: () => void
}

function AgenturLoeschenDialog({ open, onOpenChange, agentur, onSuccess }: AgenturLoeschenDialogProps) {
  const [loading, setLoading] = React.useState(false)

  async function handleConfirm() {
    if (!agentur) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/agenturen/${agentur.id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Löschen") }
      toast.success(`Agentur „${agentur.name}" gelöscht`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen")
    } finally { setLoading(false) }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Agentur löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {agentur && <><span className="font-medium text-foreground">„{agentur.name}"</span> wird dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? "Löschen…" : "Löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── NeuerApiKeySheet ───────────────────────────────────────────────────────────

interface NeuerApiKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  agenturen: Agentur[]
}

const LAYER_ENDPOINTS: Record<'demand' | 'supply' | 'agency', { method: string; path: string; desc: string }[]> = {
  demand: [
    { method: 'POST',  path: '/demand/v1.0/vakanzen',                                    desc: 'Vakanz anlegen' },
    { method: 'GET',   path: '/demand/v1.0/vakanzen',                                    desc: 'Vakanzen abrufen' },
    { method: 'GET',   path: '/demand/v1.0/vakanzen/{id}',                               desc: 'Vakanz-Details' },
    { method: 'GET',   path: '/demand/v1.0/vakanzen/{id}/vorschlaege',                   desc: 'Vorschläge abrufen' },
    { method: 'PATCH', path: '/demand/v1.0/vakanzen/{id}/vorschlaege/{matchId}',         desc: 'Match-Status setzen' },
  ],
  supply: [
    { method: 'GET',  path: '/supply/v1.0/profiles',                    desc: 'Profile abrufen' },
    { method: 'POST', path: '/supply/v1.0/profiles/{id}/reserve',       desc: 'Profil reservieren' },
    { method: 'POST', path: '/supply/v1.0/profiles/{id}/book',          desc: 'Profil beauftragen' },
    { method: 'POST', path: '/supply/v1.0/profiles/{id}/cancel',        desc: 'Profil ablehnen' },
    { method: 'PATCH', path: '/demand/v1.0/vakanzen/{id}',              desc: 'Vakanz aktualisieren' },
  ],
  agency: [
    { method: 'GET',  path: '/agency/v1.0/positions',                     desc: 'Offene Positionen' },
    { method: 'GET',  path: '/agency/v1.0/positions/{id}',                desc: 'Position-Details' },
    { method: 'GET',  path: '/agency/v1.0/positions/{id}/submissions',    desc: 'Eigene Einreichungen' },
    { method: 'POST', path: '/agency/v1.0/profiles',                      desc: 'Profil anlegen/aktualisieren' },
    { method: 'GET',  path: '/agency/v1.0/profiles',                      desc: 'Eigene Profile' },
    { method: 'PUT',  path: '/agency/v1.0/profiles/{id}',                 desc: 'Profil aktualisieren' },
    { method: 'POST', path: '/agency/v1.0/profiles/{id}/submit',          desc: 'Profil einreichen' },
  ],
}

const BASE_URL = 'https://api.staffhub.digital'

const LAYER_LABELS: Record<'demand' | 'supply' | 'agency', string> = {
  demand: 'Demand-Layer',
  supply: 'Supply-Layer',
  agency: 'Agency-Layer',
}

function buildUebergabeText(keyName: string, key: string, activeLayers: Set<'demand' | 'supply' | 'agency'>, agenturId?: string): string {
  const lines: string[] = [
    `=== Staffhub API – Zugangsdaten für „${keyName}" ===`,
    '',
    `Base-URL : ${BASE_URL}`,
    `API-Key  : ${key}`,
    `Header   : Authorization: Bearer <API-Key>`,
    '',
  ]
  for (const layer of ['demand', 'supply', 'agency'] as const) {
    if (!activeLayers.has(layer)) continue
    lines.push(`--- ${LAYER_LABELS[layer]} ---`)
    for (const ep of LAYER_ENDPOINTS[layer]) {
      lines.push(`${ep.method.padEnd(6)} ${BASE_URL}${ep.path}`)
    }
    lines.push('')
  }
  if (activeLayers.has('agency') && agenturId) {
    lines.push('--- Inbound Webhook (Agentur → Staffhub) ---')
    lines.push(`POST   ${BASE_URL}/webhooks/agency/${agenturId}`)
    lines.push(`Header : Authorization: Bearer <API-Key>`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

function NeuerApiKeySheet({ open, onOpenChange, onSuccess, agenturen }: NeuerApiKeySheetProps) {
  const [name, setName] = React.useState("")
  const [layers, setLayers] = React.useState<Set<'demand' | 'supply' | 'agency'>>(new Set())
  const [agenturId, setAgenturId] = React.useState<string>("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null)
  const [generatedLayers, setGeneratedLayers] = React.useState<Set<'demand' | 'supply' | 'agency'>>(new Set())
  const [copied, setCopied] = React.useState(false)
  const [copiedAll, setCopiedAll] = React.useState(false)

  React.useEffect(() => {
    if (open) { setName(""); setLayers(new Set()); setAgenturId(""); setError(null); setGeneratedKey(null); setGeneratedLayers(new Set()); setCopied(false); setCopiedAll(false) }
  }, [open])

  function toggleLayer(layer: 'demand' | 'supply' | 'agency') {
    setLayers(prev => {
      const next = new Set(prev)
      next.has(layer) ? next.delete(layer) : next.add(layer)
      return next
    })
  }

  function permissionsFromLayers(): ApiPermission[] {
    const perms = new Set<ApiPermission>()
    for (const layer of layers) {
      for (const p of LAYER_PERMISSIONS[layer]) perms.add(p)
    }
    return Array.from(perms)
  }

  async function handleSubmit() {
    if (!name) { setError("Bitte einen Namen eingeben."); return }
    if (layers.size === 0) { setError("Bitte mindestens einen Layer auswählen."); return }
    if (layers.has('agency') && !agenturId) { setError("Bitte eine Agentur für den Agency-Layer auswählen."); return }
    setSaving(true); setError(null)
    try {
      const body: Record<string, unknown> = { name, permissions: permissionsFromLayers() }
      if (layers.has('agency') && agenturId) body.agentur_id = agenturId
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Anlegen") }
      const data = await res.json()
      setGeneratedKey(data.plaintext_key)
      setGeneratedLayers(new Set(layers))
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  async function copyKey() {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyAll() {
    if (!generatedKey) return
    await navigator.clipboard.writeText(buildUebergabeText(name, generatedKey, generatedLayers, agenturId || undefined))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!generatedKey) onOpenChange(o) }}>
      <SheetContent side="right" className="flex w-[520px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Neuen API-Key anlegen</SheetTitle>
          <SheetDescription>Legen Sie einen Key an und wählen Sie den Zugriffs-Layer.</SheetDescription>
        </SheetHeader>

        {generatedKey ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {/* Key-Box */}
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-sm font-medium text-green-800">Key wurde erstellt — bitte jetzt kopieren!</p>
              <p className="mb-3 text-xs text-green-700">Dieser Key wird nicht erneut angezeigt.</p>
              <div className="flex items-center gap-2 rounded border bg-white px-3 py-2 font-mono text-xs break-all">
                <span className="flex-1">{generatedKey}</span>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copyKey}>
                  {copied ? <IconCheck className="size-4 text-green-600" /> : <IconCopy className="size-4" />}
                </Button>
              </div>
            </div>

            {/* Übergabe-Zusammenfassung */}
            <div className="rounded-md border bg-muted/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Übergabe-Info für den Client</p>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyAll}>
                  {copiedAll
                    ? <><IconCheck className="size-3 text-green-600" />Kopiert</>
                    : <><IconCopy className="size-3" />Alles kopieren</>}
                </Button>
              </div>

              {/* Verbindung */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Verbindung</p>
                <div className="rounded-md border bg-background p-3 space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-muted-foreground">Base-URL</span>
                    <span className="text-foreground">{BASE_URL}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-muted-foreground">Header</span>
                    <span className="text-foreground">Authorization: Bearer &lt;API-Key&gt;</span>
                  </div>
                </div>
              </div>

              {/* Endpunkte je Layer */}
              {(['demand', 'supply', 'agency'] as const).filter(l => generatedLayers.has(l)).map(layer => (
                <div key={layer} className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {layer === 'demand' ? 'Demand – Vakanzen & Vorschläge' : layer === 'supply' ? 'Supply – Kandidaten-Profile' : 'Agency – Profile & Positionen'}
                  </p>
                  <div className="rounded-md border bg-background divide-y">
                    {LAYER_ENDPOINTS[layer].map((ep) => (
                      <div key={ep.path} className="flex items-center gap-3 px-3 py-2">
                        <Badge variant="outline" className={`shrink-0 font-mono text-[10px] w-12 justify-center ${
                          ep.method === 'POST'  ? 'bg-blue-100  text-blue-700  border-blue-200'  :
                          ep.method === 'PATCH' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                  'bg-green-100 text-green-700 border-green-200'
                        }`}>{ep.method}</Badge>
                        <span className="flex-1 font-mono text-xs text-muted-foreground truncate">{ep.path}</span>
                        <span className="text-xs text-muted-foreground/70 shrink-0">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Inbound Webhook — nur wenn Agency-Layer aktiv und agenturId bekannt */}
              {generatedLayers.has('agency') && agenturId && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Inbound Webhook (Agentur → Staffhub)
                  </p>
                  <div className="rounded-md border bg-background divide-y">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px] w-12 justify-center bg-blue-100 text-blue-700 border-blue-200">
                        POST
                      </Badge>
                      <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
                        /webhooks/agency/{agenturId}
                      </span>
                      <span className="text-xs text-muted-foreground/70 shrink-0">Profile & Einreichungen pushen</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Header: <span className="font-mono">Authorization: Bearer &lt;API-Key&gt;</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name">Name *</Label>
              <Input id="key-name" placeholder="z.B. Magenta OS – Sandbox" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Zugriffs-Layer *</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['demand', 'supply'] as const).map((layer) => {
                  const active = layers.has(layer)
                  const label = layer === 'demand' ? 'Demand' : 'Supply'
                  const desc = layer === 'demand' ? 'Vakanzen & Vorschläge' : 'Kandidaten-Profile'
                  const perms = LAYER_PERMISSIONS[layer]
                  return (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => toggleLayer(layer)}
                      className={`flex flex-col gap-1.5 rounded-lg border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? 'border-primary bg-accent'
                          : 'border-border bg-background hover:bg-accent/50'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${active ? 'text-foreground' : 'text-foreground'}`}>{label}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {perms.map((p) => (
                          <Badge key={p} variant="outline" className="font-mono text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div
                className={`flex flex-col gap-1.5 rounded-lg border-2 p-4 cursor-pointer transition-colors focus-visible:outline-none ${
                  layers.has('agency')
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-border bg-background hover:bg-accent/50'
                }`}
                onClick={() => toggleLayer('agency')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleLayer('agency')}
              >
                <span className="text-sm font-semibold">Agency</span>
                <span className="text-xs text-muted-foreground">Agentur-Schnittstelle: Profile einreichen, Positionen abrufen</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {LAYER_PERMISSIONS.agency.map((p) => (
                    <Badge key={p} variant="outline" className="font-mono text-[10px]">{p}</Badge>
                  ))}
                </div>
              </div>
              {layers.has('agency') && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="key-agentur">Agentur (Pflicht für Agency-Layer) *</Label>
                  <Select value={agenturId} onValueChange={setAgenturId}>
                    <SelectTrigger id="key-agentur"><SelectValue placeholder="Agentur wählen…" /></SelectTrigger>
                    <SelectContent>
                      {agenturen.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        <SheetFooter className="border-t px-6 py-4">
          {generatedKey ? (
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                <IconKey className="size-4" />{saving ? "Erstellen…" : "Key generieren"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── ApiKeyBearbeitenSheet ──────────────────────────────────────────────────────

interface ApiKeyBearbeitenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ApiKey | null
  onSuccess: () => void
}

function layersFromPermissions(permissions: ApiPermission[]): Set<'demand' | 'supply' | 'agency'> {
  const result = new Set<'demand' | 'supply' | 'agency'>()
  if (LAYER_PERMISSIONS.demand.some(p => permissions.includes(p))) result.add('demand')
  if (LAYER_PERMISSIONS.supply.some(p => permissions.includes(p))) result.add('supply')
  if (LAYER_PERMISSIONS.agency.some(p => permissions.includes(p))) result.add('agency')
  return result
}

function ApiKeyBearbeitenSheet({ open, onOpenChange, apiKey, onSuccess }: ApiKeyBearbeitenSheetProps) {
  const [name, setName] = React.useState("")
  const [layers, setLayers] = React.useState<Set<'demand' | 'supply' | 'agency'>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && apiKey) {
      setName(apiKey.name)
      setLayers(layersFromPermissions(apiKey.permissions))
      setError(null)
    }
  }, [open, apiKey])

  function toggleLayer(layer: 'demand' | 'supply' | 'agency') {
    setLayers(prev => {
      const next = new Set(prev)
      next.has(layer) ? next.delete(layer) : next.add(layer)
      return next
    })
  }

  function permissionsFromLayers(): ApiPermission[] {
    const perms = new Set<ApiPermission>()
    for (const layer of layers) {
      for (const p of LAYER_PERMISSIONS[layer]) perms.add(p)
    }
    return Array.from(perms)
  }

  async function handleSubmit() {
    if (!name) { setError("Name darf nicht leer sein."); return }
    if (layers.size === 0) { setError("Mindestens ein Layer erforderlich."); return }
    if (!apiKey) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: permissionsFromLayers() }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
      toast.success(`Key „${name}" aktualisiert`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>API-Key bearbeiten</SheetTitle>
          <SheetDescription>Name und Layer von <span className="font-medium text-foreground">{apiKey?.name}</span> ändern.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-key-name">Name *</Label>
            <Input id="edit-key-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Zugriffs-Layer *</Label>
            <div className="flex flex-col gap-2">
              {(['demand', 'supply', 'agency'] as const).map((layer) => {
                const active = layers.has(layer)
                const label = layer === 'demand' ? 'Demand' : layer === 'supply' ? 'Supply' : 'Agency'
                const desc = layer === 'demand' ? 'Vakanzen & Vorschläge' : layer === 'supply' ? 'Kandidaten-Profile' : 'Agentur-Schnittstelle'
                const perms = LAYER_PERMISSIONS[layer]
                return (
                  <button
                    key={layer}
                    type="button"
                    onClick={() => toggleLayer(layer)}
                    className={`flex flex-col gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-transparent hover:border-muted-foreground/40'
                    }`}
                  >
                    <span className="font-semibold text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {perms.map((p) => (
                        <span key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{p}</span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Speichern…" : "Änderungen speichern"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── FeatureToggleSheet ─────────────────────────────────────────────────────────

interface FeatureToggleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentur: Agentur | null
  onSuccess: () => void
}

function FeatureToggleSheet({ open, onOpenChange, agentur, onSuccess }: FeatureToggleSheetProps) {
  const [features, setFeatures] = React.useState<Record<string, boolean>>({})
  const [releaseNotes, setReleaseNotes] = React.useState<Record<string, { titel: string; beschreibung: string }>>({})
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [prevFeatures, setPrevFeatures] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (open && agentur) {
      const f = (agentur as Agentur & { features?: Record<string, boolean> }).features ?? {}
      setFeatures(f)
      setPrevFeatures(f)
      setReleaseNotes({})
      setError(null)
    }
  }, [open, agentur])

  function toggleFeature(key: FeatureKey) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    if (!agentur) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/agenturen/${agentur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Fehler beim Speichern')
      }

      // Release Notes für neu aktivierte Features erstellen
      for (const key of FEATURE_KEYS) {
        const wasOff = !prevFeatures[key]
        const isNowOn = features[key]
        const note = releaseNotes[key]
        if (wasOff && isNowOn && note?.titel) {
          const noteRes = await fetch('/api/admin/release-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              feature_key: key,
              titel: note.titel,
              beschreibung: note.beschreibung,
            }),
          })
          if (!noteRes.ok) {
            const noteErr = await noteRes.json().catch(() => ({}))
            toast.error(`Release Note für „${FEATURE_META[key].label}" konnte nicht gespeichert werden: ${noteErr.error ?? 'Fehler'}`)
          }
        }
      }

      toast.success(`Features für „${agentur.name}" gespeichert`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Feature Toggles</SheetTitle>
          <SheetDescription>
            Features für <span className="font-medium text-foreground">{agentur?.name}</span> aktivieren oder deaktivieren.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-6">
            {FEATURE_KEYS.map((key) => {
              const meta = FEATURE_META[key]
              const isOn = !!features[key]
              const wasOff = !prevFeatures[key]
              const newlyActivated = wasOff && isOn
              return (
                <div key={key} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-xs text-muted-foreground">{meta.beschreibung}</span>
                    </div>
                    <Switch
                      checked={isOn}
                      onCheckedChange={() => toggleFeature(key)}
                    />
                  </div>
                  {newlyActivated && (
                    <div className="rounded-md border bg-muted/40 p-3 flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Release Note (optional)</p>
                      <Input
                        placeholder={'Titel z.B. „Mein Pool ist jetzt verfügbar“'}
                        value={releaseNotes[key]?.titel ?? ''}
                        onChange={(e) =>
                          setReleaseNotes((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], titel: e.target.value },
                          }))
                        }
                      />
                      <Textarea
                        placeholder="Kurze Beschreibung…"
                        className="resize-none text-sm"
                        rows={2}
                        value={releaseNotes[key]?.beschreibung ?? ''}
                        onChange={(e) =>
                          setReleaseNotes((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], beschreibung: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <IconToggleRight className="size-4" />
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── AdminPage ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [users, setUsers] = React.useState<User[]>([])
  const [agenturen, setAgenturen] = React.useState<Agentur[]>([])
  const [loadingUsers, setLoadingUsers] = React.useState(true)
  const [loadingAgenturen, setLoadingAgenturen] = React.useState(true)

  // Dialogs/sheets
  const [benutzerSheetOpen, setBenutzerSheetOpen] = React.useState(false)
  const [benutzerEditOpen, setBenutzerEditOpen] = React.useState(false)
  const [benutzerEditUser, setBenutzerEditUser] = React.useState<User | null>(null)
  const [agenturSheetOpen, setAgenturSheetOpen] = React.useState(false)
  const [agenturEditOpen, setAgenturEditOpen] = React.useState(false)
  const [agenturEditTarget, setAgenturEditTarget] = React.useState<Agentur | null>(null)
  const [loeschenOpen, setLoeschenOpen] = React.useState(false)
  const [loeschenAgentur, setLoeschenAgentur] = React.useState<Agentur | null>(null)
  const [userLoeschenOpen, setUserLoeschenOpen] = React.useState(false)
  const [userLoeschen, setUserLoeschen] = React.useState<User | null>(null)
  const [userLoeschenLoading, setUserLoeschenLoading] = React.useState(false)

  const [featureToggleOpen, setFeatureToggleOpen] = React.useState(false)
  const [featureToggleAgentur, setFeatureToggleAgentur] = React.useState<Agentur | null>(null)

  const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = React.useState(true)
  const [apiKeySheetOpen, setApiKeySheetOpen] = React.useState(false)
  const [apiKeyEditOpen, setApiKeyEditOpen] = React.useState(false)
  const [apiKeyEditTarget, setApiKeyEditTarget] = React.useState<ApiKey | null>(null)
  const [keyLoeschenOpen, setKeyLoeschenOpen] = React.useState(false)
  const [keyLoeschen, setKeyLoeschen] = React.useState<ApiKey | null>(null)
  const [keyLoeschenLoading, setKeyLoeschenLoading] = React.useState(false)

  async function fetchApiKeys() {
    setLoadingKeys(true)
    try {
      const res = await fetch("/api/admin/api-keys")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setApiKeys(data.keys ?? [])
    } catch (err) {
      toast.error(`API-Keys konnten nicht geladen werden: ${err instanceof Error ? err.message : ""}`)
    } finally { setLoadingKeys(false) }
  }

  async function toggleKeyAktiv(key: ApiKey) {
    try {
      const res = await fetch(`/api/admin/api-keys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !key.aktiv }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
      toast.success(key.aktiv ? `„${key.name}" deaktiviert` : `„${key.name}" aktiviert`)
      fetchApiKeys()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler")
    }
  }

  async function handleKeyLoeschen() {
    if (!keyLoeschen) return
    setKeyLoeschenLoading(true)
    try {
      const res = await fetch(`/api/admin/api-keys/${keyLoeschen.id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
      toast.success(`Key „${keyLoeschen.name}" gelöscht`)
      setKeyLoeschenOpen(false); setKeyLoeschen(null); fetchApiKeys()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler")
    } finally { setKeyLoeschenLoading(false) }
  }

  async function fetchUsers() {
    setLoadingUsers(true)
    try {
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (err) {
      toast.error(`Benutzer konnten nicht geladen werden: ${err instanceof Error ? err.message : ""}`)
    } finally { setLoadingUsers(false) }
  }

  async function fetchAgenturen() {
    setLoadingAgenturen(true)
    try {
      const res = await fetch("/api/admin/agenturen")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAgenturen(data.agenturen ?? [])
    } catch (err) {
      toast.error(`Agenturen konnten nicht geladen werden: ${err instanceof Error ? err.message : ""}`)
    } finally { setLoadingAgenturen(false) }
  }

  React.useEffect(() => { Promise.all([fetchUsers(), fetchAgenturen(), fetchApiKeys()]) }, [])

  async function handleUserLoeschen() {
    if (!userLoeschen) return
    setUserLoeschenLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userLoeschen.id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Löschen") }
      toast.success(`Benutzer „${userLoeschen.name}" gelöscht`)
      setUserLoeschenOpen(false); setUserLoeschen(null); fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen")
    } finally { setUserLoeschenLoading(false) }
  }

  async function toggleUserAktiv(user: User) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktiv: !user.aktiv }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler") }
      toast.success(user.aktiv ? `„${user.name}" deaktiviert` : `„${user.name}" aktiviert`)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler")
    }
  }

  function openBenutzerEdit(u: User) {
    setBenutzerEditUser(u)
    setBenutzerEditOpen(true)
  }

  function openAgenturEdit(a: Agentur) {
    setAgenturEditTarget(a)
    setAgenturEditOpen(true)
  }

  function openFeatureToggle(a: Agentur) {
    setFeatureToggleAgentur(a)
    setFeatureToggleOpen(true)
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Admin" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <h2 className="text-xl font-semibold">Administration</h2>
                <p className="text-sm text-muted-foreground">Benutzer, Rollen und Agenturen verwalten</p>
              </div>

              <div className="px-4 lg:px-6">
                <Tabs defaultValue="benutzer">
                  <TabsList>
                    <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
                    <TabsTrigger value="agenturen">Agenturen</TabsTrigger>
                    <TabsTrigger value="feature-toggles">Feature Toggles</TabsTrigger>
                    <TabsTrigger value="api-keys">API Schlüssel</TabsTrigger>
                  </TabsList>

                  {/* ── Benutzer Tab ── */}
                  <TabsContent value="benutzer" className="mt-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{loadingUsers ? "Lädt…" : `${users.length} Benutzer`}</p>
                      <Button size="sm" onClick={() => setBenutzerSheetOpen(true)}>
                        <IconPlus className="size-4" />Neuer Benutzer
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>E-Mail</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead>Agentur</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingUsers ? (
                            <TableSkeletonRows cols={6} />
                          ) : users.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Keine Benutzer vorhanden.</TableCell>
                            </TableRow>
                          ) : (
                            users.map((u) => (
                              <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={rolleColors[u.rolle]}>{u.rolle}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{u.agenturen?.name ?? "–"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={u.aktiv ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                                    {u.aktiv ? "Aktiv" : "Inaktiv"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                                        <IconDotsVertical className="size-4" /><span className="sr-only">Aktionen</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => openBenutzerEdit(u)}>
                                        <IconEdit className="mr-2 size-4" />Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => toggleUserAktiv(u)} className={u.aktiv ? "text-destructive focus:text-destructive" : ""}>
                                        {u.aktiv ? <><IconUserOff className="mr-2 size-4" />Deaktivieren</> : <><IconUserCheck className="mr-2 size-4" />Aktivieren</>}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setUserLoeschen(u); setUserLoeschenOpen(true) }}>
                                        <IconTrash className="mr-2 size-4" />Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* ── Agenturen Tab ── */}
                  <TabsContent value="agenturen" className="mt-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{loadingAgenturen ? "Lädt…" : `${agenturen.length} Agenturen`}</p>
                      <Button size="sm" onClick={() => setAgenturSheetOpen(true)}>
                        <IconPlus className="size-4" />Neue Agentur
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Agentur</TableHead>
                            <TableHead>Kontakt-E-Mail</TableHead>
                            <TableHead className="text-center">Benutzer</TableHead>
                            <TableHead className="text-center">Webhook</TableHead>
                            <TableHead>Angelegt</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingAgenturen ? (
                            <TableSkeletonRows cols={6} />
                          ) : agenturen.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Keine Agenturen vorhanden.</TableCell>
                            </TableRow>
                          ) : (
                            agenturen.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.kontakt_email}</TableCell>
                                <TableCell className="text-center tabular-nums">{a.user_anzahl}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className={a.agency_webhook_url ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                                    {a.agency_webhook_url ? "Konfiguriert" : "–"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleDateString("de-DE")}</TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                                        <IconDotsVertical className="size-4" /><span className="sr-only">Aktionen</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => openAgenturEdit(a)}>
                                        <IconEdit className="mr-2 size-4" />Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setLoeschenAgentur(a); setLoeschenOpen(true) }}>
                                        <IconTrash className="mr-2 size-4" />Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* ── Feature Toggles Tab ── */}
                  <TabsContent value="feature-toggles" className="mt-4">
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">
                        Features pro Agentur freigeben oder deaktivieren.
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Agentur</TableHead>
                            {FEATURE_KEYS.map((key) => (
                              <TableHead key={key} className="text-center">
                                {FEATURE_META[key].label}
                              </TableHead>
                            ))}
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingAgenturen ? (
                            <TableSkeletonRows cols={2 + FEATURE_KEYS.length} />
                          ) : agenturen.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2 + FEATURE_KEYS.length} className="py-10 text-center text-muted-foreground">
                                Keine Agenturen vorhanden.
                              </TableCell>
                            </TableRow>
                          ) : (
                            agenturen.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.name}</TableCell>
                                {FEATURE_KEYS.map((key) => (
                                  <TableCell key={key} className="text-center">
                                    <Badge
                                      variant="outline"
                                      className={
                                        a.features?.[key]
                                          ? 'bg-green-100 text-green-700 border-green-200'
                                          : 'bg-gray-100 text-gray-500 border-gray-200'
                                      }
                                    >
                                      {a.features?.[key] ? 'Aktiv' : 'Inaktiv'}
                                    </Badge>
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground"
                                    onClick={() => openFeatureToggle(a)}
                                  >
                                    <IconToggleRight className="size-4" />
                                    <span className="sr-only">Feature Toggles</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* ── API Schlüssel Tab ── */}
                  <TabsContent value="api-keys" className="mt-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{loadingKeys ? "Lädt…" : `${apiKeys.length} API-Keys`}</p>
                      <Button size="sm" onClick={() => setApiKeySheetOpen(true)}>
                        <IconPlus className="size-4" />Neuer API-Key
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Berechtigungen</TableHead>
                            <TableHead>Zuletzt genutzt</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingKeys ? (
                            <TableSkeletonRows cols={6} />
                          ) : apiKeys.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Keine API-Keys vorhanden.</TableCell>
                            </TableRow>
                          ) : (
                            apiKeys.map((k) => (
                              <TableRow key={k.id}>
                                <TableCell className="font-medium">{k.name}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  sfhub_••••{k.key_preview}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {k.permissions.map((p) => (
                                      <Badge key={p} variant="outline" className="font-mono text-xs">
                                        {p}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {k.last_used_at
                                    ? new Date(k.last_used_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                    : "Noch nie"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={k.aktiv ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                                    {k.aktiv ? "Aktiv" : "Inaktiv"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                                        <IconDotsVertical className="size-4" /><span className="sr-only">Aktionen</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => { setApiKeyEditTarget(k); setApiKeyEditOpen(true) }}>
                                        <IconEdit className="mr-2 size-4" />Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => toggleKeyAktiv(k)} className={k.aktiv ? "text-destructive focus:text-destructive" : ""}>
                                        {k.aktiv
                                          ? <><IconUserOff className="mr-2 size-4" />Deaktivieren</>
                                          : <><IconUserCheck className="mr-2 size-4" />Aktivieren</>}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setKeyLoeschen(k); setKeyLoeschenOpen(true) }}>
                                        <IconTrash className="mr-2 size-4" />Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <NeuerBenutzerSheet open={benutzerSheetOpen} onOpenChange={setBenutzerSheetOpen} agenturen={agenturen} onSuccess={fetchUsers} />
      <BenutzerBearbeitenSheet open={benutzerEditOpen} onOpenChange={setBenutzerEditOpen} user={benutzerEditUser} agenturen={agenturen} onSuccess={fetchUsers} />
      <NeueAgenturSheet open={agenturSheetOpen} onOpenChange={setAgenturSheetOpen} onSuccess={fetchAgenturen} />
      <AgenturBearbeitenSheet open={agenturEditOpen} onOpenChange={setAgenturEditOpen} agentur={agenturEditTarget} onSuccess={fetchAgenturen} />
      <AgenturLoeschenDialog open={loeschenOpen} onOpenChange={setLoeschenOpen} agentur={loeschenAgentur} onSuccess={fetchAgenturen} />
      <FeatureToggleSheet
        open={featureToggleOpen}
        onOpenChange={setFeatureToggleOpen}
        agentur={featureToggleAgentur}
        onSuccess={fetchAgenturen}
      />

      <NeuerApiKeySheet open={apiKeySheetOpen} onOpenChange={setApiKeySheetOpen} onSuccess={fetchApiKeys} agenturen={agenturen} />
      <ApiKeyBearbeitenSheet open={apiKeyEditOpen} onOpenChange={setApiKeyEditOpen} apiKey={apiKeyEditTarget} onSuccess={fetchApiKeys} />

      <AlertDialog open={keyLoeschenOpen} onOpenChange={(o) => { if (!keyLoeschenLoading) setKeyLoeschenOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API-Key löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{keyLoeschen?.name ?? "Dieser Key"}</strong> wird dauerhaft gelöscht. Alle Systeme, die diesen Key verwenden, verlieren sofort den Zugriff.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={keyLoeschenLoading}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleKeyLoeschen} disabled={keyLoeschenLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {keyLoeschenLoading ? "Wird gelöscht…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={userLoeschenOpen} onOpenChange={(open) => { if (!userLoeschenLoading) setUserLoeschenOpen(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{userLoeschen?.name ?? "Dieser Benutzer"}</strong> wird dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={userLoeschenLoading}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleUserLoeschen} disabled={userLoeschenLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {userLoeschenLoading ? "Wird gelöscht…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
