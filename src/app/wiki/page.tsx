'use client'

import * as React from 'react'
import Link from 'next/link'
import { IconBook, IconChevronRight } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useUser } from '@/context/user-context'
import { getWikiPagesByRole } from '@/lib/wiki'
import type { Role } from '@/lib/wiki'

export default function WikiPage() {
  const { user } = useUser()
  const rolle = (user?.rolle ?? 'Agentur') as Role
  const pages = getWikiPagesByRole(rolle)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Wiki</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Anleitungen und Erklärungen zu allen Funktionen
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {pages.map((page) => (
              <Link
                key={page.slug}
                href={`/wiki/${page.slug}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <div className="flex items-center gap-3">
                  <IconBook className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{page.title}</span>
                </div>
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
