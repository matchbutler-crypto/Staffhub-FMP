'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  IconBriefcase,
  IconChevronRight,
  IconClipboardList,
  IconDatabase,
  IconLayoutDashboard,
  IconPlayerPlay,
  IconReceipt,
  IconUsers,
} from '@tabler/icons-react'
import type { Icon } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useUser } from '@/context/user-context'
import { getWikiPagesByRole } from '@/lib/wiki'
import type { Role } from '@/lib/wiki'

const WIKI_ICONS: Record<string, Icon> = {
  dashboard: IconLayoutDashboard,
  vakanzen: IconBriefcase,
  beauftragungen: IconClipboardList,
  abrechnung: IconReceipt,
  pool: IconDatabase,
  ressourcen: IconUsers,
}

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
            {pages.map((page) => {
              const PageIcon = WIKI_ICONS[page.slug] ?? IconClipboardList
              const hasTour = Boolean(page.tour?.length)

              return (
                <Link
                  key={page.slug}
                  href={`/wiki/${page.slug}`}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground group"
                >
                  <div className="flex items-center gap-3">
                    <PageIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground transition-colors" />
                    <span className="font-medium">{page.title}</span>
                    {hasTour && (
                      <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <IconPlayerPlay className="size-2.5" />
                        Tour
                      </span>
                    )}
                  </div>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground transition-colors" />
                </Link>
              )
            })}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
