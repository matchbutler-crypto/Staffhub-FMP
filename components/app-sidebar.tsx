"use client"

import * as React from "react"
import {
  IconBriefcase,
  IconBuilding,
  IconLayoutDashboard,
  IconReceipt,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Max Muster",
    email: "manager@staffhub.de",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconLayoutDashboard,
    },
    {
      title: "Vakanzen",
      url: "/vakanzen",
      icon: IconBriefcase,
    },
    {
      title: "Profile",
      url: "/profile",
      icon: IconUsers,
    },
    {
      title: "Agenturen",
      url: "/agenturen",
      icon: IconBuilding,
    },
    {
      title: "Abrechnung",
      url: "/abrechnung",
      icon: IconReceipt,
    },
  ],
  navSecondary: [
    {
      title: "Admin",
      url: "/admin",
      icon: IconSettings,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/dashboard">
                <div className="flex size-5 items-center justify-center rounded bg-primary">
                  <IconBriefcase className="size-3 text-primary-foreground" />
                </div>
                <span className="text-base font-semibold">Staffhub FMP</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
