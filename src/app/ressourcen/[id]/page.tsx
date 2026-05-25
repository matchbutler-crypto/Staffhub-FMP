"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconArrowLeft,
  IconClock,
  IconFileText,
  IconPencil,
  IconUpload,
  IconUser,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import type { Rolle } from "@/context/user-context"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface Ressource {
  id: string
  ressource_code?: string | null
  name: string
  vorname: string
  nachname: string
  geburtsdatum: string
  email: string
  telefon: string
  wohnort: string
  agentur_id: string
  agentur_name: string
  verfuegbarkeit: string
  notizen: string
  erfahrungslevel: string
  skills: string[]
  created_at: string
  beauftragungen: Beauftragung[]
}

interface Beauftragung {
  id: string
  vakanz_nr: string
  vakanz_titel: string
  status: string
  startdatum: string
  enddatum: string | null
  agentur_name: string
}

interface Zeitnachweis {
  id: string
  datum: string
  stunden: number
  beschreibung: string
  hochgeladen_von: string
  created_at: string
}

const StammdatenSchema = z.object({
  vorname: z.string().min(1),
  nachname: z.string().min(1),
  geburtsdatum: z.string(),
  email: z.string().email(),
  telefon: z.string(),
  adresse: z.string(),
  notizen: z.string().optional(),
})

type StammdatenFormValues = z.infer<typeof StammdatenSchema>

