"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  IconBrandSlack,
  IconCheck,
  IconClock,
  IconDotsVertical,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react"

import { useUser } from "@/context/user-context"
import { BRANCHEN, ERFAHRUNGSLEVEL, ARBEITSMODELL, VAKANZ_STATUS } from "@/lib/constants"
import type { VakanzStatus, Erfahrungslevel, Arbeitsmodell } from "@/lib/constants"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ProfilEinreichenSheet } from "@/components/profil-einreichen-sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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

interface Vakanz {
  id: string
  titel: string
  branche: string
  kunde?: string | null
  rolle: string
  beschreibung: string
  skills: string[]
  skills_nice_have: string[]
  erfahrungslevel: Erfahrungslevel
  startdatum: string
  enddatum?: string | null
  teamgroesse?: number | null
  fte_anzahl: number
  auslastung: number
  arbeitsmodell: Arbeitsmodell
  onsite_anteil?: number | null
  ansprechpartner?: string | null
  status: VakanzStatus
  standort?: string | null
  budget_intern?: number | null
  weitere_kommentare?: string | null
  profile_anzahl: number
  created_at: string
  slack_ts?: string | null
  slack_detail_posted_at?: string | null
}

// ── Zod Schema ─────────────────────────────────────────────────────────────────

const vakanzSchema = z.object({
  branche: z.string().min(1, "Branche ist erforderlich"),
  kunde: z.string().optional(),
  rolle: z.string().min(1, "Benötigte Rolle ist erforderlich"),
  beschreibung: z.string().min(1, "Projektkontext ist erforderlich"),
  skills: z.array(z.string()).min(1, "Mindestens ein Must-Have Skill erforderlich"),
  skills_nice_have: z.array(z.string()).optional().default([]),
  erfahrungslevel: z.enum(ERFAHRUNGSLEVEL, {
    required_error: "Erfahrungslevel ist erforderlich",
  }),
  startdatum: z.string().min(1, "Geplanter Projektstart ist erforderlich"),
  enddatum: z.string().min(1, "Projektende ist erforderlich"),
  teamgroesse: z.number().int().min(1).nullable().optional(),
  fte_anzahl: z
    .number({ invalid_type_error: "Muss eine Zahl sein" })
    .min(0.1, "Mindestens 0.1 FTE"),
  auslastung: z
    .number({ invalid_type_error: "Muss eine Zahl sein" })
    .min(1).max(100).optional().default(100),
  arbeitsmodell: z.enum(ARBEITSMODELL, {
    required_error: "Arbeitsmodell ist erforderlich",
  }),
  onsite_anteil: z.number().int().min(0).max(100).nullable().optional(),
  ansprechpartner: z.string().optional(),
  status: z.enum(VAKANZ_STATUS).optional(),
  standort: z.string().optional(),
  budget_intern: z
    .number({ invalid_type_error: "Muss eine Zahl sein" })
    .positive("EK Tagesrate ist erforderlich"),
  weitere_kommentare: z.string().optional(),
})

type VakanzFormData = z.infer<typeof vakanzSchema>

// ── Color maps ─────────────────────────────────────────────────────────────────

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

// ── TagInput ───────────────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (v: string[]) => void
  error?: string
}) {
  const [input, setInput] = React.useState("")

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault()
      const trimmed = input.trim()
      if (!value.includes(trimmed) && value.length < 20) {
        onChange([...value, trimmed])
      }
      setInput("")
    }
    if (e.key === "Backspace" && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={`flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-within:ring-1 focus-within:ring-ring ${error ? "border-destructive" : "border-input"}`}
      >
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
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── SlackPostDialog ─────────────────────────────────────────────────────────
// Shared channel-selection dialog used by both Detailpost and Updatepost.

type SlackWorkspace = "freelance" | "partner"
type SlackChannel = "testing" | "germany" | "global"

interface SlackPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postType: "detail" | "update"
  vakanzTitel?: string     // only for detailpost display
  onConfirm: (workspace: SlackWorkspace, channel: SlackChannel) => Promise<void>
}

