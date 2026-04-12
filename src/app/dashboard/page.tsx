"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  IconBriefcase,
  IconCurrencyEuro,
  IconUsers,
  IconUserCheck,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { UnauthorizedToast } from "@/components/unauthorized-toast"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const kpiCards = [
  {
    title: "Aktive Vakanzen",
    value: "8",
    description: "+2 seit letztem Monat",
    icon: IconBriefcase,
  },
  {
    title: "Eingereichte Profile",
    value: "34",
    description: "+8 diese Woche",
    icon: IconUsers,
  },
  {
    title: "Aktive Beauftragungen",
    value: "12",
    description: "Über 3 Agenturen",
    icon: IconUserCheck,
  },
  {
    title: "Monatsmarge",
    value: "€ 18.400",
    description: "April 2026",
    icon: IconCurrencyEuro,
  },
]

const chartData = [
  { monat: "Nov", profile: 18, beauftragungen: 7 },
  { monat: "Dez", profile: 22, beauftragungen: 8 },
  { monat: "Jan", profile: 25, beauftragungen: 9 },
  { monat: "Feb", profile: 28, beauftragungen: 10 },
  { monat: "Mrz", profile: 31, beauftragungen: 11 },
  { monat: "Apr", profile: 34, beauftragungen: 12 },
]

const chartConfig = {
  profile: {
    label: "Eingereichte Profile",
    color: "var(--primary)",
  },
  beauftragungen: {
    label: "Beauftragungen",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

type ProfilStatus =
  | "Eingereicht"
  | "In Prüfung"
  | "Präsentiert"
  | "Interview"
  | "Beauftragt"
  | "Abgelehnt"

const recentActivity: {
  kandidat: string
  vakanz: string
  agentur: string
  status: ProfilStatus
  score: number
  datum: string
}[] = [
  {
    kandidat: "M. Hoffmann",
    vakanz: "Senior React Developer",
    agentur: "TechTalents GmbH",
    status: "Interview",
    score: 87,
    datum: "12.04.2026",
  },
  {
    kandidat: "S. Becker",
    vakanz: "DevOps Engineer",
    agentur: "ProStaff AG",
    status: "In Prüfung",
    score: 74,
    datum: "11.04.2026",
  },
  {
    kandidat: "K. Müller",
    vakanz: "Data Scientist",
    agentur: "Digital Experts",
    status: "Eingereicht",
    score: 61,
    datum: "11.04.2026",
  },
  {
    kandidat: "A. Wagner",
    vakanz: "Senior React Developer",
    agentur: "TechTalents GmbH",
    status: "Beauftragt",
    score: 92,
    datum: "10.04.2026",
  },
  {
    kandidat: "T. Schulz",
    vakanz: "Cloud Architect",
    agentur: "ProStaff AG",
    status: "Präsentiert",
    score: 79,
    datum: "09.04.2026",
  },
]

const statusColors: Record<ProfilStatus, string> = {
  Eingereicht: "bg-blue-100 text-blue-700 border-blue-200",
  "In Prüfung": "bg-yellow-100 text-yellow-700 border-yellow-200",
  Präsentiert: "bg-purple-100 text-purple-700 border-purple-200",
  Interview: "bg-orange-100 text-orange-700 border-orange-200",
  Beauftragt: "bg-green-100 text-green-700 border-green-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-700 border-green-200"
      : score >= 40
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-red-100 text-red-700 border-red-200"
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}
    >
      {score}
    </span>
  )
}

export default function DashboardPage() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <UnauthorizedToast />
        <SiteHeader title="Dashboard" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* KPI Cards */}
              <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                {kpiCards.map((card) => (
                  <Card key={card.title} className="@container/card">
                    <CardHeader>
                      <CardDescription>{card.title}</CardDescription>
                      <div className="flex items-end justify-between gap-2">
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                          {card.value}
                        </CardTitle>
                        <card.icon className="mb-1 size-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <div className="px-6 pb-4">
                      <p className="text-sm text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Chart */}
              <div className="px-4 lg:px-6">
                <Card className="@container/card">
                  <CardHeader>
                    <CardTitle>Bewerber-Trend</CardTitle>
                    <CardDescription>
                      Eingereichte Profile und Beauftragungen der letzten 6 Monate
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    <ChartContainer
                      config={chartConfig}
                      className="aspect-auto h-[220px] w-full"
                    >
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient
                            id="fillProfile"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-profile)"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-profile)"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="fillBeauftragungen"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-beauftragungen)"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-beauftragungen)"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="monat"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          width={30}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Area
                          dataKey="profile"
                          type="natural"
                          fill="url(#fillProfile)"
                          stroke="var(--color-profile)"
                        />
                        <Area
                          dataKey="beauftragungen"
                          type="natural"
                          fill="url(#fillBeauftragungen)"
                          stroke="var(--color-beauftragungen)"
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity Table */}
              <div className="px-4 lg:px-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Letzte Aktivitäten</CardTitle>
                    <CardDescription>
                      Zuletzt eingereichte und aktualisierte Profile
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead>Kandidat</TableHead>
                          <TableHead>Vakanz</TableHead>
                          <TableHead>Agentur</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>KI-Score</TableHead>
                          <TableHead>Datum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentActivity.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {row.kandidat}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.vakanz}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.agentur}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[row.status]}`}
                              >
                                {row.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ScoreBadge score={row.score} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.datum}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
