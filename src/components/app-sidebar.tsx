'use client'

import * as React from 'react'
import {
  IconBrandSlack,
  IconBriefcase,
  IconBug,
  IconBuilding,
  IconBulb,
  IconClipboardList,
  IconDatabase,
  IconLayoutDashboard,
  IconReceipt,
  IconSettings,
  IconSettingsCog,
  IconSpeakerphone,
  IconUsers,
} from '@tabler/icons-react'

import { ModeToggle } from '@/components/mode-toggle'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { useUser } from '@/context/user-context'
import { useUnreadNotes } from '@/hooks/use-unread-notes'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const ALL_NAV_MAIN = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: IconLayoutDashboard,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Vakanzen',
    url: '/vakanzen',
    icon: IconBriefcase,
    roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  },
  {
    title: 'Agenturen',
    url: '/agenturen',
    icon: IconBuilding,
    roles: ['Admin'],
  },
  {
    title: 'Beauftragungen',
    url: '/beauftragungen',
    icon: IconClipboardList,
    roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  },
  {
    title: 'Abrechnung',
    url: '/abrechnung',
    icon: IconReceipt,
    roles: ['Admin', 'Staffhub Manager', 'Controller'],
  },
  {
    title: 'Mein Pool',
    url: '/pool',
    icon: IconDatabase,
    roles: ['Agentur'],
  },
  {
    title: 'Ressourcen',
    url: '/ressourcen',
    icon: IconDatabase,
    roles: ['Admin', 'Staffhub Manager'],
  },
  {
    title: 'Slack Log',
    url: '/slack-log',
    icon: IconBrandSlack,
    roles: ['Admin', 'Staffhub Manager'],
  },
  {
    title: 'Ideen-Board',
    url: '/ideen',
    icon: IconBulb,
    roles: ['Admin', 'Staffhub Manager', 'Agentur'],
  },
]

const ALL_NAV_SECONDARY = [
  {
    title: 'Release Notes',
    url: '/release-notes',
    icon: IconSpeakerphone,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Einstellungen',
    url: '/settings',
    icon: IconSettingsCog,
    roles: ['Admin', 'Staffhub Manager', 'Agentur', 'Controller'],
  },
  {
    title: 'Admin',
    url: '/admin',
    icon: IconSettings,
    roles: ['Admin'],
  },
  {
    title: 'Feedback',
    url: '/feedback',
    icon: IconBug,
    roles: ['Admin'],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser()
  const rolle = user?.rolle ?? 'Agentur'
  const unreadNotes = useUnreadNotes()

  const navMain = ALL_NAV_MAIN.filter((item) => item.roles.includes(rolle))
  const navSecondary = ALL_NAV_SECONDARY.filter((item) =>
    item.roles.includes(rolle)
  ).map((item) =>
    item.url === '/release-notes' ? { ...item, badge: unreadNotes } : item
  )

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!justify-center"
            >
              <a href="/dashboard">
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary">
                  <IconBriefcase className="size-4 text-primary-foreground" />
                </div>
                <span className="text-base font-semibold">Staffhub FMP</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {navSecondary.length > 0 && (
          <NavSecondary items={navSecondary} className="mt-auto" />
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-end px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <ModeToggle />
        </div>
        <NavUser
          user={{
            name: user?.name ?? '…',
            email: user?.email ?? '',
            avatar: '',
            rolle: user?.rolle ?? '',
            initials,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