function SlackPostDialog({
  open,
  onOpenChange,
  postType,
  vakanzTitel,
  onConfirm,
}: SlackPostDialogProps) {
  const [workspace, setWorkspace] = React.useState<SlackWorkspace>("freelance")
  const [channel, setChannel] = React.useState<SlackChannel>("testing")
  const [posting, setPosting] = React.useState(false)

  // Reset selections when dialog opens
  React.useEffect(() => {
    if (open) {
      setWorkspace("freelance")
      setChannel("testing")
    }
  }, [open])

  async function handleConfirm() {
    setPosting(true)
    try {
      await onConfirm(workspace, channel)
      onOpenChange(false)
    } finally {
      setPosting(false)
    }
  }

  const workspaceLabels: Record<SlackWorkspace, string> = {
    freelance: "Freelance",
    partner: "Partner",
  }
  const channelLabels: Record<SlackChannel, string> = {
    testing: "Testing",
    germany: "Germany",
    global: "Global",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBrandSlack className="size-5 text-[#4A154B]" />
            {postType === "detail" ? "Detailpost senden" : "Updatepost senden"}
          </DialogTitle>
          <DialogDescription>
            {postType === "detail" && vakanzTitel ? (
              <>
                Vakanz <span className="font-medium text-foreground">„{vakanzTitel}"</span> in Slack posten.
              </>
            ) : (
              "Statusübersicht aller Vakanzen in Slack posten."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Workspace */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-workspace">Workspace</Label>
            <Select
              value={workspace}
              onValueChange={(v) => setWorkspace(v as SlackWorkspace)}
            >
              <SelectTrigger id="sp-workspace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(workspaceLabels) as SlackWorkspace[]).map((ws) => (
                  <SelectItem key={ws} value={ws}>
                    {workspaceLabels[ws]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-channel">Ziel-Channel</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as SlackChannel)}
            >
              <SelectTrigger id="sp-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(channelLabels) as SlackChannel[]).map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {channelLabels[ch]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview pill */}
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Channel:</span>{" "}
            {workspaceLabels[workspace]} → {channelLabels[channel]}
            {channel === "testing" && (
              <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 border border-yellow-200">
                TEST
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={posting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={posting}
            className="gap-2"
          >
            <IconBrandSlack className="size-4" />
            {posting ? "Wird gepostet…" : "In Slack posten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── VakanzFormSheet ────────────────────────────────────────────────────────────

interface VakanzFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  vakanz?: Vakanz | null
  showBudget: boolean
  onSuccess: () => void
}

function VakanzFormSheet({
  open,
  onOpenChange,
  mode,
  vakanz,
  showBudget,
  onSuccess,
}: VakanzFormSheetProps) {
  const [saving, setSaving] = React.useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VakanzFormData>({
    resolver: zodResolver(vakanzSchema),
    defaultValues: {
      branche: "",
      kunde: "",
      rolle: "",
      beschreibung: "",
      skills: [],
      skills_nice_have: [],
      erfahrungslevel: undefined,
      startdatum: "",
      enddatum: "",
      teamgroesse: null,
      fte_anzahl: 1,
      auslastung: 100,
      arbeitsmodell: undefined,
      onsite_anteil: null,
      ansprechpartner: "",
      status: "Offen",
      standort: "",
      budget_intern: undefined,
      weitere_kommentare: "",
    },
  })

  // Populate form when editing
  React.useEffect(() => {
    if (open) {
      if (mode === "edit" && vakanz) {
        reset({
          branche: vakanz.branche,
          kunde: vakanz.kunde ?? "",
          rolle: vakanz.rolle,
          beschreibung: vakanz.beschreibung,
          skills: vakanz.skills,
          skills_nice_have: vakanz.skills_nice_have ?? [],
          erfahrungslevel: vakanz.erfahrungslevel,
          startdatum: vakanz.startdatum,
          enddatum: vakanz.enddatum ?? "",
          teamgroesse: vakanz.teamgroesse ?? null,
          fte_anzahl: vakanz.fte_anzahl,
          auslastung: vakanz.auslastung,
          arbeitsmodell: vakanz.arbeitsmodell,
          onsite_anteil: vakanz.onsite_anteil ?? null,
          ansprechpartner: vakanz.ansprechpartner ?? "",
          status: vakanz.status,
          standort: vakanz.standort ?? "",
          budget_intern: vakanz.budget_intern ?? undefined,
          weitere_kommentare: vakanz.weitere_kommentare ?? "",
        })
      } else {
        reset({
          branche: "",
          kunde: "",
          rolle: "",
          beschreibung: "",
          skills: [],
          skills_nice_have: [],
          erfahrungslevel: undefined,
          startdatum: "",
          enddatum: "",
          teamgroesse: null,
          fte_anzahl: 1,
          auslastung: 100,
          arbeitsmodell: undefined,
          onsite_anteil: null,
          ansprechpartner: "",
          status: "Offen",
          standort: "",
          budget_intern: undefined,
          weitere_kommentare: "",
        })
      }
    }
  }, [open, mode, vakanz, reset])

  async function onSubmit(data: VakanzFormData) {
    setSaving(true)
    try {
      const url =
        mode === "create" ? "/api/vakanzen" : `/api/vakanzen/${vakanz!.id}`
      const method = mode === "create" ? "POST" : "PUT"

      const body: Record<string, unknown> = {
        branche: data.branche,
        kunde: data.kunde || null,
        rolle: data.rolle,
        beschreibung: data.beschreibung,
        skills: data.skills,
        skills_nice_have: data.skills_nice_have ?? [],
        erfahrungslevel: data.erfahrungslevel,
        startdatum: data.startdatum,
        enddatum: data.enddatum,
        teamgroesse: data.teamgroesse ?? null,
        fte_anzahl: data.fte_anzahl,
        auslastung: data.auslastung ?? 100,
        arbeitsmodell: data.arbeitsmodell,
        onsite_anteil: data.arbeitsmodell === "Hybrid" ? (data.onsite_anteil ?? null) : null,
        ansprechpartner: data.ansprechpartner || null,
        standort: data.standort || null,
        budget_intern: data.budget_intern,
        weitere_kommentare: data.weitere_kommentare || null,
      }

      if (mode === "edit") {
        body.status = data.status
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Unbekannter Fehler")
      }

      toast.success(mode === "create" ? "Vakanz erstellt" : "Vakanz aktualisiert")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(
        `Fehler beim Speichern. Bitte erneut versuchen.${err instanceof Error ? ` (${err.message})` : ""}`
      )
    } finally {
      setSaving(false)
    }
  }

  const skills = watch("skills")
  const skillsNiceHave = watch("skills_nice_have")
  const watchedArbeitsmodell = watch("arbeitsmodell")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[500px] flex-col gap-0 overflow-hidden p-0 sm:w-[560px]"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {mode === "create" ? "Neue Vakanz erstellen" : "Vakanz bearbeiten"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Füllen Sie alle Pflichtfelder aus."
              : "Bearbeiten Sie die Vakanz-Details."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">

              {/* Benötigte Rolle */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-rolle">
                  Benötigte Rolle <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="v-rolle"
                  placeholder="z.B. Senior Frontend Engineer"
                  {...register("rolle")}
                  className={errors.rolle ? "border-destructive" : ""}
                />
                {errors.rolle && <p className="text-xs text-destructive">{errors.rolle.message}</p>}
              </div>

              {/* Projektkontext */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-beschreibung">
                  Projektkontext <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="v-beschreibung"
                  placeholder="Kontext, Aufgaben, Anforderungen..."
                  className={`min-h-[90px] ${errors.beschreibung ? "border-destructive" : ""}`}
                  {...register("beschreibung")}
                />
                {errors.beschreibung && <p className="text-xs text-destructive">{errors.beschreibung.message}</p>}
              </div>

              {/* Branche + Kunde */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-branche">
                    Branche <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="branche"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="v-branche" className={errors.branche ? "border-destructive" : ""}>
                          <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BRANCHEN.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.branche && <p className="text-xs text-destructive">{errors.branche.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-kunde">Kunde</Label>
                  <Input id="v-kunde" placeholder="optional" {...register("kunde")} />
                </div>
              </div>

              {/* Geplanter Projektstart + Beauftragungsdauer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-start">
                    Geplanter Projektstart <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="v-start"
                    type="date"
                    {...register("startdatum")}
                    className={errors.startdatum ? "border-destructive" : ""}
                  />
                  {errors.startdatum && <p className="text-xs text-destructive">{errors.startdatum.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-enddatum">
                    Projektende <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="v-enddatum"
                    type="date"
                    {...register("enddatum")}
                    className={errors.enddatum ? "border-destructive" : ""}
                  />
                  {errors.enddatum && <p className="text-xs text-destructive">{errors.enddatum.message}</p>}
                </div>
              </div>

              {/* Teamgröße + FTE Anzahl */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-team">Teamgröße</Label>
                  <Input
                    id="v-team"
                    type="number"
                    min={1}
                    placeholder="optional"
                    {...register("teamgroesse", {
                      setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                    })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-fte">
                    Erf. FTE Anzahl <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="v-fte"
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="z.B. 1"
                    {...register("fte_anzahl", { valueAsNumber: true })}
                    className={errors.fte_anzahl ? "border-destructive" : ""}
                  />
                  {errors.fte_anzahl && <p className="text-xs text-destructive">{errors.fte_anzahl.message}</p>}
                </div>
              </div>

              {/* Erfahrungslevel + Arbeitsmodell */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-level">
                    Erfahrungslevel <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="erfahrungslevel"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="v-level" className={errors.erfahrungslevel ? "border-destructive" : ""}>
                          <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Junior">Junior</SelectItem>
                          <SelectItem value="Mid">Mid</SelectItem>
                          <SelectItem value="Senior">Senior</SelectItem>
                          <SelectItem value="Expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.erfahrungslevel && <p className="text-xs text-destructive">{errors.erfahrungslevel.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-modell">
                    Arbeitsmodell <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="arbeitsmodell"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="v-modell" className={errors.arbeitsmodell ? "border-destructive" : ""}>
                          <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                          <SelectItem value="Onsite">Onsite</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.arbeitsmodell && <p className="text-xs text-destructive">{errors.arbeitsmodell.message}</p>}
                </div>
              </div>

              {/* Onsite-Anteil (nur bei Hybrid) */}
              {watchedArbeitsmodell === "Hybrid" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-onsite">
                    Onsite-Anteil (%) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="v-onsite"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    placeholder="z.B. 40"
                    {...register("onsite_anteil", { valueAsNumber: true })}
                    className={errors.onsite_anteil ? "border-destructive" : ""}
                  />
                  {errors.onsite_anteil && <p className="text-xs text-destructive">{errors.onsite_anteil.message}</p>}
                </div>
              )}

              {/* Skills Must Have */}
              <div className="flex flex-col gap-1.5">
                <Label>
                  Skills (Must Have) <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="skills"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} error={errors.skills?.message} />
                  )}
                />
              </div>

              {/* Skills Nice Have */}
              <div className="flex flex-col gap-1.5">
                <Label>Skills (Nice Have)</Label>
                <Controller
                  control={control}
                  name="skills_nice_have"
                  render={({ field }) => (
                    <TagInput value={field.value ?? []} onChange={field.onChange} />
                  )}
                />
              </div>

              {/* EK Tagesrate + Sourcing Region */}
              <div className="grid grid-cols-2 gap-3">
                {showBudget && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="v-budget">
                      EK Tagesrate (€/Tag) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="v-budget"
                      type="number"
                      min={1}
                      placeholder="z.B. 800"
                      {...register("budget_intern", { valueAsNumber: true })}
                      className={errors.budget_intern ? "border-destructive" : ""}
                    />
                    {errors.budget_intern && <p className="text-xs text-destructive">{errors.budget_intern.message}</p>}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-standort">
                    Sourcing Region <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="v-standort"
                    placeholder="z.B. Deutschland"
                    {...register("standort")}
                    className={errors.standort ? "border-destructive" : ""}
                  />
                </div>
              </div>

              {/* Ansprechpartner */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-ansprech">Ansprechpartner</Label>
                <Input
                  id="v-ansprech"
                  placeholder="optional"
                  {...register("ansprechpartner")}
                />
              </div>

              {/* Weitere Kommentare */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-kommentare">Weitere Kommentare</Label>
                <Textarea
                  id="v-kommentare"
                  placeholder="optional"
                  className="min-h-[70px]"
                  {...register("weitere_kommentare")}
                />
              </div>

              {/* Status (nur im Bearbeiten-Modus) */}
              {mode === "edit" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v-status">Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="v-status">
                          <SelectValue placeholder="Status wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Offen">Offen</SelectItem>
                          <SelectItem value="In Auswahl">In Auswahl</SelectItem>
                          <SelectItem value="Besetzt">Besetzt</SelectItem>
                          <SelectItem value="Pausiert">Pausiert</SelectItem>
                          <SelectItem value="Geschlossen">Geschlossen</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}

            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Abbrechen
              </Button>
            </SheetClose>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Speichern…"
                : mode === "create"
                  ? "Vakanz erstellen"
                  : "Änderungen speichern"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── VakanzSchließenDialog ──────────────────────────────────────────────────────

interface VakanzSchließenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vakanz: Vakanz | null
  onSuccess: () => void
}

function VakanzSchließenDialog({
  open,
  onOpenChange,
  vakanz,
  onSuccess,
}: VakanzSchließenDialogProps) {
  const [closing, setClosing] = React.useState(false)

  async function handleConfirm() {
    if (!vakanz) return
    setClosing(true)
    try {
      const res = await fetch(`/api/vakanzen/${vakanz.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Geschlossen" }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Unbekannter Fehler")
      }

      toast.success("Vakanz geschlossen")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(
        `Fehler beim Schließen.${err instanceof Error ? ` (${err.message})` : ""}`
      )
    } finally {
      setClosing(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vakanz wirklich schließen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle offenen Einreichungen bleiben bestehen.{" "}
            {vakanz && (
              <span className="font-medium text-foreground">
                &ldquo;{vakanz.rolle}&rdquo;
              </span>
            )}{" "}
            wird auf den Status &ldquo;Geschlossen&rdquo; gesetzt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={closing}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={closing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {closing ? "Schließen…" : "Vakanz schließen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

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

// ── RessourceEinsetzenDialog ───────────────────────────────────────────────────

interface PoolRessource {
  id: string
  name: string
  skills: string[]
  erfahrungslevel: string
  verfuegbarkeit: string
  bereits_gespielt?: boolean
}

const verfuegbarkeitColors: Record<string, string> = {
  "Jetzt verfügbar": "bg-green-100 text-green-700 border-green-200",
  "Verfügbar ab": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Nicht verfügbar": "bg-red-100 text-red-700 border-red-200",
  "Deaktiviert": "bg-gray-100 text-gray-600 border-gray-200",
}

function RessourceEinsetzenDialog({
  open,
  onOpenChange,
  vakanzId,
  vakanzTitel,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vakanzId: string
  vakanzTitel: string
  onSuccess: () => void
}) {
  const [tab, setTab] = React.useState("pool")
  const [ressourcen, setRessourcen] = React.useState<PoolRessource[]>([])
  const [loadingPool, setLoadingPool] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [selectedRessource, setSelectedRessource] = React.useState<PoolRessource | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  // Neu anlegen fields
  const [neuName, setNeuName] = React.useState("")
  const [neuSkills, setNeuSkills] = React.useState<string[]>([])
  const [neuErfahrungslevel, setNeuErfahrungslevel] = React.useState("")
  const [neuVerfuegbarkeit, setNeuVerfuegbarkeit] = React.useState("Jetzt verfügbar")
  const [neuError, setNeuError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setTab("pool")
      setSearch("")
      setSelectedRessource(null)
      setNeuName("")
      setNeuSkills([])
      setNeuErfahrungslevel("")
      setNeuVerfuegbarkeit("Jetzt verfügbar")
      setNeuError(null)
      return
    }
    setLoadingPool(true)
    fetch(`/api/ressourcen?vakanz_id=${vakanzId}`)
      .then((r) => r.json())
      .then((d) => setRessourcen(d.ressourcen ?? []))
      .catch(() => {})
      .finally(() => setLoadingPool(false))
  }, [open, vakanzId])

  const filtered = ressourcen.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleSpielen() {
    if (!selectedRessource) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ressourcen/${selectedRessource.id}/spielen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: vakanzId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Fehler beim Einreichen")
      toast.success(`${selectedRessource.name} auf Vakanz gespielt`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Einreichen")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNeuAnlegen() {
    setNeuError(null)
    if (!neuName.trim()) { setNeuError("Name ist erforderlich"); return }
    if (neuSkills.length === 0) { setNeuError("Mindestens ein Skill erforderlich"); return }
    if (!neuErfahrungslevel) { setNeuError("Erfahrungslevel ist erforderlich"); return }
    setSubmitting(true)
    try {
      const createRes = await fetch("/api/ressourcen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: neuName.trim(),
          skills: neuSkills,
          erfahrungslevel: neuErfahrungslevel,
          verfuegbarkeit: neuVerfuegbarkeit,
        }),
      })
      const createBody = await createRes.json().catch(() => ({}))
      if (!createRes.ok) throw new Error(createBody.error ?? "Fehler beim Anlegen")
      const ressourceId = createBody.ressource.id

      const spielenRes = await fetch(`/api/ressourcen/${ressourceId}/spielen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vakanz_id: vakanzId }),
      })
      const spielenBody = await spielenRes.json().catch(() => ({}))
      if (!spielenRes.ok) {
        toast.warning(`Im Pool angelegt, Einreichung fehlgeschlagen: ${spielenBody.error ?? "Fehler"}`)
      } else {
        toast.success(`${neuName.trim()} im Pool angelegt und auf Vakanz gespielt`)
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setNeuError(err instanceof Error ? err.message : "Fehler beim Anlegen")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Ressource einsetzen</DialogTitle>
          <DialogDescription>
            Vakanz:{" "}
            <span className="font-medium text-foreground">{vakanzTitel}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pool">Aus Pool auswählen</TabsTrigger>
            <TabsTrigger value="neu">Neu anlegen</TabsTrigger>
          </TabsList>

          {/* ── Tab: Aus Pool ── */}
          <TabsContent value="pool" className="flex flex-col gap-3 flex-1 overflow-hidden mt-3">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Name oder Skill suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto rounded-md border divide-y min-h-[200px] max-h-[280px]">
              {loadingPool ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Lädt…</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  {ressourcen.length === 0 ? (
                    <>
                      <p>Noch keine Pool-Ressourcen vorhanden.</p>
                      <button
                        className="text-primary underline-offset-4 hover:underline"
                        onClick={() => setTab("neu")}
                      >
                        Erste Ressource anlegen
                      </button>
                    </>
                  ) : (
                    "Keine Ressourcen gefunden."
                  )}
                </div>
              ) : (
                filtered.map((r) => {
                  const isDisabled = !!r.bereits_gespielt
                  const isSelected = selectedRessource?.id === r.id
                  return (
                    <button
                      key={r.id}
                      disabled={isDisabled}
                      onClick={() => setSelectedRessource(isSelected ? null : r)}
                      className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${
                        isDisabled
                          ? "cursor-not-allowed opacity-50"
                          : isSelected
                          ? "bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{r.name}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                              verfuegbarkeitColors[r.verfuegbarkeit] ?? "bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                          >
                            {r.verfuegbarkeit}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.skills.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {s}
                            </span>
                          ))}
                          {r.skills.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{r.skills.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                      {isDisabled && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                          Bereits eingereicht
                        </span>
                      )}
                      {isSelected && !isDisabled && (
                        <IconCheck className="size-4 text-primary mt-0.5 shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSpielen}
                disabled={!selectedRessource || submitting}
              >
                {submitting
                  ? "Wird eingereicht…"
                  : selectedRessource
                  ? `${selectedRessource.name} einsetzen`
                  : "Ressource auswählen"}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ── Tab: Neu anlegen ── */}
          <TabsContent value="neu" className="flex flex-col gap-3 mt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="re-name"
                placeholder="z.B. Max Mustermann"
                value={neuName}
                onChange={(e) => setNeuName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>
                Skills <span className="text-destructive">*</span>
              </Label>
              <TagInput value={neuSkills} onChange={setNeuSkills} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="re-level">
                  Erfahrungslevel <span className="text-destructive">*</span>
                </Label>
                <Select value={neuErfahrungslevel} onValueChange={setNeuErfahrungslevel}>
                  <SelectTrigger id="re-level">
                    <SelectValue placeholder="Wählen…" />
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
                <Label htmlFor="re-verf">Verfügbarkeit</Label>
                <Select value={neuVerfuegbarkeit} onValueChange={setNeuVerfuegbarkeit}>
                  <SelectTrigger id="re-verf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jetzt verfügbar">Jetzt verfügbar</SelectItem>
                    <SelectItem value="Verfügbar ab">Verfügbar ab</SelectItem>
                    <SelectItem value="Nicht verfügbar">Nicht verfügbar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {neuError && (
              <p className="text-sm text-destructive">{neuError}</p>
            )}

            <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Die Ressource wird im Pool gespeichert und sofort auf diese Vakanz gespielt.
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Abbrechen
              </Button>
              <Button onClick={handleNeuAnlegen} disabled={submitting}>
                {submitting ? "Wird angelegt…" : "Anlegen & einsetzen"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ── VakanzenPage ───────────────────────────────────────────────────────────────

export default function VakanzenPage() {
  const { user } = useUser()

  const isManagerOrAdmin =
    user?.rolle === "Admin" || user?.rolle === "Staffhub Manager"
  const isAgentur = user?.rolle === "Agentur"

  // Data state
  const [vakanzen, setVakanzen] = React.useState<Vakanz[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = React.useState("alle")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Sheet / Dialog state
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editingVakanz, setEditingVakanz] = React.useState<Vakanz | null>(null)

  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false)
  const [closingVakanz, setClosingVakanz] = React.useState<Vakanz | null>(null)

  const [profilSheetOpen, setProfilSheetOpen] = React.useState(false)
  const [profilVakanz, setProfilVakanz] = React.useState<Vakanz | null>(null)

  const [ressourceEinsetzenOpen, setRessourceEinsetzenOpen] = React.useState(false)
  const [ressourceEinsetzenVakanz, setRessourceEinsetzenVakanz] = React.useState<Vakanz | null>(null)

  // Slack posting state
  const [detailpostDialogOpen, setDetailpostDialogOpen] = React.useState(false)
  const [detailpostVakanz, setDetailpostVakanz] = React.useState<Vakanz | null>(null)
  const [updatepostDialogOpen, setUpdatepostDialogOpen] = React.useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchVakanzen() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/vakanzen")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setVakanzen(data.vakanzen ?? data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Daten konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchVakanzen()
  }, [])

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filtered = vakanzen.filter((v) => {
    const matchesStatus = statusFilter === "alle" || v.status === statusFilter
    const matchesSearch =
      searchQuery === "" ||
      v.rolle.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // ── Action handlers ────────────────────────────────────────────────────────

  function handleNeueVakanz() {
    setSheetMode("create")
    setEditingVakanz(null)
    setSheetOpen(true)
  }

  function handleBearbeiten(vakanz: Vakanz) {
    setSheetMode("edit")
    setEditingVakanz(vakanz)
    setSheetOpen(true)
  }

  function handleSchließen(vakanz: Vakanz) {
    setClosingVakanz(vakanz)
    setCloseDialogOpen(true)
  }

  function handleDetailpostOpen(vakanz: Vakanz) {
    setDetailpostVakanz(vakanz)
    setDetailpostDialogOpen(true)
  }

  async function handleDetailpostConfirm(workspace: SlackWorkspace, channel: SlackChannel) {
    if (!detailpostVakanz) return
    try {
      const res = await fetch(`/api/vakanzen/${detailpostVakanz.id}/slack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, channel }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Detailpost fehlgeschlagen.")
        return
      }
      toast.success(`Detailpost in ${workspace === "freelance" ? "Freelance" : "Partner"} → ${channel} gesendet.`)
      setVakanzen((prev) =>
        prev.map((v) =>
          v.id === detailpostVakanz.id
            ? { ...v, slack_detail_posted_at: body.slack_detail_posted_at ?? new Date().toISOString() }
            : v
        )
      )
    } catch {
      toast.error("Verbindungsfehler beim Detailpost.")
    }
  }

  async function handleUpdatepostConfirm(workspace: SlackWorkspace, channel: SlackChannel) {
    try {
      const res = await fetch("/api/slack/updatepost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, channel }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? "Updatepost fehlgeschlagen.")
        return
      }
      toast.success(
        `Updatepost gesendet (${body.vakanzen_count ?? "?"} Vakanzen → ${workspace === "freelance" ? "Freelance" : "Partner"} / ${channel}).`
      )
    } catch {
      toast.error("Verbindungsfehler beim Updatepost.")
    }
  }

  // ── Column count for skeleton (budget + gepostet columns conditional) ──────
  const colCount = isManagerOrAdmin ? 10 : 8

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
        <SiteHeader title="Vakanzen" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">

              {/* Header + Actions */}
              <div className="flex items-center justify-between px-4 lg:px-6">
                <div>
                  <h2 className="text-xl font-semibold">Vakanzen</h2>
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Lädt…" : `${filtered.length} Vakanzen gefunden`}
                  </p>
                </div>
                {isManagerOrAdmin && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUpdatepostDialogOpen(true)}
                      className="gap-1.5"
                    >
                      <IconRefresh className="size-4" />
                      Updatepost
                    </Button>
                    <Button size="sm" onClick={handleNeueVakanz}>
                      <IconPlus className="size-4" />
                      Neue Vakanz
                    </Button>
                  </div>
                )}
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Vakanz suchen…"
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

              {/* Error state */}
              {error && (
                <div className="mx-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-6">
                  Fehler beim Laden der Vakanzen: {error}
                </div>
              )}

              {/* Table */}
              <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>Skills</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Modell</TableHead>
                        <TableHead className="text-center">Profile</TableHead>
                        {isManagerOrAdmin && (
                          <>
                            <TableHead className="text-right">Budget</TableHead>
                            <TableHead className="w-24 text-center">Gepostet</TableHead>
                          </>
                        )}
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableSkeletonRows cols={colCount} />
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={colCount}
                            className="h-32 text-center text-muted-foreground"
                          >
                            {vakanzen.length === 0 && isManagerOrAdmin ? (
                              <span>
                                Noch keine Vakanzen angelegt.{" "}
                                <button
                                  className="text-primary underline-offset-4 hover:underline"
                                  onClick={handleNeueVakanz}
                                >
                                  Neue Vakanz erstellen
                                </button>
                              </span>
                            ) : (
                              "Keine Vakanzen gefunden."
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[v.status]}`}
                              >
                                {v.status}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">{v.rolle}</TableCell>
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
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {v.startdatum}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${arbeitsmodellColors[v.arbeitsmodell]}`}
                              >
                                {v.arbeitsmodell}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-sm font-medium tabular-nums">
                              {v.profile_anzahl ?? 0}
                            </TableCell>
                            {isManagerOrAdmin && (
                              <>
                                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                  {v.budget_intern != null
                                    ? `${v.budget_intern.toLocaleString("de-DE")} €`
                                    : "–"}
                                </TableCell>
                                <TableCell className="text-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex justify-center">
                                          {v.slack_detail_posted_at ? (
                                            <IconCheck className="size-4 text-green-600" />
                                          ) : (
                                            <IconClock className="size-4 text-muted-foreground/40" />
                                          )}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        {v.slack_detail_posted_at
                                          ? `Gepostet: ${new Date(v.slack_detail_posted_at).toLocaleString("de-DE")}`
                                          : "Noch nicht gepostet"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                              </>
                            )}
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
                                <DropdownMenuContent align="end" className="w-48">
                                  {isManagerOrAdmin ? (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => handleBearbeiten(v)}
                                      >
                                        Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDetailpostOpen(v)}
                                      >
                                        <IconBrandSlack className="size-3.5 text-[#4A154B]" />
                                        Detailpost senden
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        disabled={v.status === "Geschlossen"}
                                        onClick={() => handleSchließen(v)}
                                      >
                                        Schließen
                                      </DropdownMenuItem>
                                    </>
                                  ) : isAgentur ? (
                                    <>
                                      <DropdownMenuItem
                                        disabled={v.status !== "Offen"}
                                        onClick={() => {
                                          setRessourceEinsetzenVakanz(v)
                                          setRessourceEinsetzenOpen(true)
                                        }}
                                      >
                                        Ressource einsetzen
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        disabled={v.status !== "Offen"}
                                        onClick={() => {
                                          setProfilVakanz(v)
                                          setProfilSheetOpen(true)
                                        }}
                                      >
                                        Profil einreichen
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
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

      {/* VakanzFormSheet */}
      <VakanzFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        vakanz={editingVakanz}
        showBudget={isManagerOrAdmin}
        onSuccess={fetchVakanzen}
      />

      {/* VakanzSchließenDialog */}
      <VakanzSchließenDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        vakanz={closingVakanz}
        onSuccess={fetchVakanzen}
      />

      {/* ProfilEinreichenSheet */}
      {profilVakanz && (
        <ProfilEinreichenSheet
          open={profilSheetOpen}
          onOpenChange={setProfilSheetOpen}
          vakanzId={profilVakanz.id}
          vakanzTitel={profilVakanz.rolle}
          onSuccess={(newProfilId?: string) => {
            fetchVakanzen()
            if (newProfilId) {
              fetch(`/api/profile/${newProfilId}/ki-bewertung`, { method: "POST" }).catch(() => {})
            }
          }}
        />
      )}

      {/* RessourceEinsetzenDialog */}
      {ressourceEinsetzenVakanz && (
        <RessourceEinsetzenDialog
          open={ressourceEinsetzenOpen}
          onOpenChange={setRessourceEinsetzenOpen}
          vakanzId={ressourceEinsetzenVakanz.id}
          vakanzTitel={ressourceEinsetzenVakanz.rolle}
          onSuccess={fetchVakanzen}
        />
      )}

      {/* Detailpost Dialog */}
      <SlackPostDialog
        open={detailpostDialogOpen}
        onOpenChange={setDetailpostDialogOpen}
        postType="detail"
        vakanzTitel={detailpostVakanz?.rolle}
        onConfirm={handleDetailpostConfirm}
      />

      {/* Updatepost Dialog */}
      <SlackPostDialog
        open={updatepostDialogOpen}
        onOpenChange={setUpdatepostDialogOpen}
        postType="update"
        onConfirm={handleUpdatepostConfirm}
      />
    </SidebarProvider>
  )
}
