'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/context/user-context'
import { getWikiPageBySlug } from '@/lib/wiki'
import type { Role } from '@/lib/wiki'

const TOUR_ROUTES: Record<string, string> = {
  vakanzen: '/vakanzen',
  beauftragungen: '/beauftragungen',
  dashboard: '/dashboard',
  abrechnung: '/abrechnung',
  pool: '/pool',
  ressourcen: '/ressourcen',
}

export default function WikiDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useUser()

  const slug = typeof params.slug === 'string' ? params.slug : ''
  const page = getWikiPageBySlug(slug)
  const userRole = user?.rolle ? mapRoleToWikiRole(user.rolle) : 'Agentur'

  if (!loading && (!page || !page.roles.includes(userRole))) {
    notFound()
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-col gap-6 p-6 max-w-3xl">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="flex flex-col gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!page) return null

  const hasTour = Boolean(page.tour?.length)
  const tourTarget = TOUR_ROUTES[page.slug]

  function handleShowMe() {
    if (tourTarget) router.push(`${tourTarget}?tour=${page!.slug}`)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-col gap-8 p-6 max-w-3xl">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/wiki')}
                aria-label="Zurück zur Wiki-Übersicht"
              >
                <IconArrowLeft className="size-4" />
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
            </div>

            {hasTour && (
              <Button variant="outline" size="sm" onClick={handleShowMe} className="gap-2 shrink-0">
                <IconPlayerPlay className="size-3.5" />
                Zeig es mir
              </Button>
            )}
          </div>

          {/* Sections */}
          <div className="flex flex-col divide-y">
            {page.sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-2 py-5 first:pt-0 last:pb-0">
                <h2 className="text-sm font-semibold text-foreground">{section.heading}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function mapRoleToWikiRole(userRole: string): Role {
  const roleMap: Record<string, Role> = {
    Admin: 'Admin',
    'Staffhub Manager': 'Staffhub Manager',
    Agentur: 'Agentur',
    Controller: 'Controller',
  }
  return roleMap[userRole] ?? 'Agentur'
}
