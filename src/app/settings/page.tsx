"use client"

import * as React from "react"
import { KeyRound, Eye, EyeOff, CheckCircle2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useUser } from "@/context/user-context"

// ── PasswordChangeForm ─────────────────────────────────────────────────────────

function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const passwordStrength = React.useMemo(() => {
    if (!newPassword) return 0
    let score = 0
    if (newPassword.length >= 8) score++
    if (newPassword.length >= 12) score++
    if (/[A-Z]/.test(newPassword)) score++
    if (/[0-9]/.test(newPassword)) score++
    if (/[^A-Za-z0-9]/.test(newPassword)) score++
    return score
  }, [newPassword])

  const strengthLabel = ['', 'Sehr schwach', 'Schwach', 'Mittel', 'Stark', 'Sehr stark'][passwordStrength]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'][passwordStrength]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!currentPassword) { setError("Bitte aktuelles Passwort eingeben."); return }
    if (newPassword.length < 8) { setError("Neues Passwort muss mindestens 8 Zeichen haben."); return }
    if (newPassword !== confirmPassword) { setError("Neue Passwörter stimmen nicht überein."); return }
    if (currentPassword === newPassword) { setError("Neues Passwort muss sich vom aktuellen unterscheiden."); return }

    setSaving(true)
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Ändern")
      setSuccess(true)
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
      toast.success("Passwort erfolgreich geändert")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Passwort erfolgreich geändert.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-pw">Aktuelles Passwort</Label>
        <div className="relative">
          <Input
            id="current-pw"
            type={showCurrent ? "text" : "password"}
            placeholder="Aktuelles Passwort"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-pw">Neues Passwort</Label>
        <div className="relative">
          <Input
            id="new-pw"
            type={showNew ? "text" : "password"}
            placeholder="Mindestens 8 Zeichen"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* Strength meter */}
        {newPassword && (
          <div className="flex flex-col gap-1 mt-0.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength ? strengthColor : 'bg-muted'}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{strengthLabel}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-pw">Neues Passwort bestätigen</Label>
        <div className="relative">
          <Input
            id="confirm-pw"
            type={showConfirm ? "text" : "password"}
            placeholder="Passwort wiederholen"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className={`pr-10 ${confirmPassword && confirmPassword !== newPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword && confirmPassword !== newPassword && (
          <p className="text-xs text-destructive">Passwörter stimmen nicht überein.</p>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={saving} className="min-w-[160px]">
          {saving ? "Speichern…" : "Passwort ändern"}
        </Button>
      </div>
    </form>
  )
}

// ── SettingsPage ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useUser()

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem", "--header-height": "3rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Einstellungen" />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">

            <div>
              <h2 className="text-xl font-semibold">Einstellungen</h2>
              <p className="text-sm text-muted-foreground">Persönliche Einstellungen und Sicherheit</p>
            </div>

            <div className="grid gap-6 max-w-2xl">
              {/* Account Info */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Mein Account</h3>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Rolle:</span>
                  <span className="font-medium">{user?.rolle}</span>
                </div>
              </div>

              {/* Password Change */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Passwort ändern</h3>
                </div>
                <PasswordChangeForm />
              </div>
            </div>

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
