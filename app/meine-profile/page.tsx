"use client"

import * as React from "react"
import {
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconSend,
  IconX,
} from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
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

type ProfilStatus =
  | "Eingereicht"
  | "In Prüfung"
  | "Präsentiert"
  | "Interview"
  | "Beauftragt"
  | "Abgelehnt"

type KiEmpfehlung = "Empfohlen" | "Bedingt geeignet" | "Nicht geeignet"

interface MeinProfil {
  id: string
  kandidat: string
  vakanz: string
  status: ProfilStatus
  kiScore: number
  kiEmpfehlung: KiEmpfehlung
  eingereichtAm: string
  kommentareAnzahl: number
  kommentare: { autor: string; text: string; zeit: string }[]
}

const mockMeineProfile: MeinProfil[] = [
  {
    id: "1",
    kandidat: "M. Hoffmann",
    vakanz: "Senior React Developer",
    status: "Interview",
    kiScore: 87,
    kiEmpfehlung: "Empfohlen",
    eingereichtAm: "05.04.2026",
    kommentareAnzahl: 2,
    kommentare: [
      {
        autor: "Max Muster (Manager)",
        text: "Profil sieht stark aus. Interview für KW 16 geplant.",
        zeit: "10.04.2026, 14:32",
      },
      {
        autor: "TechTalents GmbH",
        text: "Kandidat ist flexibel bezüglich Starttermin.",
        zeit: "11.04.2026, 09:15",
      },
    ],
  },
  {
    id: "2",
    kandidat: "A. Wagner",
    vakanz: "Senior React Developer",
    status: "Beauftragt",
    kiScore: 92,
    kiEmpfehlung: "Empfohlen",
    eingereichtAm: "20.03.2026",
    kommentareAnzahl: 1,
    kommentare: [
      {
        autor: "Max Muster (Manager)",
        text: "Beauftragung bestätigt. Starttermin 01.04.2026.",
        zeit: "28.03.2026, 11:00",
      },
    ],
  },
  {
    id: "3",
    kandidat: "P. Richter",
    vakanz: "Data Scientist",
    status: "In Prüfung",
    kiScore: 85,
    kiEmpfehlung: "Empfohlen",
    eingereichtAm: "08.04.2026",
    kommentareAnzahl: 0,
    kommentare: [],
  },
  {
    id: "4",
    kandidat: "J. Klein",
    vakanz: "Cloud Architect",
    status: "Beauftragt",
    kiScore: 91,
    kiEmpfehlung: "Empfohlen",
    eingereichtAm: "15.01.2026",
    kommentareAnzahl: 0,
    kommentare: [],
  },
  {
    id: "5",
    kandidat: "S. Lang",
    vakanz: "DevOps Engineer",
    status: "Abgelehnt",
    kiScore: 42,
    kiEmpfehlung: "Nicht geeignet",
    eingereichtAm: "01.04.2026",
    kommentareAnzahl: 0,
    kommentare: [],
  },
  {
    id: "6",
    kandidat: "F. Werner",
    vakanz: "Backend Java Developer",
    status: "Eingereicht",
    kiScore: 68,
    kiEmpfehlung: "Bedingt geeignet",
    eingereichtAm: "11.04.2026",
    kommentareAnzahl: 0,
    kommentare: [],
  },
]

const openVakanzen = [
  "Senior React Developer",
  "Data Scientist",
  "DevOps Engineer",
  "Backend Java Developer",
  "UI/UX Designer",
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
        placeholder={value.length === 0 ? "Skill eingeben, Enter" : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function KommentarSheet({ profil }: { profil: MeinProfil }) {
  const [newComment, setNewComment] = React.useState("")
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          <IconMessageCircle className="size-3.5" />
          {profil.kommentareAnzahl > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
              {profil.kommentareAnzahl}
            </span>
          )}
          Kommentare
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Kommentare</SheetTitle>
          <SheetDescription>
            {profil.kandidat} – {profil.vakanz}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          {profil.kommentare.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
          )}
          {profil.kommentare.map((k, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium">{k.autor}</span>
                <span className="text-xs text-muted-foreground">{k.zeit}</span>
              </div>
              <p className="text-sm text-muted-foreground">{k.text}</p>
            </div>
          ))}
          <Separator />
          <div className="flex gap-2">
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
      </SheetContent>
    </Sheet>
  )
}

