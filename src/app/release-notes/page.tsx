'use client'

import * as React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useUser } from '@/context/user-context'

interface ReleaseNote {
  id: string
  datum: string
  title: string
  body: string
  roles: string[]
  is_read: boolean
}

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Admin',
  'Staffhub Manager': 'Manager',
  Controller: 'Controller',
  Agentur: 'Agentur',
}

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Staffhub Manager': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Controller: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Agentur: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

function formatDate(datum: string) {
  const d = new Date(datum + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ReleaseNotesPage() {
  const { user } = useUser()
  const [notes, setNotes] = React.useState<ReleaseNote[]>([])
  const [loading, setLoading] = React.useState(true)

  const isInternal = user?.rolle
    ? ['Admin', 'Staffhub Manager', 'Controller'].includes(user.rolle)
    : false

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/release-notes')
        if (!res.ok) return
        const data = await res.json()
        const fetchedNotes: ReleaseNote[] = data.notes ?? []
        setNotes(fetchedNotes)

        const unreadIds = fetchedNotes
          .filter((n) => !n.is_read)
          .map((n) => n.id)

        if (unreadIds.length > 0) {
          await fetch('/api/release-notes/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note_ids: unreadIds }),
          })
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Release Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Alle Neuerungen und Updates auf einen Blick
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Laden…
            </div>
          )}

          {!loading && notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-muted-foreground">
              <span className="text-4xl">📋</span>
              <p className="text-sm">Noch keine Release Notes vorhanden.</p>
            </div>
          )}

          {!loading && notes.length > 0 && (
            <div className="flex flex-col gap-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border bg-card p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        {formatDate(note.datum)}
                      </span>
                      <h2 className="text-base font-semibold leading-snug">
                        {note.title}
                      </h2>
                    </div>
                    {isInternal && (
                      <div className="flex flex-wrap gap-1 shrink-0 mt-0.5">
                        {note.roles.map((r) => (
                          <span
                            key={r}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[r] ?? 'bg-muted text-muted-foreground'}`}
                          >
                            {ROLE_LABELS[r] ?? r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
