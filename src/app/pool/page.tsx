"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconBrain,
  IconChevronDown,
  IconClock,
  IconDownload,
  IconDotsVertical,
  IconFileText,
  IconLink,
  IconMessage,
  IconPencil,
  IconPlus,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { ERFAHRUNGSLEVEL, RESSOURCE_VERFUEGBARKEIT } from "@/lib/constants"
import type { Erfahrungslevel, RessourceVerfuegbarkeit } from "@/lib/constants"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TagInput } from "@/components/tag-input"
import { ResourcePoolFormSheet } from "@/components/resource-pool-form-sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
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
import { isResourceUnavailable, type Beauftragung } from "@/lib/resource-availability"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agentur {
  id: string
  name: string
}

interface Ressource {
  id: string
  agentur_id: string
  name: string
  rolle?: string | null
  skills: string[]
  erfahrungslevel: Erfahrungslevel
  verfuegbarkeit: RessourceVerfuegbarkeit
  verfuegbar_ab?: string | null
  cv_pfad?: string | null
  ek_tagesrate?: number | null
  notizen?: string | null
  link_count?: number
  hat_beauftragt_link?: boolean
  arbeitsmodell?: string | null
  location?: string | null
  // Stammdaten
  nachname?: string | null
  vorname?: string | null
  geburtsdatum?: string | null
  geschlecht?: string | null
  firma?: string | null
  email_geschaeftlich?: string | null
  telefon_geschaeftlich?: string | null
  wohnort?: string | null
  namenszusatz?: string | null
  titel?: string | null
  created_at: string
  updated_at: string
  agenturen?: { name: string } | null
}

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const ressourceSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich").max(200),
    rolle: z.string().max(200).optional(),
    skills: z.array(z.string()).min(1, "Mindestens ein Skill erforderlich"),
    erfahrungslevel: z.enum(ERFAHRUNGSLEVEL, {
      required_error: "Erfahrungslevel ist erforderlich",
    }),
    verfuegbarkeit: z.enum(RESSOURCE_VERFUEGBARKEIT, {
      required_error: "Verfügbarkeitsstatus ist erforderlich",
    }),
    verfuegbar_ab: z.string().nullable().optional(),
    ek_tagesrate: z
      .number({ invalid_type_error: "Muss eine Zahl sein" })
      .positive()
      .nullable()
      .optional(),
    notizen: z.string().max(2000).nullable().optional(),
    arbeitsmodell: z.enum(['Onshore', 'Nearshore', 'Offshore']).optional(),
    location: z.string().max(200).optional(),
  })
  .refine(
    (d) => d.verfuegbarkeit !== "Verfügbar ab" || !!d.verfuegbar_ab,
    { message: 'Datum erforderlich wenn "Verfügbar ab"', path: ["verfuegbar_ab"] }
  )

type RessourceFormData = z.infer<typeof ressourceSchema>

// ── Color maps ─────────────────────────────────────────────────────────────────

const verfuegbarkeitColors: Record<RessourceVerfuegbarkeit, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-green-100 text-green-700 border-green-200",
  "Nicht verfügbar": "bg-orange-100 text-orange-700 border-orange-200",
  Deaktiviert: "bg-gray-100 text-gray-500 border-gray-200",
}

const verfuegbarkeitLabel: Record<RessourceVerfuegbarkeit, string> = {
  "Jetzt verfügbar": "Verfügbar",
  "Verfügbar ab": "Verfügbar",
  "Nicht verfügbar": "Nicht verfügbar",
  Deaktiviert: "Deaktiviert",
}

const erfahrungsColors: Record<Erfahrungslevel, string> = {
  Junior: "bg-sky-100 text-sky-700 border-sky-200",
  Mid: "bg-violet-100 text-violet-700 border-violet-200",
  Senior: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Expert: "bg-rose-100 text-rose-700 border-rose-200",
}

// ── SkillTags ──────────────────────────────────────────────────────────────────

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

// ── RessourceFormSheet ─────────────────────────────────────────────────────────

interface RessourceFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  ressource?: Ressource | null
  onSuccess: () => void
  isAdmin?: boolean
  agenturen?: Agentur[]
}

