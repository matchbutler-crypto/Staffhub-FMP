'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useUser } from '@/context/user-context'
import { getWikiPageBySlug } from '@/lib/wiki'
import type { Role } from '@/lib/wiki'

export default function WikiDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useUser()

  const slug = typeof params.slug === 'string' ? params.slug : ''
  const page = getWikiPageBySlug(slug)

  // Map user role to wiki role type
  const userRole = user?.rolle ? mapRoleToWikiRole(user.rolle) : 'Agentur'

  if (!loading && (!page || !page.roles.includes(userRole))) {
    notFound()
  }

  if (loading || !page) {
    return null
  }

  function handleShowMe() {
    const tourRoutes: Record<string, string> = {
      vakanzen: '/vakanzen',
      beauftragungen: '/beauftragungen',
      dashboard: '/dashboard',
      abrechnung: '/abrechnung',
      pool: '/pool',
      ressourcen: '/ressourcen',
    }
    const target = tourRoutes[page!.slug]
    if (target) {
      router.push(`${target}?tour=${page!.slug}`)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/wiki')}>
              <IconArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
          </div>

          <div className="flex flex-col gap-5">
            {page.sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">{section.heading}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

          {page.tour && page.tour.length > 0 && (
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={handleShowMe} className="gap-2">
                <IconPlayerPlay className="size-4" />
                Zeig es mir
              </Button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function mapRoleToWikiRole(userRole: string): Role {
  const roleMap: Record<string, Role> = {
    'Admin': 'Admin',
    'Staffhub Manager': 'Staffhub Manager',
    'Agentur': 'Agentur',
    'Controller': 'Controller',
  }
  return roleMap[userRole] || 'Agentur'
}
