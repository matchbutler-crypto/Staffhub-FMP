"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconDotsVertical,
  IconDownload,
  IconMessageCircle,
  IconSearch,
  IconSend,
  IconX,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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

type ProfilStatus =
  | "Eingereicht"
  | "In Prüfung"
  | "Präsentiert"
  | "Interview"
  | "Beauftragt"
  | "Abgelehnt"

type KiEmpfehlung = "Empfohlen" | "Bedingt geeignet" | "Nicht geeignet"

interface KiBewertung {
  score: number
  empfehlung: KiEmpfehlung
  begruendung: string
  skillsVorhanden: string[]
  skillsFehlend: string[]
}

interface Profil {
  id: string
  kandidat: string
  vakanz: string
  agentur: string
  skills: string[]
  erfahrungslevel: string
  verfuegbarAb: string
  ki: KiBewertung
  status: ProfilStatus
  profiltext: string
  kommentare: { autor: string; text: string; zeit: string }[]
}

const mockProfile: Profil[] = [
  {
    id: "1",
    kandidat: "M. Hoffmann",
    vakanz: "Senior React Developer",
    agentur: "TechTalents GmbH",
    skills: ["React", "TypeScript", "GraphQL"],
    erfahrungslevel: "Senior",
    verfuegbarAb: "01.05.2026",
    ki: {
      score: 87,
      empfehlung: "Empfohlen",
      begruendung:
        "Der Kandidat verfügt über umfangreiche React- und TypeScript-Erfahrung. GraphQL ist vorhanden. Testabdeckung (Jest) sollte im Interview verifiziert werden.",
      skillsVorhanden: ["React", "TypeScript", "GraphQL"],
      skillsFehlend: ["Jest"],
    },
    status: "Interview",
    profiltext:
      "Erfahrener Frontend-Entwickler mit 7 Jahren React-Erfahrung. Spezialisiert auf performance-kritische SPAs und Design-Systeme. Zuletzt bei einem Scale-up tätig.",
    kommentare: [
      {
        autor: "Max Muster (Manager)",
        text: "Profil sieht stark aus. Interview für KW 16 geplant.",
        zeit: "10.04.2026, 14:32",
      },
      {
        autor: "TechTalents GmbH",
        text: "Kandidat ist flexibel bezüglich Starttermin. Kann auch früher beginnen.",
        zeit: "11.04.2026, 09:15",
      },
    ],
  },
  {
    id: "2",
    kandidat: "S. Becker",
    vakanz: "DevOps Engineer",
    agentur: "ProStaff AG",
    skills: ["Kubernetes", "Terraform", "AWS"],
    erfahrungslevel: "Senior",
    verfuegbarAb: "15.04.2026",
    ki: {
      score: 74,
      empfehlung: "Bedingt geeignet",
      begruendung:
        "Solide Kubernetes- und AWS-Kenntnisse. Terraform-Erfahrung vorhanden. CI/CD-Tools nicht explizit erwähnt.",
      skillsVorhanden: ["Kubernetes", "Terraform", "AWS"],
      skillsFehlend: ["CI/CD"],
    },
    status: "In Prüfung",
    profiltext:
      "DevOps-Spezialist mit Fokus auf Cloud-Native-Infrastruktur. 5 Jahre Kubernetes-Erfahrung in Produktionsumgebungen.",
    kommentare: [
      {
        autor: "Max Muster (Manager)",
        text: "Bitte CI/CD-Erfahrung bei Agentur nachfragen.",
        zeit: "11.04.2026, 16:00",
      },
    ],
  },
  {
    id: "3",
    kandidat: "K. Müller",
    vakanz: "Data Scientist",
    agentur: "Digital Experts",
    skills: ["Python", "PyTorch", "SQL"],
    erfahrungslevel: "Mid",
    verfuegbarAb: "01.06.2026",
    ki: {
      score: 61,
      empfehlung: "Bedingt geeignet",
      begruendung:
        "Python und PyTorch vorhanden. SQL-Kenntnisse vorhanden. Spark fehlt. Für Mid-Level vertretbar.",
      skillsVorhanden: ["Python", "PyTorch", "SQL"],
      skillsFehlend: ["Spark"],
    },
    status: "Eingereicht",
    profiltext:
      "Data Scientist mit Schwerpunkt NLP und Computer Vision. Promotion in Informatik. 3 Jahre Industrie-Erfahrung.",
    kommentare: [],
  },
  {
    id: "4",
    kandidat: "A. Wagner",
    vakanz: "Senior React Developer",
    agentur: "TechTalents GmbH",
    skills: ["React", "TypeScript", "GraphQL", "Jest"],
    erfahrungslevel: "Expert",
    verfuegbarAb: "01.04.2026",
    ki: {
      score: 92,
      empfehlung: "Empfohlen",
      begruendung:
        "Vollständige Skill-Abdeckung. Expert-Level übertrifft Senior-Anforderung. Starker Kandidat.",
      skillsVorhanden: ["React", "TypeScript", "GraphQL", "Jest"],
      skillsFehlend: [],
    },
    status: "Beauftragt",
    profiltext:
      "Top-Kandidat mit 10+ Jahren React-Erfahrung. Mitautor mehrerer Open-Source-Bibliotheken. Tech Lead bei DAX-Unternehmen.",
    kommentare: [
      {
        autor: "Max Muster (Manager)",
        text: "Beauftragung bestätigt. Starttermin 01.04.2026.",
        zeit: "28.03.2026, 11:00",
      },
    ],
  },
  {
    id: "5",
    kandidat: "T. Schulz",
    vakanz: "Cloud Architect",
    agentur: "ProStaff AG",
    skills: ["AWS", "Azure", "Terraform"],
    erfahrungslevel: "Senior",
    verfuegbarAb: "15.04.2026",
    ki: {
      score: 79,
      empfehlung: "Empfohlen",
      begruendung:
        "Multi-Cloud-Erfahrung mit AWS und Azure. Security-Aspekte sollten im Interview vertieft werden.",
      skillsVorhanden: ["AWS", "Azure", "Terraform"],
      skillsFehlend: ["Security"],
    },
    status: "Präsentiert",
    profiltext:
      "Cloud-Architect mit Erfahrung in Multi-Cloud-Migrationen. Zertifiziert in AWS und Azure. 8 Jahre Erfahrung.",
    kommentare: [],
  },
  {
    id: "6",
    kandidat: "L. Fischer",
    vakanz: "DevOps Engineer",
    agentur: "Digital Experts",
    skills: ["Kubernetes", "CI/CD", "Linux"],
    erfahrungslevel: "Mid",
    verfuegbarAb: "01.05.2026",
    ki: {
      score: 38,
      empfehlung: "Nicht geeignet",
      begruendung:
        "Terraform und AWS fehlen komplett. Für Senior-DevOps-Rolle nicht ausreichend qualifiziert.",
      skillsVorhanden: ["Kubernetes", "CI/CD"],
      skillsFehlend: ["Terraform", "AWS"],
    },
    status: "Abgelehnt",
    profiltext: "Junior-Mid DevOps Engineer. Gute Grundkenntnisse, aber fehlende Cloud-Erfahrung.",
    kommentare: [
      {
        autor: "Max Muster (Manager)",
        text: "Leider nicht passend für diese Vakanz.",
        zeit: "09.04.2026, 10:00",
      },
    ],
  },
  {
    id: "7",
    kandidat: "P. Richter",
    vakanz: "Data Scientist",
    agentur: "TechTalents GmbH",
    skills: ["Python", "Spark", "SQL", "PyTorch"],
    erfahrungslevel: "Senior",
    verfuegbarAb: "01.05.2026",
    ki: {
      score: 85,
      empfehlung: "Empfohlen",
      begruendung: "Vollständige Skill-Abdeckung. Senior-Erfahrung übertrifft Mid-Anforderung.",
      skillsVorhanden: ["Python", "Spark", "SQL", "PyTorch"],
      skillsFehlend: [],
    },
    status: "In Prüfung",
    profiltext: "Erfahrener Data Scientist mit Fokus auf Big Data und ML-Pipelines. 6 Jahre Erfahrung.",
    kommentare: [],
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

const empfehlungColors: Record<KiEmpfehlung, string> = {
  Empfohlen: "bg-green-100 text-green-700 border-green-200",
  "Bedingt geeignet": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Nicht geeignet": "bg-red-100 text-red-700 border-red-200",
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

function ProfilDetailSheet({
  profil,
  open,
  onClose,
}: {
  profil: Profil | null
  open: boolean
  onClose: () => void
}) {
  const [newComment, setNewComment] = React.useState("")
  const [currentStatus, setCurrentStatus] = React.useState<ProfilStatus | "">(
    profil?.status ?? ""
  )

  React.useEffect(() => {
    setCurrentStatus(profil?.status ?? "")
    setNewComment("")
  }, [profil])

  if (!profil) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[540px] sm:w-[600px] overflow-y-auto"
      >
        <SheetHeader className="pb-4">
          <SheetTitle>{profil.kandidat}</SheetTitle>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{profil.agentur}</span>
            <span>·</span>
            <span>{profil.vakanz}</span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-1">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[profil.status]}`}
            >
              {profil.status}
            </span>
            <Select
              value={currentStatus}
              onValueChange={(v) => setCurrentStatus(v as ProfilStatus)}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Status ändern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Eingereicht">Eingereicht</SelectItem>
                <SelectItem value="In Prüfung">In Prüfung</SelectItem>
                <SelectItem value="Präsentiert">Präsentiert</SelectItem>
                <SelectItem value="Interview">Interview</SelectItem>
                <SelectItem value="Beauftragt">Beauftragt</SelectItem>
                <SelectItem value="Abgelehnt">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs ml-auto gap-1.5">
              <IconDownload className="size-3.5" />
              CV
            </Button>
          </div>

          <Separator />

          {/* Skills */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profil.skills.map((s) => (
                <span
                  key={s}
                  className="rounded border border-border bg-muted px-2 py-0.5 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Profiltext */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Profil
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {profil.profiltext}
            </p>
          </div>

          <Separator />

          {/* KI-Bewertung */}
          <Accordion type="single" collapsible>
            <AccordionItem value="ki" className="border-0">
              <AccordionTrigger className="py-0 hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">KI-Bewertung</span>
                  <ScoreBadge score={profil.ki.score} />
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${empfehlungColors[profil.ki.empfehlung]}`}
                  >
                    {profil.ki.empfehlung}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-3">
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {profil.ki.begruendung}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-green-700">
                        Skills vorhanden
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {profil.ki.skillsVorhanden.map((s) => (
                          <span
                            key={s}
                            className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700"
                          >
                            {s}
                          </span>
                        ))}
                        {profil.ki.skillsVorhanden.length === 0 && (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-red-700">
                        Skills fehlend
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {profil.ki.skillsFehlend.map((s) => (
                          <span
                            key={s}
                            className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-700"
                          >
                            {s}
                          </span>
                        ))}
                        {profil.ki.skillsFehlend.length === 0 && (
                          <span className="text-xs text-muted-foreground">Keine</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator />

          {/* Kommentare */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kommentare ({profil.kommentare.length})
            </p>
            <div className="flex flex-col gap-3">
              {profil.kommentare.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Noch keine Kommentare.
                </p>
              )}
              {profil.kommentare.map((k, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/40 p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">{k.autor}</span>
                    <span className="text-xs text-muted-foreground">
                      {k.zeit}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{k.text}</p>
                </div>
              ))}
            </div>

            {/* New Comment */}
            <div className="mt-4 flex gap-2">
              <Textarea
                className="min-h-[64px] text-sm resize-none"
                placeholder="Kommentar schreiben..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button
                size="icon"
                variant="outline"
                className="self-end"
                disabled={!newComment.trim()}
              >
                <IconSend className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function ProfilePage() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [vakanzFilter, setVakanzFilter] = React.useState("alle")
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [agenturFilter, setAgenturFilter] = React.useState("alle")
  const [selectedProfil, setSelectedProfil] = React.useState<Profil | null>(null)

  const vakanzen = [...new Set(mockProfile.map((p) => p.vakanz))]
  const agenturen = [...new Set(mockProfile.map((p) => p.agentur))]

  const filtered = mockProfile.filter((p) => {
    const matchesSearch =
      searchQuery === "" ||
      p.kandidat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vakanz.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesVakanz = vakanzFilter === "alle" || p.vakanz === vakanzFilter
    const matchesStatus = statusFilter === "alle" || p.status === statusFilter
    const matchesAgentur = agenturFilter === "alle" || p.agentur === agenturFilter
    return matchesSearch && matchesVakanz && matchesStatus && matchesAgentur
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
        <SiteHeader title="Profile" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Profile</h2>
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} Profile gefunden
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Kandidat suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={vakanzFilter} onValueChange={setVakanzFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Vakanz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Vakanzen</SelectItem>
                    {vakanzen.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Status</SelectItem>
                    <SelectItem value="Eingereicht">Eingereicht</SelectItem>
                    <SelectItem value="In Prüfung">In Prüfung</SelectItem>
                    <SelectItem value="Präsentiert">Präsentiert</SelectItem>
                    <SelectItem value="Interview">Interview</SelectItem>
                    <SelectItem value="Beauftragt">Beauftragt</SelectItem>
                    <SelectItem value="Abgelehnt">Abgelehnt</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={agenturFilter} onValueChange={setAgenturFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Agentur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Agenturen</SelectItem>
                    {agenturen.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Kandidat</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead>Agentur</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Verfügbar ab</TableHead>
                        <TableHead>KI-Score</TableHead>
                        <TableHead>KI-Empfehlung</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Keine Profile gefunden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((p) => (
                          <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedProfil(p)}
                          >
                            <TableCell className="font-medium">
                              {p.kandidat}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                              {p.vakanz}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {p.agentur}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {p.skills.slice(0, 3).map((s) => (
                                  <span
                                    key={s}
                                    className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {p.erfahrungslevel}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {p.verfuegbarAb}
                            </TableCell>
                            <TableCell>
                              <ScoreBadge score={p.ki.score} />
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${empfehlungColors[p.ki.empfehlung]}`}
                              >
                                {p.ki.empfehlung}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[p.status]}`}
                              >
                                {p.status}
                              </span>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
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
                                  <DropdownMenuItem
                                    onClick={() => setSelectedProfil(p)}
                                  >
                                    <IconMessageCircle className="size-4" />
                                    Kommentar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <IconDownload className="size-4" />
                                    CV herunterladen
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

      <ProfilDetailSheet
        profil={selectedProfil}
        open={selectedProfil !== null}
        onClose={() => setSelectedProfil(null)}
      />
    </SidebarProvider>
  )
}
