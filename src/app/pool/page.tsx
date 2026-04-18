"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconDownload,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { ERFAHRUNGSLEVEL, RESSOURCE_VERFUEGBARKEIT } from "@/lib/constants"
import type { Erfahrungslevel, RessourceVerfuegbarkeit } from "@/lib/constants"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TagInput } from "@/components/tag-input"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface Ressource {
  id: string
  agentur_id: string
  name: string
  skills: string[]
  erfahrungslevel: Erfahrungslevel
  verfuegbarkeit: RessourceVerfuegbarkeit
  verfuegbar_ab?: string | null
  cv_pfad?: string | null
  ek_tagesrate?: number | null
  notizen?: string | null
  created_at: string
  updated_at: string
}

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const ressourceSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich").max(200),
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
  })
  .refine(
    (d) => d.verfuegbarkeit !== "Verfügbar ab" || !!d.verfuegbar_ab,
    { message: 'Datum erforderlich wenn "Verfügbar ab"', path: ["verfuegbar_ab"] }
  )

type RessourceFormData = z.infer<typeof ressourceSchema>

// ── Color maps ─────────────────────────────────────────────────────────────────

const verfuegbarkeitColors: Record<RessourceVerfuegbarkeit, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-blue-100 text-blue-700 border-blue-200",
  "Nicht verfügbar": "bg-orange-100 text-orange-700 border-orange-200",
  Deaktiviert: "bg-gray-100 text-gray-500 border-gray-200",
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
}

function RessourceFormSheet({
  open,
  onOpenChange,
  mode,
  ressource,
  onSuccess,
}: RessourceFormSheetProps) {
  const [saving, setSaving] = React.useState(false)
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
      if (mode === "edit" && ressource) {
        reset({
          name: ressource.name,
          skills: ressource.skills,
          erfahrungslevel: ressource.erfahrungslevel,
          verfuegbarkeit: ressource.verfuegbarkeit,
          verfuegbar_ab: ressource.verfuegbar_ab ?? null,
          ek_tagesrate: ressource.ek_tagesrate ?? null,
          notizen: ressource.notizen ?? "",
        })
      } else {
        reset({
          name: "",
          skills: [],
          erfahrungslevel: undefined,
          verfuegbarkeit: undefined,
          verfuegbar_ab: null,
          ek_tagesrate: null,
          notizen: "",
        })
      }
    }
  }, [open, mode, ressource, reset])

  async function onSubmit(data: RessourceFormData) {
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
          skills: data.skills,
          erfahrungslevel: data.erfahrungslevel,
          verfuegbarkeit: data.verfuegbarkeit,
          verfuegbar_ab:
            data.verfuegbarkeit === "Verfügbar ab" ? data.verfuegbar_ab : null,
          ek_tagesrate: data.ek_tagesrate ?? null,
          notizen: data.notizen || null,
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

// ── PoolPage ───────────────────────────────────────────────────────────────────

export default function PoolPage() {
  const { user } = useUser()

  const [ressourcen, setRessourcen] = React.useState<Ressource[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [showDeaktiviert, setShowDeaktiviert] = React.useState(false)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editingRessource, setEditingRessource] = React.useState<Ressource | null>(null)

  const [deaktivierenOpen, setDeaktivierenOpen] = React.useState(false)
  const [deaktivierenRessource, setDeaktivierenRessource] = React.useState<Ressource | null>(null)

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

  const filtered = ressourcen.filter((r) => {
    const matchesStatus =
      statusFilter === "alle" || r.verfuegbarkeit === statusFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === "" ||
      r.name.toLowerCase().includes(q) ||
      r.skills.some((s) => s.toLowerCase().includes(q))
    return matchesStatus && matchesSearch
  })

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
        <SiteHeader title="Mein Pool" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Mein Pool</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Lädt…" : `${filtered.length} Ressource${filtered.length !== 1 ? "n" : ""}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSheetMode("create")
                    setEditingRessource(null)
                    setSheetOpen(true)
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
              </div>

              {/* Error */}
              {error && (
                <div className="mx-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  {error}
                </div>
              )}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>EK-Rate</TableHead>
                        <TableHead>CV</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={7} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-12 text-center text-muted-foreground"
                          >
                            {ressourcen.length === 0
                              ? "Noch keine Ressourcen im Pool. Legen Sie jetzt die erste an."
                              : "Keine Ressourcen gefunden."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell>
                              <SkillTags skills={r.skills} />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={erfahrungsColors[r.erfahrungslevel]}
                              >
                                {r.erfahrungslevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={verfuegbarkeitColors[r.verfuegbarkeit]}
                              >
                                {r.verfuegbarkeit}
                                {r.verfuegbarkeit === "Verfügbar ab" &&
                                  r.verfuegbar_ab &&
                                  ` ${new Date(r.verfuegbar_ab).toLocaleDateString("de-DE")}`}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.ek_tagesrate != null
                                ? `${r.ek_tagesrate.toLocaleString("de-DE")} €`
                                : <span className="text-muted-foreground">—</span>}
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
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <IconDotsVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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

      <RessourceFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        ressource={editingRessource}
        onSuccess={fetchRessourcen}
      />

      <DeaktivierenDialog
        open={deaktivierenOpen}
        onOpenChange={setDeaktivierenOpen}
        ressource={deaktivierenRessource}
        onSuccess={fetchRessourcen}
      />
    </SidebarProvider>
  )
}
