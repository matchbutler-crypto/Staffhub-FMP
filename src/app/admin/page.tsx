"use client"

import * as React from "react"
import {
  IconDotsVertical,
  IconPlus,
  IconUserOff,
  IconUserCheck,
  IconKey,
} from "@tabler/icons-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Rolle = "Admin" | "Staffhub Manager" | "Agentur"

interface User {
  id: string
  name: string
  email: string
  rolle: Rolle
  agentur?: string
  aktiv: boolean
}

interface Agentur {
  id: string
  name: string
  kontakt: string
  userAnzahl: number
  profileAnzahl: number
  beauftragungen: number
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "Max Muster",
    email: "max.muster@staffhub.de",
    rolle: "Staffhub Manager",
    aktiv: true,
  },
  {
    id: "2",
    name: "Admin User",
    email: "admin@staffhub.de",
    rolle: "Admin",
    aktiv: true,
  },
  {
    id: "3",
    name: "Laura Schmidt",
    email: "l.schmidt@staffhub.de",
    rolle: "Staffhub Manager",
    aktiv: true,
  },
  {
    id: "4",
    name: "Klaus Weber",
    email: "k.weber@techtalents.de",
    rolle: "Agentur",
    agentur: "TechTalents GmbH",
    aktiv: true,
  },
  {
    id: "5",
    name: "Sandra Müller",
    email: "s.mueller@techtalents.de",
    rolle: "Agentur",
    agentur: "TechTalents GmbH",
    aktiv: false,
  },
  {
    id: "6",
    name: "Jan Becker",
    email: "j.becker@prostaff.de",
    rolle: "Agentur",
    agentur: "ProStaff AG",
    aktiv: true,
  },
  {
    id: "7",
    name: "Maria Fischer",
    email: "m.fischer@prostaff.de",
    rolle: "Agentur",
    agentur: "ProStaff AG",
    aktiv: true,
  },
  {
    id: "8",
    name: "Tom Richter",
    email: "t.richter@digital-experts.de",
    rolle: "Agentur",
    agentur: "Digital Experts",
    aktiv: true,
  },
]

const mockAgenturen: Agentur[] = [
  {
    id: "1",
    name: "TechTalents GmbH",
    kontakt: "k.weber@techtalents.de",
    userAnzahl: 2,
    profileAnzahl: 14,
    beauftragungen: 3,
  },
  {
    id: "2",
    name: "ProStaff AG",
    kontakt: "j.becker@prostaff.de",
    userAnzahl: 2,
    profileAnzahl: 11,
    beauftragungen: 3,
  },
  {
    id: "3",
    name: "Digital Experts",
    kontakt: "t.richter@digital-experts.de",
    userAnzahl: 1,
    profileAnzahl: 9,
    beauftragungen: 2,
  },
]

const rolleColors: Record<Rolle, string> = {
  Admin: "bg-red-100 text-red-700 border-red-200",
  "Staffhub Manager": "bg-blue-100 text-blue-700 border-blue-200",
  Agentur: "bg-purple-100 text-purple-700 border-purple-200",
}

