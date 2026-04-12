"use client"

import * as React from "react"
import {
  IconBriefcase,
  IconChevronDown,
  IconDotsVertical,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type VakanzStatus =
  | "Offen"
  | "In Auswahl"
  | "Besetzt"
  | "Pausiert"
  | "Geschlossen"

type Erfahrungslevel = "Junior" | "Mid" | "Senior" | "Expert"

type Arbeitsmodell = "Remote" | "Hybrid" | "Onsite"

interface Vakanz {
  id: string
  titel: string
  rolle: string
  skills: string[]
  erfahrungslevel: Erfahrungslevel
  startdatum: string
  arbeitsmodell: Arbeitsmodell
  status: VakanzStatus
  profileAnzahl: number
  standort?: string
}

const mockVakanzen: Vakanz[] = [
  {
    id: "1",
    titel: "Senior React Developer",
    rolle: "Frontend Engineer",
    skills: ["React", "TypeScript", "GraphQL", "Jest"],
    erfahrungslevel: "Senior",
    startdatum: "01.05.2026",
    arbeitsmodell: "Remote",
    status: "Offen",
    profileAnzahl: 8,
  },
  {
    id: "2",
    titel: "DevOps Engineer",
    rolle: "DevOps / Platform Engineer",
    skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
    erfahrungslevel: "Senior",
    startdatum: "15.04.2026",
    arbeitsmodell: "Hybrid",
    status: "In Auswahl",
    profileAnzahl: 5,
    standort: "München",
  },
  {
    id: "3",
    titel: "Data Scientist",
    rolle: "Data Scientist / ML Engineer",
    skills: ["Python", "PyTorch", "SQL", "Spark"],
    erfahrungslevel: "Mid",
    startdatum: "01.06.2026",
    arbeitsmodell: "Remote",
    status: "Offen",
    profileAnzahl: 4,
  },
  {
    id: "4",
    titel: "Cloud Architect",
    rolle: "Solutions Architect",
    skills: ["AWS", "Azure", "Terraform", "Security"],
    erfahrungslevel: "Expert",
    startdatum: "01.04.2026",
    arbeitsmodell: "Hybrid",
    status: "Besetzt",
    profileAnzahl: 12,
    standort: "Berlin",
  },
  {
    id: "5",
    titel: "Backend Java Developer",
    rolle: "Backend Engineer",
    skills: ["Java", "Spring Boot", "Kafka", "PostgreSQL"],
    erfahrungslevel: "Mid",
    startdatum: "15.05.2026",
    arbeitsmodell: "Onsite",
    status: "Offen",
    profileAnzahl: 3,
    standort: "Frankfurt",
  },
  {
    id: "6",
    titel: "Scrum Master",
    rolle: "Agile Coach / Scrum Master",
    skills: ["Scrum", "Kanban", "Jira", "Confluence"],
    erfahrungslevel: "Mid",
    startdatum: "01.05.2026",
    arbeitsmodell: "Hybrid",
    status: "Pausiert",
    profileAnzahl: 2,
    standort: "Hamburg",
  },
  {
    id: "7",
    titel: "UI/UX Designer",
    rolle: "Product Designer",
    skills: ["Figma", "Design Systems", "User Research"],
    erfahrungslevel: "Senior",
    startdatum: "01.06.2026",
    arbeitsmodell: "Remote",
    status: "Offen",
    profileAnzahl: 6,
  },
  {
    id: "8",
    titel: "IT-Projektmanager",
    rolle: "Project Manager",
    skills: ["PMP", "PRINCE2", "Stakeholder Mgmt"],
    erfahrungslevel: "Senior",
    startdatum: "15.04.2026",
    arbeitsmodell: "Hybrid",
    status: "Geschlossen",
    profileAnzahl: 9,
    standort: "München",
  },
]

const statusColors: Record<VakanzStatus, string> = {
  Offen: "bg-blue-100 text-blue-700 border-blue-200",
  "In Auswahl": "bg-orange-100 text-orange-700 border-orange-200",
  Besetzt: "bg-green-100 text-green-700 border-green-200",
  Pausiert: "bg-gray-100 text-gray-600 border-gray-200",
  Geschlossen: "bg-red-100 text-red-700 border-red-200",
}

const arbeitsmodellColors: Record<Arbeitsmodell, string> = {
  Remote: "bg-teal-100 text-teal-700 border-teal-200",
  Hybrid: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Onsite: "bg-amber-100 text-amber-700 border-amber-200",
}

const erfahrungsColors: Record<Erfahrungslevel, string> = {
  Junior: "bg-sky-100 text-sky-700 border-sky-200",
  Mid: "bg-violet-100 text-violet-700 border-violet-200",
  Senior: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expert: "bg-rose-100 text-rose-700 border-rose-200",
}

function SkillTags({ skills }: { skills: string[] }) {
  const shown = skills.slice(0, 3)
  const rest = skills.length - 3
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span
          key={s}
          className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {s}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  )
}

function TagInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = React.useState("")

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault()
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()])
      }
      setInput("")
    }
    if (e.key === "Backspace" && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-within:ring-1 focus-within:ring-ring">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
          >
            <IconX className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[80px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        placeholder={value.length === 0 ? "Skill eingeben, Enter drücken" : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function NeueVakanzSheet() {
  const [skills, setSkills] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <IconPlus className="size-4" />
          Neue Vakanz
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Neue Vakanz erstellen</SheetTitle>
          <SheetDescription>
            Füllen Sie die Pflichtfelder aus und speichern Sie die Vakanz.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-titel">Titel *</Label>
            <Input id="v-titel" placeholder="z.B. Senior React Developer" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-rolle">Rolle / Jobtitel *</Label>
            <Input id="v-rolle" placeholder="z.B. Frontend Engineer" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-beschreibung">Beschreibung *</Label>
            <Textarea
              id="v-beschreibung"
              placeholder="Anforderungen, Aufgaben, Kontext..."
              className="min-h-[100px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Geforderte Skills *</Label>
            <TagInput value={skills} onChange={setSkills} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-level">Erfahrungslevel *</Label>
              <Select>
                <SelectTrigger id="v-level">
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Junior">Junior</SelectItem>
                  <SelectItem value="Mid">Mid</SelectItem>
                  <SelectItem value="Senior">Senior</SelectItem>
                  <SelectItem value="Expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-modell">Arbeitsmodell *</Label>
              <Select>
                <SelectTrigger id="v-modell">
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Remote">Remote</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                  <SelectItem value="Onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-start">Startdatum *</Label>
              <Input id="v-start" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-laufzeit">Laufzeit *</Label>
              <Input id="v-laufzeit" placeholder="z.B. 6 Monate" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-auslastung">Auslastung (%) *</Label>
              <Input id="v-auslastung" type="number" placeholder="100" min={10} max={100} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-standort">Standort</Label>
              <Input id="v-standort" placeholder="optional" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-budget">Internes Budget (€/Tag)</Label>
            <Input id="v-budget" type="number" placeholder="nur intern sichtbar" />
          </div>
        </div>
        <SheetFooter className="px-4 pb-4">
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
          <Button onClick={() => setOpen(false)}>Vakanz erstellen</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function VakanzenPage() {
  const [statusFilter, setStatusFilter] = React.useState<string>("alle")
  const [searchQuery, setSearchQuery] = React.useState("")

  const filtered = mockVakanzen.filter((v) => {
    const matchesStatus =
      statusFilter === "alle" || v.status === statusFilter
    const matchesSearch =
      searchQuery === "" ||
      v.titel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.rolle.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

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
        <SiteHeader title="Vakanzen" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header + Actions */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Vakanzen</h2>
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} Vakanzen gefunden
                  </p>
                </div>
                <NeueVakanzSheet />
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Vakanz suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Status</SelectItem>
                    <SelectItem value="Offen">Offen</SelectItem>
                    <SelectItem value="In Auswahl">In Auswahl</SelectItem>
                    <SelectItem value="Besetzt">Besetzt</SelectItem>
                    <SelectItem value="Pausiert">Pausiert</SelectItem>
                    <SelectItem value="Geschlossen">Geschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Titel</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Modell</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Profile</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Keine Vakanzen gefunden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">
                              {v.titel}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {v.rolle}
                            </TableCell>
                            <TableCell>
                              <SkillTags skills={v.skills} />
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${erfahrungsColors[v.erfahrungslevel]}`}
                              >
                                {v.erfahrungslevel}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {v.startdatum}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${arbeitsmodellColors[v.arbeitsmodell]}`}
                              >
                                {v.arbeitsmodell}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[v.status]}`}
                              >
                                {v.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-sm font-medium tabular-nums">
                              {v.profileAnzahl}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground"
                                  >
                                    <IconDotsVertical className="size-4" />
                                    <span className="sr-only">Aktionen</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                                  <DropdownMenuItem>In Slack posten</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive">
                                    Schließen
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
