"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconClock,
  IconDownload,
  IconDotsVertical,
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

// ── Link / Historie types ──────────────────────────────────────────────────────

type LinkStatus =
  | "Gespielt"
  | "Interview geplant"
  | "Zugesagt"
  | "Abgesagt"
  | "Abgelehnt"

interface VakanzLink {
  id: string
  vakanz_id: string
  status: LinkStatus
  interview_datum: string | null
  created_at: string
  vakanzen_data: { id: string; rolle: string; status: string } | null
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
  Zugesagt: "bg-green-100 text-green-700 border-green-200",
  Abgesagt: "bg-gray-100 text-gray-500 border-gray-200",
  Abgelehnt: "bg-red-100 text-red-700 border-red-200",
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
}

function AgenturDetailSheet({
  open,
  onOpenChange,
  ressource,
}: AgenturDetailSheetProps) {
  const [links, setLinks] = React.useState<VakanzLink[]>([])
  const [historie, setHistorie] = React.useState<HistorieEintrag[]>([])
  const [linksLoading, setLinksLoading] = React.useState(false)
  const [historieLoading, setHistorieLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !ressource) {
      setLinks([])
      setHistorie([])
      return
    }
    setLinksLoading(true)
    fetch(`/api/ressourcen/${ressource.id}/links`)
      .then((r) => r.json())
      .then((d) => setLinks(d.links ?? []))
      .catch(() => {})
      .finally(() => setLinksLoading(false))

    setHistorieLoading(true)
    fetch(`/api/ressourcen/${ressource.id}/historie`)
      .then((r) => r.json())
      .then((d) => setHistorie(d.historie ?? []))
      .catch(() => {})
      .finally(() => setHistorieLoading(false))
  }, [open, ressource?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
                  {ressource.verfuegbarkeit}
                  {ressource.verfuegbarkeit === "Verfügbar ab" &&
                    ressource.verfuegbar_ab &&
                    ` ${new Date(ressource.verfuegbar_ab).toLocaleDateString(
                      "de-DE"
                    )}`}
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

  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailRessource, setDetailRessource] = React.useState<Ressource | null>(null)

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
                          <TableRow
                            key={r.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setDetailRessource(r)
                              setDetailOpen(true)
                            }}
                          >
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
                            <TableCell onClick={(e) => e.stopPropagation()}>
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

      <AgenturDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        ressource={detailRessource}
      />
    </SidebarProvider>
  )
}
