'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { IconBriefcase } from '@tabler/icons-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function isSafeRedirect(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

function getErrorMessage(error: string | null): string | null {
  if (error === 'deactivated')
    return 'Ihr Account wurde deaktiviert. Bitte kontaktieren Sie den Administrator.'
  if (error === 'no_profile')
    return 'Account nicht konfiguriert — bitte Admin kontaktieren.'
  return null
}

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(getErrorMessage(errorParam))
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('E-Mail oder Passwort falsch.')
        return
      }

      if (!data.session) {
        setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
        return
      }

      const destination =
        redirectTo && isSafeRedirect(redirectTo) ? redirectTo : '/dashboard'
      window.location.href = destination
    } catch {
      setError('Verbindungsfehler — bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@staffhub.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          autoComplete="current-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Anmelden…' : 'Anmelden'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-2 justify-center">
          <div className="flex size-8 items-center justify-center rounded bg-primary">
            <IconBriefcase className="size-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">Staffhub FMP</span>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Anmelden</CardTitle>
            <CardDescription>Gib deine Zugangsdaten ein</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Kein Account? Wende dich an den Administrator.
        </p>
      </div>
    </div>
  )
}