function NeuerBenutzerSheet() {
  const [rolle, setRolle] = React.useState<string>("")
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <IconPlus className="size-4" />
          Neuer Benutzer
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[440px]">
        <SheetHeader>
          <SheetTitle>Neuen Benutzer anlegen</SheetTitle>
          <SheetDescription>
            Legen Sie einen neuen Benutzer an und weisen Sie eine Rolle zu.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-name">Name *</Label>
            <Input id="b-name" placeholder="Vor- und Nachname" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-email">E-Mail *</Label>
            <Input id="b-email" type="email" placeholder="name@beispiel.de" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-rolle">Rolle *</Label>
            <Select onValueChange={setRolle}>
              <SelectTrigger id="b-rolle">
                <SelectValue placeholder="Rolle wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Staffhub Manager">
                  Staffhub Manager
                </SelectItem>
                <SelectItem value="Agentur">Agentur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rolle === "Agentur" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-agentur">Agentur *</Label>
              <Select>
                <SelectTrigger id="b-agentur">
                  <SelectValue placeholder="Agentur wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TechTalents GmbH">
                    TechTalents GmbH
                  </SelectItem>
                  <SelectItem value="ProStaff AG">ProStaff AG</SelectItem>
                  <SelectItem value="Digital Experts">
                    Digital Experts
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-passwort">Passwort *</Label>
            <Input
              id="b-passwort"
              type="password"
              placeholder="Temporäres Passwort"
            />
          </div>
        </div>
        <SheetFooter className="px-4 pb-4">
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
          <Button onClick={() => setOpen(false)}>Benutzer erstellen</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function NeueAgenturSheet() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <IconPlus className="size-4" />
          Neue Agentur
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader>
          <SheetTitle>Neue Agentur anlegen</SheetTitle>
          <SheetDescription>
            Legen Sie eine neue Agentur an.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-name">Agentur-Name *</Label>
            <Input id="a-name" placeholder="z.B. TechTalents GmbH" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-kontakt">Kontakt-E-Mail *</Label>
            <Input
              id="a-kontakt"
              type="email"
              placeholder="kontakt@agentur.de"
            />
          </div>
        </div>
        <SheetFooter className="px-4 pb-4">
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
          <Button onClick={() => setOpen(false)}>Agentur erstellen</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function AdminPage() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Admin" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              <div className="px-4 lg:px-6">
                <h2 className="text-xl font-semibold">Administration</h2>
                <p className="text-sm text-muted-foreground">
                  Benutzer, Rollen und Agenturen verwalten
                </p>
              </div>

              <div className="px-4 lg:px-6">
                <Tabs defaultValue="benutzer">
                  <div className="flex items-center justify-between gap-4">
                    <TabsList>
                      <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
                      <TabsTrigger value="agenturen">Agenturen</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Benutzer Tab */}
                  <TabsContent value="benutzer" className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        {mockUsers.length} Benutzer
                      </p>
                      <NeuerBenutzerSheet />
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>E-Mail</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead>Agentur</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockUsers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">
                                {u.name}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {u.email}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${rolleColors[u.rolle]}`}
                                >
                                  {u.rolle}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {u.agentur ?? "–"}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                    u.aktiv
                                      ? "bg-green-100 text-green-700 border-green-200"
                                      : "bg-gray-100 text-gray-500 border-gray-200"
                                  }`}
                                >
                                  {u.aktiv ? "Aktiv" : "Inaktiv"}
                                </span>
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
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-48"
                                  >
                                    <DropdownMenuItem>
                                      Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <IconKey className="size-4" />
                                      Passwort zurücksetzen
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant={
                                        u.aktiv ? "destructive" : "default"
                                      }
                                    >
                                      {u.aktiv ? (
                                        <>
                                          <IconUserOff className="size-4" />
                                          Deaktivieren
                                        </>
                                      ) : (
                                        <>
                                          <IconUserCheck className="size-4" />
                                          Aktivieren
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* Agenturen Tab */}
                  <TabsContent value="agenturen" className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        {mockAgenturen.length} Agenturen
                      </p>
                      <NeueAgenturSheet />
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Agentur</TableHead>
                            <TableHead>Kontakt-E-Mail</TableHead>
                            <TableHead className="text-center">
                              Benutzer
                            </TableHead>
                            <TableHead className="text-center">
                              Profile
                            </TableHead>
                            <TableHead className="text-center">
                              Beauftragungen
                            </TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockAgenturen.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium">
                                {a.name}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {a.kontakt}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {a.userAnzahl}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {a.profileAnzahl}
                              </TableCell>
                              <TableCell className="text-center tabular-nums">
                                {a.beauftragungen}
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
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-36"
                                  >
                                    <DropdownMenuItem>
                                      Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive">
                                      Löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