function ProfilEinreichenSheet() {
  const [skills, setSkills] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [cvFile, setCvFile] = React.useState<File | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.size > 10 * 1024 * 1024) {
      alert("Maximale Dateigröße: 10 MB")
      return
    }
    setCvFile(file ?? null)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <IconPlus className="size-4" />
          Profil einreichen
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Profil einreichen</SheetTitle>
          <SheetDescription>
            Reichen Sie einen Kandidaten für eine offene Vakanz ein.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-vakanz">Vakanz *</Label>
            <Select>
              <SelectTrigger id="p-vakanz">
                <SelectValue placeholder="Offene Vakanz wählen..." />
              </SelectTrigger>
              <SelectContent>
                {openVakanzen.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-kandidat">Kandidatenname *</Label>
            <Input id="p-kandidat" placeholder="Name oder Pseudonym" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-verfuegbar">Verfügbar ab *</Label>
              <Input id="p-verfuegbar" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-stunden">h/Woche *</Label>
              <Input id="p-stunden" type="number" placeholder="40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-preis">Verkaufspreis €/Tag *</Label>
              <Input id="p-preis" type="number" placeholder="750" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-level">Erfahrungslevel *</Label>
              <Select>
                <SelectTrigger id="p-level">
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
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Skills / Technologien *</Label>
            <TagInput value={skills} onChange={setSkills} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-beschreibung">Kurzbeschreibung *</Label>
            <Textarea
              id="p-beschreibung"
              placeholder="Erfahrungen, Stärken, Besonderheiten..."
              className="min-h-[80px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-cv">Lebenslauf (PDF, max. 10 MB) *</Label>
            <Input
              id="p-cv"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
            {cvFile && (
              <p className="text-xs text-muted-foreground">
                {cvFile.name} ({(cvFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-kommentar">Kommentar (optional)</Label>
            <Textarea
              id="p-kommentar"
              placeholder="Anmerkungen zur Einreichung..."
              className="min-h-[60px]"
            />
          </div>
        </div>
        <SheetFooter className="px-4 pb-4">
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
          <Button onClick={() => setOpen(false)}>Profil einreichen</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function MeineProfilePage() {
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [vakanzFilter, setVakanzFilter] = React.useState("alle")
  const [searchQuery, setSearchQuery] = React.useState("")

  const vakanzen = [...new Set(mockMeineProfile.map((p) => p.vakanz))]

  const filtered = mockMeineProfile.filter((p) => {
    const matchesStatus = statusFilter === "alle" || p.status === statusFilter
    const matchesVakanz = vakanzFilter === "alle" || p.vakanz === vakanzFilter
    const matchesSearch =
      searchQuery === "" ||
      p.kandidat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vakanz.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesVakanz && matchesSearch
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
        <SiteHeader title="Meine Profile" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    Meine eingereichten Profile
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    TechTalents GmbH · {filtered.length} Profile
                  </p>
                </div>
                <ProfilEinreichenSheet />
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
              </div>

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Kandidat</TableHead>
                        <TableHead>Vakanz</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>KI-Score</TableHead>
                        <TableHead>KI-Empfehlung</TableHead>
                        <TableHead>Eingereicht am</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Keine Profile gefunden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.kandidat}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                              {p.vakanz}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[p.status]}`}
                              >
                                {p.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ScoreBadge score={p.kiScore} />
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${empfehlungColors[p.kiEmpfehlung]}`}
                              >
                                {p.kiEmpfehlung}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {p.eingereichtAm}
                            </TableCell>
                            <TableCell>
                              <KommentarSheet profil={p} />
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
