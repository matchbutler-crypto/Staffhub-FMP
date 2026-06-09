'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { IconBug } from '@tabler/icons-react'
import { toast } from 'sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { FeedbackKanban } from '@/components/feedback/feedback-kanban'
import { useUser } from '@/context/user-context'
import type { Feedback } from '@/components/feedback/types'

export default function FeedbackPage() {
  const { user } = useUser()
  const router = useRouter()
  const [feedbacks, setFeedbacks] = React.useState<Feedback[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (user && user.rolle !== 'Admin') {
      router.replace('/dashboard')
    }
  }, [user, router])

  async function fetchFeedbacks() {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFeedbacks(data.feedbacks ?? [])
    } catch {
      toast.error('Feedbacks konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchFeedbacks() }, [])

  async function handleStatusChange(id: string, status: 'backlog' | 'in_progress' | 'review' | 'done') {
    // Optimistic update
    setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, status } : f))
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Status konnte nicht aktualisiert werden')
      fetchFeedbacks()
    }
  }

  return (
    <SidebarProvider style={{ '--sidebar-width': '18rem', '--header-height': '3rem' } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Feedback" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="flex items-center gap-2">
                  <IconBug className="size-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Feedback</h2>
                </div>
                <p className="text-sm text-muted-foreground">Eingegangene Feedbacks verwalten</p>
              </div>
              <div className="px-4 lg:px-6 overflow-x-auto">
                <FeedbackKanban
                  feedbacks={feedbacks}
                  loading={loading}
                  onStatusChange={handleStatusChange}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
