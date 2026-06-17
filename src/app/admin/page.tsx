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
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Checkbox } from "@/components/ui/checkbox"
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

// ── Types ──────────────────────────────────────────────────────────────────────

type Rolle = "Admin" | "Staffhub Manager" | "Controller" | "Agentur"

interface Agentur {
  id: string
  name: string
  kontakt_email: string
  user_anzahl: number
  created_at: string
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
}

const ALL_PERMISSIONS: ApiPermission[] = [
  'vakanzen:read', 'vakanzen:create', 'vakanzen:update',
  'vorschlaege:read', 'vorschlaege:update', 'profile:read',
]

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
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) { setName(""); setKontaktEmail(""); setError(null) }
  }, [open])

  async function handleSubmit() {
    if (!name || !kontaktEmail) { setError("Bitte alle Pflichtfelder ausfüllen."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/agenturen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kontakt_email: kontaktEmail }),
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
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && agentur) {
      setName(agentur.name)
      setKontaktEmail(agentur.kontakt_email)
      setError(null)
    }
  }, [open, agentur])

  async function handleSubmit() {
    if (!name || !kontaktEmail) { setError("Bitte alle Pflichtfelder ausfüllen."); return }
    if (!agentur) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/agenturen/${agentur.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kontakt_email: kontaktEmail }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Speichern") }
      toast.success(`Agentur „${name}" wurde aktualisiert`)
      onOpenChange(false); onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[400px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Agentur bearbeiten</SheetTitle>
          <SheetDescription>Name und Kontakt-E-Mail von <span className="font-medium text-foreground">{agentur?.name}</span> ändern.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ae-name">Agentur-Name *</Label>
              <Input id="ae-name" placeholder="z.B. TechTalents GmbH" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ae-kontakt">Kontakt-E-Mail *</Label>
              <Input id="ae-kontakt" type="email" placeholder="kontakt@agentur.de" value={kontaktEmail} onChange={(e) => setKontaktEmail(e.target.value)} />
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
}

function NeuerApiKeySheet({ open, onOpenChange, onSuccess }: NeuerApiKeySheetProps) {
  const [name, setName] = React.useState("")
  const [permissions, setPermissions] = React.useState<ApiPermission[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (open) { setName(""); setPermissions([]); setError(null); setGeneratedKey(null); setCopied(false) }
  }, [open])

  function togglePermission(p: ApiPermission) {
    setPermissions(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleSubmit() {
    if (!name) { setError("Bitte einen Namen eingeben."); return }
    if (permissions.length === 0) { setError("Bitte mindestens eine Berechtigung auswählen."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Fehler beim Anlegen") }
      const data = await res.json()
      setGeneratedKey(data.plaintext_key)
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

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!generatedKey) onOpenChange(o) }}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Neuen API-Key anlegen</SheetTitle>
          <SheetDescription>Legen Sie einen Key an und weisen Sie Berechtigungen zu.</SheetDescription>
        </SheetHeader>

        {generatedKey ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
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
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name">Name *</Label>
              <Input id="key-name" placeholder="z.B. Backoffice Sören" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Berechtigungen *</Label>
              <div className="flex flex-col gap-2 rounded-md border p-3">
                {ALL_PERMISSIONS.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <Checkbox
                      id={`perm-${p}`}
                      checked={permissions.includes(p)}
                      onCheckedChange={() => togglePermission(p)}
                    />
                    <label htmlFor={`perm-${p}`} className="text-sm cursor-pointer select-none">
                      {PERMISSION_LABELS[p]}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{p}</span>
                    </label>
                  </div>
                ))}
              </div>
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

function ApiKeyBearbeitenSheet({ open, onOpenChange, apiKey, onSuccess }: ApiKeyBearbeitenSheetProps) {
  const [name, setName] = React.useState("")
  const [permissions, setPermissions] = React.useState<ApiPermission[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open && apiKey) {
      setName(apiKey.name)
      setPermissions(apiKey.permissions)
      setError(null)
    }
  }, [open, apiKey])

  function togglePermission(p: ApiPermission) {
    setPermissions(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleSubmit() {
    if (!name) { setError("Name darf nicht leer sein."); return }
    if (permissions.length === 0) { setError("Mindestens eine Berechtigung erforderlich."); return }
    if (!apiKey) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
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
          <SheetDescription>Name und Berechtigungen von <span className="font-medium text-foreground">{apiKey?.name}</span> ändern.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-key-name">Name *</Label>
            <Input id="edit-key-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Berechtigungen *</Label>
            <div className="flex flex-col gap-2 rounded-md border p-3">
              {ALL_PERMISSIONS.map((p) => (
                <div key={p} className="flex items-center gap-2">
                  <Checkbox
                    id={`edit-perm-${p}`}
                    checked={permissions.includes(p)}
                    onCheckedChange={() => togglePermission(p)}
                  />
                  <label htmlFor={`edit-perm-${p}`} className="text-sm cursor-pointer select-none">
                    {PERMISSION_LABELS[p]}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{p}</span>
                  </label>
                </div>
              ))}
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
                            <TableHead>Angelegt</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingAgenturen ? (
                            <TableSkeletonRows cols={5} />
                          ) : agenturen.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Keine Agenturen vorhanden.</TableCell>
                            </TableRow>
                          ) : (
                            agenturen.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{a.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.kontakt_email}</TableCell>
                                <TableCell className="text-center tabular-nums">{a.user_anzahl}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleDateString("de-DE")}</TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                                        <IconDotsVertical className="size-4" /><span className="sr-only">Aktionen</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
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

      <NeuerApiKeySheet open={apiKeySheetOpen} onOpenChange={setApiKeySheetOpen} onSuccess={fetchApiKeys} />
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