function HeaderSection({ ressource }: { ressource: Ressource | null }) {
  if (!ressource) return null

  return (
    <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 px-8 py-8">
      <div className="absolute -right-40 -top-40 h-80 w-80 bg-gradient-to-br from-blue-200/30 to-transparent rounded-full blur-3xl" />
      <div className="relative flex items-start justify-between gap-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-base text-slate-600 font-medium">Ressource</span>
            {ressource.ressource_code && (
              <span className="font-mono text-sm bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                {ressource.ressource_code}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">
            {ressource.vorname} {ressource.nachname}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white">
                {ressource.agentur_name}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  ressource.verfuegbarkeit === "Jetzt verfügbar"
                    ? "bg-emerald-500"
                    : ressource.verfuegbarkeit === "Verfügbar ab"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                }`}
              />
              <span className="text-sm text-slate-600 capitalize">
                {ressource.verfuegbarkeit}
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email
              </div>
              <div className="text-sm text-slate-900 mt-1">{ressource.email}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Telefon
              </div>
              <div className="text-sm text-slate-900 mt-1">{ressource.telefon}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StammdatenTab({
  ressource,
  isAgentur,
  onUpdate,
}: {
  ressource: Ressource | null
  isAgentur: boolean
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<StammdatenFormValues>({
    resolver: zodResolver(StammdatenSchema),
    defaultValues: ressource
      ? {
          vorname: ressource.vorname,
          nachname: ressource.nachname,
          geburtsdatum: ressource.geburtsdatum,
          email: ressource.email,
          telefon: ressource.telefon,
          adresse: ressource.wohnort,
          notizen: ressource.notizen,
        }
      : undefined,
  })

  const onSubmit = async (data: StammdatenFormValues) => {
    if (!ressource) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/ressourcen/${ressource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error("Update failed")

      toast.success("Stammdaten aktualisiert")
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast.error("Fehler beim Speichern")
    } finally {
      setIsSaving(false)
    }
  }

  if (!ressource) return null

  return (
    <div className="space-y-6 p-6">
      {isEditing ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Vorname</Label>
              <Controller
                control={control}
                name="vorname"
                render={({ field }) => <Input {...field} className="mt-1" />}
              />
            </div>
            <div>
              <Label>Nachname</Label>
              <Controller
                control={control}
                name="nachname"
                render={({ field }) => <Input {...field} className="mt-1" />}
              />
            </div>
            <div>
              <Label>Geburtsdatum</Label>
              <Controller
                control={control}
                name="geburtsdatum"
                render={({ field }) => <Input {...field} type="date" className="mt-1" />}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Controller
                control={control}
                name="email"
                render={({ field }) => <Input {...field} type="email" className="mt-1" />}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Controller
                control={control}
                name="telefon"
                render={({ field }) => <Input {...field} className="mt-1" />}
              />
            </div>
            <div>
              <Label>Adresse</Label>
              <Controller
                control={control}
                name="adresse"
                render={({ field }) => <Input {...field} className="mt-1" />}
              />
            </div>
          </div>
          <div>
            <Label>Notizen</Label>
            <Controller
              control={control}
              name="notizen"
              render={({ field }) => <Textarea {...field} className="mt-1" rows={4} />}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!isDirty || isSaving} className="gap-2">
              {isSaving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />}
              Speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditing(false)
                reset()
              }}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      ) : (
        <>
          {isAgentur && (
            <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
              <IconPencil className="h-4 w-4" /> Bearbeiten
            </Button>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <DetailRow label="Vorname" value={ressource.vorname} />
              <DetailRow label="Nachname" value={ressource.nachname} />
              <DetailRow label="Geburtsdatum" value={ressource.geburtsdatum} />
              <DetailRow label="Email" value={ressource.email} />
            </div>
            <div className="space-y-4">
              <DetailRow label="Telefon" value={ressource.telefon} />
              <DetailRow label="Adresse" value={ressource.wohnort} />
              <DetailRow label="Erfahrungslevel" value={ressource.erfahrungslevel} />
              <DetailRow label="Erstellt" value={new Date(ressource.created_at).toLocaleDateString("de-DE")} />
            </div>
          </div>
          {ressource.notizen && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm">Notizen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{ressource.notizen}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function BeauftragungTab({ beauftragungen }: { beauftragungen: Beauftragung[] }) {
  const statusColors: Record<string, string> = {
    interessent: "bg-slate-100 text-slate-800",
    anfrage: "bg-blue-100 text-blue-800",
    vereinbart: "bg-purple-100 text-purple-800",
    aktiv: "bg-emerald-100 text-emerald-800",
    abgeschlossen: "bg-slate-100 text-slate-800",
    abgelehnt: "bg-red-100 text-red-800",
  }

  return (
    <div className="p-6">
      {beauftragungen.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <IconFileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-sm text-slate-600">Keine Beauftragungen vorhanden</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vakanz</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Startdatum</TableHead>
                <TableHead>Enddatum</TableHead>
                <TableHead>Agentur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beauftragungen.map((b) => (
                <TableRow key={b.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{b.vakanz_nr}</TableCell>
                  <TableCell>{b.vakanz_titel}</TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[b.status] || "bg-slate-100 text-slate-800"}`}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(b.startdatum).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    {b.enddatum ? new Date(b.enddatum).toLocaleDateString("de-DE") : "–"}
                  </TableCell>
                  <TableCell>{b.agentur_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function VerfuegbarkeitTab({
  ressource,
  isAgentur,
  onUpdate,
}: {
  ressource: Ressource | null
  isAgentur: boolean
  onUpdate: () => void
}) {
  const [status, setStatus] = React.useState(ressource?.verfuegbarkeit || "")
  const [isSaving, setIsSaving] = React.useState(false)

  const handleStatusChange = async (newStatus: string) => {
    if (!ressource) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/ressourcen/${ressource.id}/verfuegbarkeit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verfuegbarkeit: newStatus }),
      })

      if (!response.ok) throw new Error("Update failed")

      setStatus(newStatus)
      toast.success("Verfügbarkeitsstatus aktualisiert")
      onUpdate()
    } catch (error) {
      toast.error("Fehler beim Aktualisieren")
    } finally {
      setIsSaving(false)
    }
  }

  if (!ressource) return null

  return (
    <div className="p-6">
      <Card className="border-slate-200 max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Verfügbarkeitsstatus</CardTitle>
          <CardDescription>
            {isAgentur ? "Status kann hier geändert werden" : "Nur die zuständige Agentur kann diesen Status ändern"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAgentur ? (
            <Select value={status} onValueChange={handleStatusChange} disabled={isSaving}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Jetzt verfügbar">Verfügbar</SelectItem>
                <SelectItem value="Verfügbar ab">Verfügbar ab</SelectItem>
                <SelectItem value="Nicht verfügbar">Nicht verfügbar</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="mt-2 inline-block">
              <Badge variant="outline" className="text-base py-1 px-3">
                {status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ZeitnachweisTab({
  ressource,
  zeitnachweise,
  onUpdate,
}: {
  ressource: Ressource | null
  zeitnachweise: Zeitnachweis[]
  onUpdate: () => void
}) {
  const totalStunden = zeitnachweise.reduce((sum, z) => sum + z.stunden, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Zeitnachweise</h3>
          <p className="text-sm text-slate-600 mt-1">
            Insgesamt: <span className="font-semibold">{totalStunden} Stunden</span>
          </p>
        </div>
        <Button className="gap-2">
          <IconUpload className="h-4 w-4" /> Hochladen
        </Button>
      </div>

      {zeitnachweise.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <IconFileText className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-sm text-slate-600">Keine Zeitnachweise vorhanden</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Stunden</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Hochgeladen von</TableHead>
                <TableHead>Erstellt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zeitnachweise.map((z) => (
                <TableRow key={z.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">
                    {new Date(z.datum).toLocaleDateString("de-DE")}
                  </TableCell>
                  <TableCell>{z.stunden}h</TableCell>
                  <TableCell className="text-slate-600">{z.beschreibung}</TableCell>
                  <TableCell>{z.hochgeladen_von}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(z.created_at).toLocaleDateString("de-DE")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-slate-900 mt-1.5">{value || "–"}</div>
    </div>
  )
}

export default function RessourceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = React.useState("stammdaten")
  const [ressource, setRessource] = React.useState<Ressource | null>(null)
  const [zeitnachweise, setZeitnachweise] = React.useState<Zeitnachweis[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(async () => {
    if (!params.id) return
    try {
      const [ressourceRes, zeitnachweiseRes] = await Promise.all([
        fetch(`/api/ressourcen/${params.id}`),
        fetch(`/api/ressourcen/${params.id}/zeitnachweise`),
      ])

      if (ressourceRes.ok) {
        setRessource(await ressourceRes.json())
      }
      if (zeitnachweiseRes.ok) {
        setZeitnachweise(await zeitnachweiseRes.json())
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Fehler beim Laden der Daten")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const isManager = user?.rolle === "Admin" || user?.rolle === "Staffhub Manager"
  const isAgentur = isManager || (user?.rolle === "Agentur" && user?.agentur_id === ressource?.agentur_id)

  if (userLoading || loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center h-96">
            <IconLoader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex-1 overflow-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="m-4 gap-2 text-slate-600"
          >
            <IconArrowLeft className="h-4 w-4" /> Zurück
          </Button>

          <HeaderSection ressource={ressource} />

          <div className="px-8 py-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-4 bg-slate-100 p-1">
                <TabsTrigger value="stammdaten" className="text-xs md:text-sm">
                  <IconUser className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Stammdaten</span>
                  <span className="sm:hidden">Daten</span>
                </TabsTrigger>
                <TabsTrigger value="beauftragungen" className="text-xs md:text-sm">
                  <IconFileText className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Beauftragungen</span>
                  <span className="sm:hidden">B.</span>
                </TabsTrigger>
                <TabsTrigger value="verfuegbarkeit" className="text-xs md:text-sm">
                  <IconCheck className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Verfügbarkeit</span>
                  <span className="sm:hidden">V.</span>
                </TabsTrigger>
                <TabsTrigger value="zeitnachweise" className="text-xs md:text-sm">
                  <IconClock className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Zeitnachweise</span>
                  <span className="sm:hidden">Zeit</span>
                </TabsTrigger>
              </TabsList>

              <div className="mt-6 animate-in fade-in-50 duration-300">
                <TabsContent value="stammdaten" className="mt-0">
                  <StammdatenTab ressource={ressource} isAgentur={isAgentur} onUpdate={loadData} />
                </TabsContent>

                <TabsContent value="beauftragungen" className="mt-0">
                  <BeauftragungTab beauftragungen={ressource?.beauftragungen || []} />
                </TabsContent>

                <TabsContent value="verfuegbarkeit" className="mt-0">
                  <VerfuegbarkeitTab ressource={ressource} isAgentur={isAgentur} onUpdate={loadData} />
                </TabsContent>

                <TabsContent value="zeitnachweise" className="mt-0">
                  <ZeitnachweisTab ressource={ressource} zeitnachweise={zeitnachweise} onUpdate={loadData} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