function RessourceFormSheet({
  open,
  onOpenChange,
  mode,
  ressource,
  onSuccess,
  isAdmin,
  agenturen = [],
}: RessourceFormSheetProps) {
  const [saving, setSaving] = React.useState(false)
  const [adminAgenturId, setAdminAgenturId] = React.useState("")
  const [cvFile, setCvFile] = React.useState<File | null>(null)
  const [uploadingCv, setUploadingCv] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RessourceFormData>({
    resolver: zodResolver(ressourceSchema),
    defaultValues: {
      name: "",
      rolle: "",
      skills: [],
      erfahrungslevel: undefined,
      verfuegbarkeit: undefined,
      verfuegbar_ab: null,
      ek_tagesrate: null,
      notizen: "",
    },
  })

  React.useEffect(() => {
    if (open) {
      setCvFile(null)
      setAdminAgenturId("")
      if (mode === "edit" && ressource) {
        reset({
          name: ressource.name,
          rolle: ressource.rolle ?? "",
          skills: ressource.skills,
          erfahrungslevel: ressource.erfahrungslevel,
          verfuegbarkeit: ressource.verfuegbarkeit,
          verfuegbar_ab: ressource.verfuegbar_ab ?? null,
          ek_tagesrate: ressource.ek_tagesrate ?? null,
          notizen: ressource.notizen ?? "",
          arbeitsmodell: (ressource.arbeitsmodell as 'Onshore' | 'Nearshore' | 'Offshore') ?? 'Onshore',
          location: ressource.location ?? "",
        })
        if (isAdmin) setAdminAgenturId(ressource.agentur_id)
      } else {
        reset({
          name: "",
          rolle: "",
          skills: [],
          erfahrungslevel: undefined,
          verfuegbarkeit: undefined,
          verfuegbar_ab: null,
          ek_tagesrate: null,
          notizen: "",
          arbeitsmodell: 'Onshore',
          location: "",
        })
      }
    }
  }, [open, mode, ressource, reset, isAdmin])

  async function onSubmit(data: RessourceFormData) {
    if (isAdmin && mode === "create" && !adminAgenturId) {
      toast.error("Bitte eine Agentur auswählen.")
      return
    }
    setSaving(true)
    try {
      const url =
        mode === "create" ? "/api/ressourcen" : `/api/ressourcen/${ressource!.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          rolle: data.rolle || null,
          skills: data.skills,
          erfahrungslevel: data.erfahrungslevel,
          verfuegbarkeit: data.verfuegbarkeit,
          verfuegbar_ab:
            data.verfuegbarkeit === "Verfügbar ab" ? data.verfuegbar_ab : null,
          ek_tagesrate: data.ek_tagesrate ?? null,
          notizen: data.notizen || null,
          arbeitsmodell: data.arbeitsmodell ?? 'Onshore',
          location: data.location || null,
          ...(isAdmin && mode === "create" ? { agentur_id: adminAgenturId } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Unbekannter Fehler")
      }

      const created = await res.json()
      const ressourceId =
        mode === "create" ? created.ressource.id : ressource!.id

      // Upload CV if selected
      if (cvFile) {
        setUploadingCv(true)
        try {
          const form = new FormData()
          form.append("cv", cvFile)
          const cvRes = await fetch(`/api/ressourcen/${ressourceId}/cv`, {
            method: "POST",
            body: form,
          })
          if (!cvRes.ok) {
            const err = await cvRes.json().catch(() => ({}))
            toast.warning(`Ressource gespeichert, aber CV-Upload fehlgeschlagen: ${err.error ?? "Unbekannt"}`)
          }
        } finally {
          setUploadingCv(false)
        }
      }

      toast.success(mode === "create" ? "Ressource angelegt" : "Ressource aktualisiert")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(
        `Fehler beim Speichern.${err instanceof Error ? ` (${err.message})` : ""}`
      )
    } finally {
      setSaving(false)
    }
  }

  const watchedVerfuegbarkeit = watch("verfuegbarkeit")
  const skills = watch("skills")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[480px] flex-col gap-0 overflow-hidden p-0 sm:w-[540px]"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {mode === "create" ? "Neue Ressource anlegen" : "Ressource bearbeiten"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Fügen Sie einen Freelancer zu Ihrem Pool hinzu."
              : "Aktualisieren Sie die Ressource-Details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">

              {/* Agentur-Auswahl (nur Admin, nur beim Erstellen) */}
              {isAdmin && mode === "create" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-agentur">
                    Agentur <span className="text-destructive">*</span>
                  </Label>
                  <Select value={adminAgenturId} onValueChange={setAdminAgenturId}>
                    <SelectTrigger
                      id="r-agentur"
                      className={!adminAgenturId ? "border-muted-foreground/30" : ""}
                    >
                      <SelectValue placeholder="Agentur wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {agenturen.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Die Ressource wird dem Pool dieser Agentur zugewiesen.
                  </p>
                </div>
              )}

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-name">
                  Name / Pseudonym <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="r-name"
                  placeholder="z.B. Max M. oder Freelancer-42"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Rolle */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-rolle">Rolle / Jobtitel</Label>
                <Input
                  id="r-rolle"
                  placeholder="z.B. Frontend Developer, Data Engineer"
                  {...register("rolle")}
                />
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-1.5">
                <Label>
                  Skills <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="skills"
                  render={({ field }) => (
                    <TagInput
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.skills?.message}
                      placeholder="Skill eingeben, Enter drücken"
                      maxTags={30}
                    />
                  )}
                />
              </div>

              {/* Erfahrungslevel + Verfügbarkeit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-level">
                    Erfahrungslevel <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="erfahrungslevel"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="r-level"
                          className={errors.erfahrungslevel ? "border-destructive" : ""}
                        >
                          <SelectValue placeholder="Wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ERFAHRUNGSLEVEL.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.erfahrungslevel && (
                    <p className="text-xs text-destructive">
                      {errors.erfahrungslevel.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-verfueg">
                    Verfügbarkeit <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="verfuegbarkeit"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="r-verfueg"
                          className={errors.verfuegbarkeit ? "border-destructive" : ""}
                        >
                          <SelectValue placeholder="Wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {RESSOURCE_VERFUEGBARKEIT.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.verfuegbarkeit && (
                    <p className="text-xs text-destructive">
                      {errors.verfuegbarkeit.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Verfügbar ab (conditional) */}
              {watchedVerfuegbarkeit === "Verfügbar ab" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-ab">
                    Verfügbar ab <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="r-ab"
                    type="date"
                    {...register("verfuegbar_ab")}
                    className={errors.verfuegbar_ab ? "border-destructive" : ""}
                  />
                  {errors.verfuegbar_ab && (
                    <p className="text-xs text-destructive">
                      {errors.verfuegbar_ab.message}
                    </p>
                  )}
                </div>
              )}

              {/* EK-Tagesrate */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-ek">EK-Tagesrate (€/Tag)</Label>
                <Controller
                  control={control}
                  name="ek_tagesrate"
                  render={({ field }) => (
                    <Input
                      id="r-ek"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="optional"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : parseFloat(e.target.value)
                        )
                      }
                    />
                  )}
                />
              </div>

              {/* Arbeitsmodell + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-arbeitsmodell">Arbeitsmodell</Label>
                  <Controller
                    control={control}
                    name="arbeitsmodell"
                    render={({ field }) => (
                      <Select value={field.value ?? 'Onshore'} onValueChange={field.onChange}>
                        <SelectTrigger id="r-arbeitsmodell">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Onshore">Onshore</SelectItem>
                          <SelectItem value="Nearshore">Nearshore</SelectItem>
                          <SelectItem value="Offshore">Offshore</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="r-location">Location</Label>
                  <Input
                    id="r-location"
                    placeholder="z.B. München, Remote"
                    {...register("location")}
                  />
                </div>
              </div>

              {/* CV Upload */}
              <div className="flex flex-col gap-1.5">
                <Label>CV / Lebenslauf (PDF)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconUpload className="size-4" />
                    {cvFile ? cvFile.name : mode === "edit" && ressource?.cv_pfad ? "CV ersetzen" : "PDF auswählen"}
                  </Button>
                  {cvFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCvFile(null)}
                    >
                      Entfernen
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      if (f.type !== "application/pdf") {
                        toast.error("Nur PDF-Dateien erlaubt")
                        return
                      }
                      if (f.size > 10 * 1024 * 1024) {
                        toast.error("Datei zu groß (max. 10 MB)")
                        return
                      }
                      setCvFile(f)
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Max. 10 MB, nur PDF</p>
              </div>

              {/* Notizen */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="r-notizen">Notizen (intern)</Label>
                <Textarea
                  id="r-notizen"
                  placeholder="Interne Notizen zur Ressource…"
                  className="min-h-[80px]"
                  {...register("notizen")}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || uploadingCv}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || uploadingCv}>
              {saving
                ? "Speichern…"
                : uploadingCv
                ? "CV wird hochgeladen…"
                : mode === "create"
                ? "Ressource anlegen"
                : "Speichern"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── DeaktivierenDialog ─────────────────────────────────────────────────────────

interface DeaktivierenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ressource: Ressource | null
  onSuccess: () => void
}

function DeaktivierenDialog({
  open,
  onOpenChange,
  ressource,
  onSuccess,
}: DeaktivierenDialogProps) {
  const [loading, setLoading] = React.useState(false)

  async function handleConfirm() {
    if (!ressource) return
    setLoading(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verfuegbarkeit: "Deaktiviert" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Unbekannter Fehler")
      }
      toast.success(`"${ressource.name}" deaktiviert`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Deaktivieren")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ressource deaktivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            {ressource && (
              <>
                <span className="font-medium text-foreground">
                  &ldquo;{ressource.name}&rdquo;
                </span>{" "}
                wird auf &ldquo;Deaktiviert&rdquo; gesetzt und in der Standardansicht
                ausgeblendet. Die Ressource bleibt erhalten und kann jederzeit
                reaktiviert werden.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deaktivieren…" : "Deaktivieren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Link / Historie types ──────────────────────────────────────────────────────

type LinkStatus =
  | "Gespielt"
  | "Interview geplant"
  | "Zugesagt"
  | "Beauftragt"
  | "Abgesagt"
  | "Abgelehnt"
  | "Zurückgezogen"

interface VakanzLink {
  id: string
  vakanz_id: string
  status: LinkStatus
  interview_datum: string | null
  created_at: string
  vakanzen_data: {
    id: string
    rolle: string
    status: string
    erfahrungslevel?: string | null
    arbeitsmodell?: string | null
    standort?: string | null
    branche?: string | null
    startdatum?: string | null
    enddatum?: string | null
  } | null
}

interface HistorieEintrag {
  id: string
  typ: "system" | "manuell"
  text: string
  created_at: string
}

interface PoolFeedback {
  id: string
  text: string
  bewertung: number | null
  created_at: string
  vakanz_id: string | null
  vakanzen_data: { id: string; rolle: string } | null
  profiles: { id: string; name: string; rolle: string } | null
}

const linkStatusColors: Record<LinkStatus, string> = {
  Gespielt: "bg-blue-100 text-blue-700 border-blue-200",
  "Interview geplant": "bg-amber-100 text-amber-700 border-amber-200",
  Zugesagt: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Beauftragt: "bg-teal-100 text-teal-700 border-teal-200",
  Abgesagt: "bg-gray-100 text-gray-500 border-gray-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
  Zurückgezogen: "bg-gray-100 text-gray-400 border-gray-200",
}

const RUECKZUG_ERLAUBT: LinkStatus[] = ["Gespielt"]

const PFLICHTFELDER_STAMMDATEN = [
  'nachname', 'vorname', 'geburtsdatum', 'geschlecht',
  'firma', 'email_geschaeftlich', 'telefon_geschaeftlich', 'wohnort',
] as const

function stammdatenAusstehend(r: Ressource): boolean {
  if (!r.hat_beauftragt_link) return false
  return PFLICHTFELDER_STAMMDATEN.some((f) => !r[f])
}

// ── KI-Score Types ─────────────────────────────────────────────────────────────

interface KiScore {
  id: string
  score: number
  empfehlung: "Empfohlen" | "Bedingt geeignet" | "Nicht geeignet"
  begruendung: string
  skill_vorhanden: string[]
  skill_fehlend: string[]
  model: string
  berechnet_am: string
}

interface VakanzOption {
  id: string
  rolle: string
  titel: string
}

const empfehlungColors: Record<KiScore["empfehlung"], string> = {
  "Empfohlen": "bg-green-100 text-green-700 border-green-200",
  "Bedingt geeignet": "bg-amber-100 text-amber-700 border-amber-200",
  "Nicht geeignet": "bg-red-100 text-red-700 border-red-200",
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600"
  if (score >= 40) return "text-amber-600"
  return "text-red-600"
}

// ── RueckzugDialog ────────────────────────────────────────────────────────────

interface RueckzugDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  linkId: string
  vakanzRolle: string
  onSuccess: () => void
}

function RueckzugDialog({ open, onOpenChange, linkId, vakanzRolle, onSuccess }: RueckzugDialogProps) {
  const [grund, setGrund] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) setGrund("")
  }, [open])

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ressource-links/${linkId}/rueckzug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund: grund.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 409) {
          throw new Error("Rückzug nicht mehr möglich — Status wurde bereits geändert.")
        }
        throw new Error(err.error ?? "Unbekannter Fehler")
      }
      toast.success(`Einreichung für „${vakanzRolle}" zurückgezogen`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Zurückziehen")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Einreichung zurückziehen?</AlertDialogTitle>
          <AlertDialogDescription>
            Die Ressource wird aus der Vakanz{" "}
            <span className="font-medium text-foreground">„{vakanzRolle}"</span>{" "}
            zurückgezogen. Dieser Schritt kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5 px-1 pb-2">
          <Label htmlFor="rueckzug-grund" className="text-sm">
            Grund (optional)
          </Label>
          <Textarea
            id="rueckzug-grund"
            placeholder="z.B. Ressource nicht mehr verfügbar…"
            className="min-h-[80px]"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            maxLength={500}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Zurückziehen…" : "Zurückziehen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── ProfilEinreichenDialog ─────────────────────────────────────────────────────

interface ProfilEinreichenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ressource: Ressource | null
  onSuccess: () => void
}

function ProfilEinreichenDialog({ open, onOpenChange, ressource, onSuccess }: ProfilEinreichenDialogProps) {
  const [vakanzen, setVakanzen] = React.useState<VakanzOption[]>([])
  const [loadingVakanzen, setLoadingVakanzen] = React.useState(false)
  const [vakanzId, setVakanzId] = React.useState("")
  const [verfuegbarkeit, setVerfuegbarkeit] = React.useState("")
  const [verfuegbarAb, setVerfuegbarAb] = React.useState("")
  const [verkaufspreis, setVerkaufspreis] = React.useState("")
  const [profiltext, setProfiltext] = React.useState("")
  const [kommentar, setKommentar] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [kiHint, setKiHint] = React.useState<KiScore | null>(null)
  const [kiHintLoading, setKiHintLoading] = React.useState(false)

  React.useEffect(() => {
    if (!vakanzId || !ressource) { setKiHint(null); return }
    setKiHintLoading(true)
    fetch(`/api/ressourcen/${ressource.id}/ki-match?vakanz_id=${vakanzId}`)
      .then((r) => r.json())
      .then((d) => setKiHint(d.score ?? null))
      .catch(() => setKiHint(null))
      .finally(() => setKiHintLoading(false))
  }, [vakanzId, ressource?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open) {
      setVakanzId("")
      setKiHint(null)
      setVerfuegbarkeit("")
      setVerfuegbarAb("")
      setVerkaufspreis("")
      setProfiltext("")
      setKommentar("")
      return
    }
    if (ressource?.verfuegbar_ab) {
      setVerfuegbarAb(ressource.verfuegbar_ab.slice(0, 10))
    }
    setLoadingVakanzen(true)
    fetch("/api/vakanzen")
      .then((r) => r.json())
      .then((d) => setVakanzen((d.vakanzen ?? []).filter((v: VakanzOption) => (v as unknown as { status: string }).status === "Offen")))
      .catch(() => toast.error("Vakanzen konnten nicht geladen werden"))
      .finally(() => setLoadingVakanzen(false))
  }, [open, ressource])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ressource || !vakanzId || !verfuegbarkeit || !verfuegbarAb || !verkaufspreis || !profiltext) return
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vakanz_id: vakanzId,
          kandidatenname: ressource.name,
          verfuegbarkeit_stunden: parseInt(verfuegbarkeit, 10),
          verfuegbar_ab: verfuegbarAb,
          verkaufspreis: parseFloat(verkaufspreis),
          skills: ressource.skills,
          erfahrungslevel: ressource.erfahrungslevel,
          profiltext,
          kommentar_agentur: kommentar || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      toast.success(`Profil für „${ressource.name}" eingereicht`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Einreichen")
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = !!vakanzId && !!verfuegbarkeit && !!verfuegbarAb && !!verkaufspreis && !!profiltext

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profil einreichen</DialogTitle>
          <DialogDescription>
            Ressource „{ressource?.name}" auf eine offene Vakanz einreichen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Vakanz */}
          <div className="flex flex-col gap-1.5">
            <Label>Vakanz <span className="text-destructive">*</span></Label>
            {loadingVakanzen ? (
              <Skeleton className="h-9 w-full" />
            ) : vakanzen.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Vakanzen vorhanden.</p>
            ) : (
              <Select value={vakanzId} onValueChange={setVakanzId}>
                <SelectTrigger><SelectValue placeholder="Vakanz wählen…" /></SelectTrigger>
                <SelectContent>
                  {vakanzen.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.titel || v.rolle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* KI-Score Hint */}
          {vakanzId && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
              {kiHintLoading ? (
                <Skeleton className="h-4 w-2/3" />
              ) : kiHint ? (
                <div className="flex items-center gap-2">
                  <IconBrain className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">
                    KI-Score:{" "}
                    <span className={`font-semibold ${scoreColor(kiHint.score)}`}>
                      {kiHint.score}/100
                    </span>
                  </span>
                  <Badge variant="outline" className={`ml-auto text-xs ${empfehlungColors[kiHint.empfehlung]}`}>
                    {kiHint.empfehlung}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <IconBrain className="size-3.5 shrink-0" />
                  Noch kein KI-Score für diese Vakanz. Im Pool-Detail berechnen.
                </div>
              )}
            </div>
          )}

          {/* Verfügbarkeit Stunden */}
          <div className="flex flex-col gap-1.5">
            <Label>Verfügbarkeit (h/Woche) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min="1"
              max="40"
              placeholder="z.B. 40"
              value={verfuegbarkeit}
              onChange={(e) => setVerfuegbarkeit(e.target.value)}
            />
          </div>

          {/* Verfügbar ab */}
          <div className="flex flex-col gap-1.5">
            <Label>Verfügbar ab <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={verfuegbarAb}
              onChange={(e) => setVerfuegbarAb(e.target.value)}
            />
          </div>

          {/* Verkaufspreis */}
          <div className="flex flex-col gap-1.5">
            <Label>VK-Tagesrate (€/Tag) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              placeholder="z.B. 850"
              value={verkaufspreis}
              onChange={(e) => setVerkaufspreis(e.target.value)}
            />
          </div>

          {/* Profiltext */}
          <div className="flex flex-col gap-1.5">
            <Label>Profil-Beschreibung <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Kurzbeschreibung des Kandidaten…"
              className="min-h-[100px]"
              value={profiltext}
              onChange={(e) => setProfiltext(e.target.value)}
              maxLength={5000}
            />
          </div>

          {/* Kommentar */}
          <div className="flex flex-col gap-1.5">
            <Label>Kommentar (optional)</Label>
            <Textarea
              placeholder="Interne Notiz an den Manager…"
              className="min-h-[60px]"
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              maxLength={2000}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Skills und Erfahrungslevel werden automatisch aus dem Pool übernommen.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || !canSubmit || loadingVakanzen}>
              {saving ? "Einreichen…" : "Profil einreichen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── PoolStarRating ─────────────────────────────────────────────────────────────

function PoolStarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number | null
  onChange?: (v: number | null) => void
  readonly?: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          className={readonly ? "cursor-default" : "cursor-pointer"}
          onClick={() => {
            if (readonly || !onChange) return
            onChange(value === n ? null : n)
          }}
        >
          {value != null && n <= value ? (
            <IconStarFilled className="size-4 text-amber-400" />
          ) : (
            <IconStar className="size-4 text-muted-foreground/40" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── PoolFeedbackTab ────────────────────────────────────────────────────────────

function PoolFeedbackTab({ ressourceId }: { ressourceId: string }) {
  const [feedbacks, setFeedbacks] = React.useState<PoolFeedback[]>([])
  const [loading, setLoading] = React.useState(true)
  const [text, setText] = React.useState("")
  const [bewertung, setBewertung] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function loadFeedback() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/feedback`)
      if (res.ok) {
        const d = await res.json()
        setFeedbacks(d.feedback ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ressourceId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressourceId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), bewertung }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      setText("")
      setBewertung(null)
      await loadFeedback()
      toast.success("Feedback gespeichert")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/ressource-feedback/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      setFeedbacks((prev) => prev.filter((f) => f.id !== id))
      toast.success("Feedback gelöscht")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen")
    }
  }

  const rated = feedbacks.filter((f) => f.bewertung != null)
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, f) => sum + f.bewertung!, 0) / rated.length
      : null

  return (
    <div className="flex flex-col gap-4">
      {avgRating != null && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
            <PoolStarRating value={Math.round(avgRating)} readonly />
          </div>
          <p className="text-xs text-muted-foreground">
            Durchschnitt aus {rated.length} Bewertung{rated.length !== 1 ? "en" : ""}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Bewertung (optional)</Label>
          <PoolStarRating value={bewertung} onChange={setBewertung} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            Feedback-Text <span className="text-destructive">*</span>
          </Label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Ihre Einschätzung zur Ressource…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving || !text.trim()}>
            {saving ? "Speichern…" : "Feedback senden"}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <IconMessage className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Noch kein Feedback vorhanden.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {feedbacks.map((fb) => (
            <div key={fb.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">
                    {fb.profiles?.name ?? "Unbekannt"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(fb.created_at).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {fb.bewertung != null && (
                    <PoolStarRating value={fb.bewertung} readonly />
                  )}
                  <button
                    type="button"
                    className="ml-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Feedback löschen"
                    onClick={() => handleDelete(fb.id)}
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{fb.text}</p>
              {fb.vakanzen_data && (
                <span className="text-xs text-muted-foreground">
                  Vakanz: {fb.vakanzen_data.rolle}
                </span>
              )}
              {fb.vakanz_id && !fb.vakanzen_data && (
                <span className="text-xs text-muted-foreground">
                  Vakanz nicht mehr vorhanden
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AgenturDetailSheet ─────────────────────────────────────────────────────────

interface AgenturDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ressource: Ressource | null
  beauftragungen: Beauftragung[]
}

function AgenturDetailSheet({
  open,
  onOpenChange,
  ressource,
  beauftragungen,
}: AgenturDetailSheetProps) {
  const { user } = useUser()
  const isAgentur = user?.rolle === "Agentur"

  const [links, setLinks] = React.useState<VakanzLink[]>([])
  const [historie, setHistorie] = React.useState<HistorieEintrag[]>([])
  const [linksLoading, setLinksLoading] = React.useState(false)
  const [historieLoading, setHistorieLoading] = React.useState(false)

  const [rueckzugOpen, setRueckzugOpen] = React.useState(false)
  const [rueckzugLink, setRueckzugLink] = React.useState<{ id: string; rolle: string } | null>(null)

  // KI-Match State
  const [kiVakanzen, setKiVakanzen] = React.useState<VakanzOption[]>([])
  const [kiVakanzId, setKiVakanzId] = React.useState("")
  const [kiScore, setKiScore] = React.useState<KiScore | null>(null)
  const [kiScoreLoading, setKiScoreLoading] = React.useState(false)
  const [kiBerechnend, setKiBerechnend] = React.useState(false)

  function loadLinks(id: string) {
    setLinksLoading(true)
    fetch(`/api/ressourcen/${id}/links`)
      .then((r) => r.json())
      .then((d) => setLinks(d.links ?? []))
      .catch(() => {})
      .finally(() => setLinksLoading(false))
  }

  React.useEffect(() => {
    if (!open || !ressource) {
      setLinks([])
      setHistorie([])
      setKiVakanzen([])
      setKiVakanzId("")
      setKiScore(null)
      return
    }
    loadLinks(ressource.id)

    setHistorieLoading(true)
    fetch(`/api/ressourcen/${ressource.id}/historie`)
      .then((r) => r.json())
      .then((d) => setHistorie(d.historie ?? []))
      .catch(() => {})
      .finally(() => setHistorieLoading(false))

    // Vakanzen für KI-Match laden
    fetch("/api/vakanzen")
      .then((r) => r.json())
      .then((d) => setKiVakanzen(
        (d.vakanzen ?? []).filter((v: VakanzOption & { status: string }) => v.status === "Offen")
      ))
      .catch(() => {})
  }, [open, ressource?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Score laden wenn Vakanz gewählt
  React.useEffect(() => {
    if (!kiVakanzId || !ressource) { setKiScore(null); return }
    setKiScoreLoading(true)
    fetch(`/api/ressourcen/${ressource.id}/ki-match?vakanz_id=${kiVakanzId}`)
      .then((r) => r.json())
      .then((d) => setKiScore(d.score ?? null))
      .catch(() => setKiScore(null))
      .finally(() => setKiScoreLoading(false))
  }, [kiVakanzId, ressource?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleKiMatch() {
    if (!ressource || !kiVakanzId) return
    setKiBerechnend(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/ki-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: kiVakanzId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        toast.error("Ollama nicht erreichbar — bitte lokale Ollama-Instanz starten")
        return
      }
      if (!res.ok) throw new Error(data.error ?? "Fehler bei der KI-Bewertung")
      setKiScore(data.score)
      toast.success("KI-Match berechnet")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler bei der KI-Bewertung")
    } finally {
      setKiBerechnend(false)
    }
  }

  async function handleCvDownload() {
    if (!ressource?.cv_pfad) return
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/cv`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      const { url } = await res.json()
      window.open(url, "_blank")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "CV-Download fehlgeschlagen"
      )
    }
  }

  if (!ressource) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[480px] flex-col gap-0 overflow-hidden p-0 sm:w-[540px]"
      >
        <SheetHeader className="flex-none border-b px-6 py-4">
          <SheetTitle>{ressource.name}</SheetTitle>
          <SheetDescription>Details & Verlauf</SheetDescription>
        </SheetHeader>

        <Tabs
          defaultValue="details"
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="mx-6 mt-3 self-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="verlauf">
              Verlauf
              {historie.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {historie.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Details (read-only) ── */}
          <TabsContent
            value="details"
            className="mt-0 flex-1 overflow-y-auto px-6 py-4"
          >
            <div className="flex flex-col gap-5">
              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={verfuegbarkeitColors[ressource.verfuegbarkeit]}
                >
                  {verfuegbarkeitLabel[ressource.verfuegbarkeit]}
                </Badge>
                <Badge
                  variant="outline"
                  className={erfahrungsColors[ressource.erfahrungslevel]}
                >
                  {ressource.erfahrungslevel}
                </Badge>
              </div>

              {/* Skills */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ressource.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Notizen */}
              {ressource.notizen && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notizen
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {ressource.notizen}
                  </p>
                </div>
              )}

              {/* CV */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lebenslauf
                </p>
                {ressource.cv_pfad ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCvDownload}
                  >
                    <IconDownload className="size-4" />
                    CV herunterladen
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Kein CV vorhanden
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-muted-foreground">Angelegt</span>
                  <span>
                    {new Date(ressource.created_at).toLocaleDateString("de-DE")}
                  </span>
                  <span className="text-muted-foreground">Aktualisiert</span>
                  <span>
                    {new Date(ressource.updated_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </div>

              {/* KI-Match */}
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  KI-Match
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {!isResourceUnavailable(ressource.id, beauftragungen, null) ? (
                      <Select value={kiVakanzId} onValueChange={setKiVakanzId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Vakanz wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {kiVakanzen.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              Keine offenen Vakanzen
                            </SelectItem>
                          ) : (
                            kiVakanzen.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.titel || v.rolle}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        <span>Diese Ressource ist derzeit vergeben</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      disabled={
                        !kiVakanzId ||
                        kiBerechnend ||
                        isResourceUnavailable(ressource.id, beauftragungen, null)
                      }
                      onClick={handleKiMatch}
                    >
                      <IconBrain className="size-4" />
                      {kiBerechnend ? "Berechne…" : "KI-Match"}
                    </Button>
                  </div>

                  {kiScoreLoading && (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                  )}

                  {!kiScoreLoading && kiScore && (
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-3xl font-bold ${scoreColor(kiScore.score)}`}>
                          {kiScore.score}
                          <span className="text-sm font-normal text-muted-foreground">/100</span>
                        </span>
                        <Badge variant="outline" className={empfehlungColors[kiScore.empfehlung]}>
                          {kiScore.empfehlung}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground">{kiScore.begruendung}</p>

                      {kiScore.skill_vorhanden.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-medium text-green-700">Vorhandene Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {kiScore.skill_vorhanden.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {kiScore.skill_fehlend.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs font-medium text-red-700">Fehlende Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {kiScore.skill_fehlend.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Berechnet{" "}
                        {new Date(kiScore.berechnet_am).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · Modell: {kiScore.model}
                      </p>
                    </div>
                  )}

                  {!kiScoreLoading && kiVakanzId && !kiScore && !kiBerechnend && (
                    <p className="text-sm text-muted-foreground">
                      Noch kein Score für diese Vakanz. Klicken Sie auf „KI-Match" um einen zu berechnen.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 2: Verlauf ── */}
          <TabsContent
            value="verlauf"
            className="mt-0 flex-1 overflow-y-auto px-6 py-4"
          >
            <div className="flex flex-col gap-6">
              {/* Aktive Verknüpfungen */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vakanz-Verknüpfungen
                </p>
                {linksLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : links.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconLink className="size-4 shrink-0" />
                    Noch keine Verknüpfungen vorhanden.
                  </div>
                ) : (
                  <div className="flex flex-col divide-y rounded-lg border">
                    {links.map((link) => (
                      <div key={link.id} className="flex flex-col gap-1.5 px-4 py-3">
                        <p className="text-sm font-medium">
                          {link.vakanzen_data?.rolle ?? "Unbekannte Vakanz"}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={linkStatusColors[link.status]}
                            >
                              {link.status}
                            </Badge>
                            {link.interview_datum && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <IconClock className="size-3" />
                                {new Date(link.interview_datum).toLocaleDateString(
                                  "de-DE"
                                )}
                              </span>
                            )}
                          </div>
                          {isAgentur && RUECKZUG_ERLAUBT.includes(link.status) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setRueckzugLink({
                                  id: link.id,
                                  rolle: link.vakanzen_data?.rolle ?? "Unbekannte Vakanz",
                                })
                                setRueckzugOpen(true)
                              }}
                            >
                              Zurückziehen
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Statushistorie */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Statushistorie
                </p>
                {historieLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : historie.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Einträge vorhanden.
                  </p>
                ) : (
                  <div className="flex flex-col gap-0">
                    {historie.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className={`flex gap-3 py-2.5 ${
                          idx < historie.length - 1
                            ? "border-b border-dashed border-border/60"
                            : ""
                        }`}
                      >
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm">{entry.text}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 3: Feedback ── */}
          <TabsContent
            value="feedback"
            className="mt-0 flex-1 overflow-y-auto px-6 py-4"
          >
            <PoolFeedbackTab ressourceId={ressource.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>

      {rueckzugLink && (
        <RueckzugDialog
          open={rueckzugOpen}
          onOpenChange={setRueckzugOpen}
          linkId={rueckzugLink.id}
          vakanzRolle={rueckzugLink.rolle}
          onSuccess={() => {
            if (ressource) loadLinks(ressource.id)
          }}
        />
      )}
    </Sheet>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function TableSkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ── StammdatenModal ────────────────────────────────────────────────────────────

interface StammdatenModalProps {
  ressource: Ressource
  open: boolean
  onClose: () => void
  onSaved: (updated: Partial<Ressource>) => void
}

function StammdatenModal({ ressource, open, onClose, onSaved }: StammdatenModalProps) {
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    nachname: ressource.nachname ?? '',
    vorname: ressource.vorname ?? '',
    geburtsdatum: ressource.geburtsdatum ?? '',
    geschlecht: ressource.geschlecht ?? '',
    firma: ressource.firma ?? '',
    email_geschaeftlich: ressource.email_geschaeftlich ?? '',
    telefon_geschaeftlich: ressource.telefon_geschaeftlich ?? '',
    wohnort: ressource.wohnort ?? '',
    namenszusatz: ressource.namenszusatz ?? '',
    titel: ressource.titel ?? '',
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSave() {
    const required = ['nachname', 'vorname', 'geburtsdatum', 'geschlecht', 'firma', 'email_geschaeftlich', 'telefon_geschaeftlich', 'wohnort'] as const
    if (required.some((f) => !form[f].trim())) {
      toast.error('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ressource.name,
          rolle: ressource.rolle ?? null,
          skills: ressource.skills,
          erfahrungslevel: ressource.erfahrungslevel,
          verfuegbarkeit: ressource.verfuegbarkeit,
          verfuegbar_ab: ressource.verfuegbar_ab ?? null,
          ek_tagesrate: ressource.ek_tagesrate ?? null,
          notizen: ressource.notizen ?? null,
          nachname: form.nachname.trim() || null,
          vorname: form.vorname.trim() || null,
          geburtsdatum: form.geburtsdatum || null,
          geschlecht: form.geschlecht || null,
          firma: form.firma.trim() || null,
          email_geschaeftlich: form.email_geschaeftlich.trim() || null,
          telefon_geschaeftlich: form.telefon_geschaeftlich.trim() || null,
          wohnort: form.wohnort.trim() || null,
          namenszusatz: form.namenszusatz.trim() || null,
          titel: form.titel.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Fehler beim Speichern.')
        return
      }
      onSaved({
        nachname: form.nachname.trim() || null,
        vorname: form.vorname.trim() || null,
        geburtsdatum: form.geburtsdatum || null,
        geschlecht: form.geschlecht || null,
        firma: form.firma.trim() || null,
        email_geschaeftlich: form.email_geschaeftlich.trim() || null,
        telefon_geschaeftlich: form.telefon_geschaeftlich.trim() || null,
        wohnort: form.wohnort.trim() || null,
        namenszusatz: form.namenszusatz.trim() || null,
        titel: form.titel.trim() || null,
      })
      toast.success('Stammdaten gespeichert.')
      onClose()
    } catch {
      toast.error('Verbindungsfehler.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stammdaten erfassen</DialogTitle>
          <DialogDescription>
            Pflichtfelder für <span className="font-medium">{ressource.name}</span> (Beauftragt).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sd-vorname">Vorname <span className="text-destructive">*</span></Label>
            <Input id="sd-vorname" value={form.vorname} onChange={set('vorname')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-nachname">Nachname <span className="text-destructive">*</span></Label>
            <Input id="sd-nachname" value={form.nachname} onChange={set('nachname')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-geburtsdatum">Geburtsdatum <span className="text-destructive">*</span></Label>
            <Input id="sd-geburtsdatum" type="date" value={form.geburtsdatum} onChange={set('geburtsdatum')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-geschlecht">Geschlecht <span className="text-destructive">*</span></Label>
            <select
              id="sd-geschlecht"
              value={form.geschlecht}
              onChange={set('geschlecht')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Bitte wählen</option>
              <option value="Männlich">Männlich</option>
              <option value="Weiblich">Weiblich</option>
              <option value="Divers">Divers</option>
              <option value="Keine Angabe">Keine Angabe</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-namenszusatz">Namenszusatz</Label>
            <Input id="sd-namenszusatz" value={form.namenszusatz} onChange={set('namenszusatz')} placeholder="optional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-titel">Titel</Label>
            <Input id="sd-titel" value={form.titel} onChange={set('titel')} placeholder="optional" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="sd-firma">Firma <span className="text-destructive">*</span></Label>
            <Input id="sd-firma" value={form.firma} onChange={set('firma')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-email">E-Mail geschäftlich <span className="text-destructive">*</span></Label>
            <Input id="sd-email" type="email" value={form.email_geschaeftlich} onChange={set('email_geschaeftlich')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sd-telefon">Telefon geschäftlich <span className="text-destructive">*</span></Label>
            <Input id="sd-telefon" value={form.telefon_geschaeftlich} onChange={set('telefon_geschaeftlich')} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="sd-wohnort">Wohnort <span className="text-destructive">*</span></Label>
            <Input id="sd-wohnort" value={form.wohnort} onChange={set('wohnort')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── PoolPage ───────────────────────────────────────────────────────────────────

export default function PoolPage() {
  const router = useRouter()
  const { user } = useUser()
  const isManager = user?.rolle === "Staffhub Manager" || user?.rolle === "Admin"
  const isAdmin = user?.rolle === "Admin"

  const [ressourcen, setRessourcen] = React.useState<Ressource[]>([])
  const [beauftragungen, setBeauftragungen] = React.useState<Beauftragung[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [agenturen, setAgenturen] = React.useState<Agentur[]>([])

  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [showDeaktiviert, setShowDeaktiviert] = React.useState(false)

  // KI-Score Vakanz-Filter (Manager only)
  const [allVakanzen, setAllVakanzen] = React.useState<VakanzOption[]>([])
  const [vakanzFilter, setVakanzFilter] = React.useState("keine")
  const [tableKiScores, setTableKiScores] = React.useState<Record<string, KiScore | null>>({})
  const [kiScoresLoading, setKiScoresLoading] = React.useState(false)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editingRessource, setEditingRessource] = React.useState<Ressource | null>(null)

  const [poolFormSheetOpen, setPoolFormSheetOpen] = React.useState(false)

  const [deaktivierenOpen, setDeaktivierenOpen] = React.useState(false)
  const [deaktivierenRessource, setDeaktivierenRessource] = React.useState<Ressource | null>(null)

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailRessource, setDetailRessource] = React.useState<Ressource | null>(null)

  const [profilEinreichenOpen, setProfilEinreichenOpen] = React.useState(false)
  const [profilEinreichenRessource, setProfilEinreichenRessource] = React.useState<Ressource | null>(null)

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [linksCache, setLinksCache] = React.useState<Record<string, VakanzLink[]>>({})
  const [loadingLinkIds, setLoadingLinkIds] = React.useState<Set<string>>(new Set())

  const [stammdatenModal, setStammdatenModal] = React.useState<Ressource | null>(null)

  async function handleToggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      return next
    })
    if (linksCache[id]) return
    setLoadingLinkIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/ressourcen/${id}/links`)
      const data = await res.json()
      setLinksCache((prev) => ({ ...prev, [id]: data.links ?? [] }))
    } catch {
      setLinksCache((prev) => ({ ...prev, [id]: [] }))
    } finally {
      setLoadingLinkIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function handleStammdatenSaved(ressourceId: string, updated: Partial<Ressource>) {
    setRessourcen((prev) =>
      prev.map((r) => r.id === ressourceId ? { ...r, ...updated } : r)
    )
  }

  async function fetchRessourcen() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (showDeaktiviert) params.set("deaktiviert", "true")
      const res = await fetch(`/api/ressourcen?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setRessourcen(data.ressourcen ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daten konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchRessourcen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeaktiviert])

  React.useEffect(() => {
    const fetchBeauftragungen = async () => {
      if (ressourcen.length === 0) return

      const resourceIds = ressourcen.map((r) => r.id).join(',')
      try {
        const res = await fetch(
          `/api/beauftragungen?resource_ids=${encodeURIComponent(resourceIds)}`
        )
        if (res.ok) {
          const data = await res.json()
          setBeauftragungen(data.beauftragungen || [])
        }
      } catch (error) {
        console.error('Failed to fetch beauftragungen:', error)
      }
    }

    fetchBeauftragungen()
  }, [ressourcen])

  // Agenturen für Admin/Manager-Dropdown laden
  React.useEffect(() => {
    if (!isManager) return
    fetch("/api/admin/agenturen")
      .then((r) => r.json())
      .then((d) => setAgenturen(d.agenturen ?? []))
      .catch(() => {})
  }, [isManager])

  // Load open vakanzen for Manager KI-Filter dropdown
  React.useEffect(() => {
    if (!isManager) return
    fetch("/api/vakanzen")
      .then((r) => r.json())
      .then((d) => setAllVakanzen(
        (d.vakanzen ?? []).filter((v: VakanzOption & { status: string }) => v.status === "Offen")
      ))
      .catch(() => {})
  }, [isManager])

  // Load KI scores for all ressourcen when vakanzFilter changes
  React.useEffect(() => {
    if (vakanzFilter === "keine" || ressourcen.length === 0) {
      setTableKiScores({})
      return
    }
    setKiScoresLoading(true)
    Promise.all(
      ressourcen.map((r) =>
        fetch(`/api/ressourcen/${r.id}/ki-match?vakanz_id=${vakanzFilter}`)
          .then((res) => res.json())
          .then((d) => [r.id, d.score ?? null] as [string, KiScore | null])
          .catch(() => [r.id, null] as [string, KiScore | null])
      )
    )
      .then((entries) => setTableKiScores(Object.fromEntries(entries)))
      .finally(() => setKiScoresLoading(false))
  }, [vakanzFilter, ressourcen]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = (() => {
    const base = ressourcen.filter((r) => {
      const matchesStatus =
        statusFilter === "alle" || r.verfuegbarkeit === statusFilter
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        q === "" ||
        r.name.toLowerCase().includes(q) ||
        r.skills.some((s) => s.toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
    if (vakanzFilter === "keine") return base
    return [...base].sort((a, b) => {
      const scoreA = tableKiScores[a.id]?.score ?? -1
      const scoreB = tableKiScores[b.id]?.score ?? -1
      return scoreB - scoreA
    })
  })()

  async function handleCvDownload(ressource: Ressource) {
    if (!ressource.cv_pfad) return
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/cv`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      const { url } = await res.json()
      window.open(url, "_blank")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CV-Download fehlgeschlagen")
    }
  }

  async function handleCvDelete(ressource: Ressource) {
    try {
      const res = await fetch(`/api/ressourcen/${ressource.id}/cv`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Fehler")
      }
      toast.success("CV gelöscht")
      fetchRessourcen()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen")
    }
  }

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
        <SiteHeader title={isAdmin ? "Freelancer-Pool" : "Mein Pool"} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">{isAdmin ? "Freelancer-Pool" : "Mein Pool"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Lädt…" : `${filtered.length} Ressource${filtered.length !== 1 ? "n" : ""}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setPoolFormSheetOpen(true)
                  }}
                >
                  <IconPlus className="size-4" />
                  Neue Ressource
                </Button>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name oder Skill suchen…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle Status</SelectItem>
                    {RESSOURCE_VERFUEGBARKEIT.filter((v) => v !== "Deaktiviert").map(
                      (v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant={showDeaktiviert ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDeaktiviert((p) => !p)}
                >
                  Deaktivierte anzeigen
                </Button>
                {isManager && allVakanzen.length > 0 && (
                  <Select value={vakanzFilter} onValueChange={setVakanzFilter}>
                    <SelectTrigger className="w-[220px] gap-1.5">
                      <IconBrain className="size-4 shrink-0 text-muted-foreground" />
                      <SelectValue placeholder="KI-Filter: Vakanz…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keine">Kein KI-Filter</SelectItem>
                      {allVakanzen.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.titel || v.rolle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  {error}
                </div>
              )}

              {/* Stammdaten-Banner */}
              {(() => {
                const count = ressourcen.filter(stammdatenAusstehend).length
                if (count === 0) return null
                return (
                  <div className="mx-4 mb-2 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 lg:mx-6">
                    <span className="font-medium">⚠ {count} Ressource{count !== 1 ? 'n' : ''} mit Status „Beauftragt" benötigt{count !== 1 ? 'en' : ''} noch Stammdaten.</span>
                  </div>
                )
              })()}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        {isAdmin && <TableHead>Agentur</TableHead>}
                        <TableHead>Rolle</TableHead>
                        <TableHead>Verfügbar ab</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>EK-Rate</TableHead>
                        {vakanzFilter !== "keine" && (
                          <TableHead>KI-Score</TableHead>
                        )}
                        <TableHead>Gespielt</TableHead>
                        <TableHead>CV</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading || kiScoresLoading ? (
                        <TableSkeletonRows cols={(vakanzFilter !== "keine" ? 10 : 9) + (isAdmin ? 1 : 0)} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={(vakanzFilter !== "keine" ? 10 : 9) + (isAdmin ? 1 : 0)}
                            className="py-12 text-center text-muted-foreground"
                          >
                            {ressourcen.length === 0
                              ? "Noch keine Ressourcen im Pool. Legen Sie jetzt die erste an."
                              : "Keine Ressourcen gefunden."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => {
                          const linkCount = r.link_count ?? 0
                          const isExpanded = expandedIds.has(r.id)
                          const isLoadingLinks = loadingLinkIds.has(r.id)
                          const cachedLinks = linksCache[r.id]
                          const totalCols = (vakanzFilter !== "keine" ? 10 : 9) + (isAdmin ? 1 : 0)
                          return (
                          <React.Fragment key={r.id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => router.push(`/ressourcen/${r.id}`)}
                          >
                            <TableCell className="font-medium">{r.name}</TableCell>
                            {isAdmin && (
                              <TableCell className="text-sm text-muted-foreground">
                                {r.agenturen?.name ?? "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-muted-foreground">
                              {r.rolle || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.verfuegbar_ab
                                ? new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 text-sm">
                                {r.arbeitsmodell && r.arbeitsmodell !== 'Onshore' ? (
                                  <span className="text-muted-foreground text-xs">{r.arbeitsmodell}</span>
                                ) : null}
                                <span>{r.location ?? '—'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant="outline"
                                  className={verfuegbarkeitColors[r.verfuegbarkeit]}
                                >
                                  {verfuegbarkeitLabel[r.verfuegbarkeit]}
                                </Badge>
                                {stammdatenAusstehend(r) && (
                                  <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                    Stammdaten ausstehend
                                  </span>
                                )}
                                {stammdatenAusstehend(r) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                                    onClick={() => setStammdatenModal(r)}
                                  >
                                    Stammdaten erfassen
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {r.ek_tagesrate != null
                                ? `${r.ek_tagesrate.toLocaleString("de-DE")} €`
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            {vakanzFilter !== "keine" && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {tableKiScores[r.id] ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-semibold ${scoreColor(tableKiScores[r.id]!.score)}`}>
                                      {tableKiScores[r.id]!.score}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${empfehlungColors[tableKiScores[r.id]!.empfehlung]}`}
                                    >
                                      {tableKiScores[r.id]!.empfehlung}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell onClick={(e) => { if (linkCount > 0) handleToggleExpand(r.id, e); else e.stopPropagation() }}>
                              {linkCount > 0 ? (
                                <button className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  isExpanded
                                    ? "border-primary/30 bg-primary/5 text-primary"
                                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                }`}>
                                  <IconLink className="size-3.5" />
                                  {linkCount}
                                  <IconChevronDown className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {r.cv_pfad ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => handleCvDownload(r)}
                                >
                                  <IconDownload className="size-3.5" />
                                  CV
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Kein CV</span>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <IconDotsVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {stammdatenAusstehend(r) && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => setStammdatenModal(r)}
                                        className="text-amber-700 focus:text-amber-700"
                                      >
                                        <IconPencil className="mr-2 size-4" />
                                        Stammdaten erfassen
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setProfilEinreichenRessource(r)
                                      setProfilEinreichenOpen(true)
                                    }}
                                    disabled={
                                      r.verfuegbarkeit === "Deaktiviert" ||
                                      isResourceUnavailable(r.id, beauftragungen, null)
                                    }
                                  >
                                    <IconFileText className="mr-2 size-4" />
                                    Profil einreichen
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSheetMode("edit")
                                      setEditingRessource(r)
                                      setSheetOpen(true)
                                    }}
                                  >
                                    <IconPencil className="mr-2 size-4" />
                                    Bearbeiten
                                  </DropdownMenuItem>
                                  {r.cv_pfad && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => handleCvDelete(r)}
                                      >
                                        <IconTrash className="mr-2 size-4" />
                                        CV löschen
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {r.verfuegbarkeit !== "Deaktiviert" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                          setDeaktivierenRessource(r)
                                          setDeaktivierenOpen(true)
                                        }}
                                      >
                                        Deaktivieren
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={totalCols} className="px-6 py-0">
                                {isLoadingLinks ? (
                                  <div className="py-3 text-xs text-muted-foreground">Lädt…</div>
                                ) : !cachedLinks || cachedLinks.length === 0 ? (
                                  <div className="py-3 text-xs text-muted-foreground">Keine Einreichungen gefunden.</div>
                                ) : (
                                  <div className="py-2">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground">
                                          <th className="py-1.5 pr-4 text-left font-medium">Vakanz</th>
                                          <th className="py-1.5 pr-4 text-left font-medium">Status</th>
                                          <th className="py-1.5 pr-4 text-left font-medium">Level</th>
                                          <th className="py-1.5 pr-4 text-left font-medium">Standort/Remote</th>
                                          <th className="py-1.5 pr-4 text-left font-medium">Sektor</th>
                                          <th className="py-1.5 pr-4 text-left font-medium">Start</th>
                                          <th className="py-1.5 text-left font-medium">Ende</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50">
                                        {cachedLinks.map((l) => {
                                          const vd = l.vakanzen_data
                                          const standortLabel = [vd?.arbeitsmodell, vd?.standort].filter(Boolean).join(" · ") || "—"
                                          return (
                                            <tr key={l.id}>
                                              <td className="py-1.5 pr-4 font-medium text-foreground">
                                                <button
                                                  className="text-left hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                                                  onClick={(e) => { e.stopPropagation(); if (l.vakanz_id) router.push(`/vakanzen/${l.vakanz_id}`) }}
                                                >
                                                  {vd?.rolle ?? "—"}
                                                </button>
                                              </td>
                                              <td className="py-1.5 pr-4">
                                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${linkStatusColors[l.status]}`}>
                                                  {l.status}
                                                </span>
                                              </td>
                                              <td className="py-1.5 pr-4 text-muted-foreground">{vd?.erfahrungslevel ?? "—"}</td>
                                              <td className="py-1.5 pr-4 text-muted-foreground">{standortLabel}</td>
                                              <td className="py-1.5 pr-4 text-muted-foreground">{vd?.branche ?? "—"}</td>
                                              <td className="py-1.5 pr-4 text-muted-foreground">
                                                {vd?.startdatum ? new Date(vd.startdatum).toLocaleDateString("de-DE") : "—"}
                                              </td>
                                              <td className="py-1.5 text-muted-foreground">
                                                {vd?.enddatum ? new Date(vd.enddatum).toLocaleDateString("de-DE") : "—"}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <RessourceFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        ressource={editingRessource}
        onSuccess={fetchRessourcen}
        isAdmin={isAdmin}
        agenturen={agenturen}
      />

      <DeaktivierenDialog
        open={deaktivierenOpen}
        onOpenChange={setDeaktivierenOpen}
        ressource={deaktivierenRessource}
        onSuccess={fetchRessourcen}
      />

      <AgenturDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        ressource={detailRessource}
        beauftragungen={beauftragungen}
      />

      <ProfilEinreichenDialog
        open={profilEinreichenOpen}
        onOpenChange={setProfilEinreichenOpen}
        ressource={profilEinreichenRessource}
        onSuccess={fetchRessourcen}
      />

      <ResourcePoolFormSheet
        open={poolFormSheetOpen}
        onOpenChange={setPoolFormSheetOpen}
        onSuccess={fetchRessourcen}
        isManagerOrAdmin={isManager}
        agenturen={agenturen}
      />

      {stammdatenModal && (
        <StammdatenModal
          ressource={stammdatenModal}
          open={true}
          onClose={() => setStammdatenModal(null)}
          onSaved={(updated) => handleStammdatenSaved(stammdatenModal.id, updated)}
        />
      )}
    </SidebarProvider>
  )
}
