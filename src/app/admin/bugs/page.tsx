'use client'

import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import {
  IconBug,
  IconExternalLink,
} from '@tabler/icons-react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'

type BugStatus = 'offen' | 'in_bearbeitung' | 'erledigt'

interface BugReport {
  id: string
  beschreibung: string
  screenshot_url: string | null
  seite_url: string
  status: BugStatus
  melder_rolle: string
  created_at: string
  melder: { name: string; rolle: string } | null
}

const COLUMNS: { id: BugStatus; label: string }[] = [
  { id: 'offen', label: 'Offen' },
  { id: 'in_bearbeitung', label: 'In Bearbeitung' },
  { id: 'erledigt', label: 'Erledigt' },
]

// ── Droppable Spalte ────────────────────────────────────────────────────────

function KanbanColumn({
  id,
  label,
  bugs,
  onCardClick,
}: {
  id: BugStatus
  label: string
  bugs: BugReport[]
  onCardClick: (bug: BugReport) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 transition-colors ${
        isOver ? 'bg-muted/80 ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-xs">
          {bugs.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {bugs.map((bug) => (
          <DraggableBugCard key={bug.id} bug={bug} onClick={() => onCardClick(bug)} />
        ))}
      </div>
    </div>
  )
}

// ── Draggable Card ──────────────────────────────────────────────────────────

function DraggableBugCard({ bug, onClick }: { bug: BugReport; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: bug.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-md border bg-background p-3 shadow-sm transition-opacity active:cursor-grabbing ${
        isDragging ? 'opacity-30' : ''
      }`}
      onClick={onClick}
    >
      <BugCardContent bug={bug} />
    </div>
  )
}

function BugCardContent({ bug }: { bug: BugReport }) {
  return (
    <>
      <p className="line-clamp-2 text-sm text-foreground">{bug.beschreibung}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{bug.melder?.name ?? '—'}</span>
        <span>·</span>
        <span>{bug.melder_rolle}</span>
        <span>·</span>
        <span>
          {formatDistanceToNow(new Date(bug.created_at), { addSuffix: true, locale: de })}
        </span>
      </div>
      {bug.screenshot_url && (
        <img
          src={bug.screenshot_url}
          alt="Screenshot"
          className="mt-2 h-12 w-full rounded object-cover object-top"
        />
      )}
      {bug.seite_url && (
        <a
          href={bug.seite_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex items-center gap-1 truncate text-xs text-blue-500 hover:underline"
        >
          <IconExternalLink size={10} />
          {bug.seite_url}
        </a>
      )}
    </>
  )
}

// ── Haupt-Seite ─────────────────────────────────────────────────────────────

export default function AdminBugsPage() {
  const [bugs, setBugs] = React.useState<BugReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeBug, setActiveBug] = React.useState<BugReport | null>(null)
  const [selectedBug, setSelectedBug] = React.useState<BugReport | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  React.useEffect(() => {
    fetch('/api/bugs')
      .then((r) => r.json())
      .then((data) => setBugs(data))
      .catch(() => toast.error('Fehler beim Laden der Bugs'))
      .finally(() => setLoading(false))
  }, [])

  function bugsByStatus(status: BugStatus) {
    return bugs.filter((b) => b.status === status)
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveBug(bugs.find((b) => b.id === e.active.id) ?? null)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveBug(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const bug = bugs.find((b) => b.id === active.id)
    const newStatus = over.id as BugStatus
    if (!bug || bug.status === newStatus) return

    // Optimistisches Update
    setBugs((prev) =>
      prev.map((b) => (b.id === bug.id ? { ...b, status: newStatus } : b))
    )

    const res = await fetch(`/api/bugs/${bug.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      // Rollback
      setBugs((prev) =>
        prev.map((b) => (b.id === bug.id ? { ...b, status: bug.status } : b))
      )
      toast.error('Status konnte nicht gespeichert werden')
    }
  }

  async function handleStatusChange(bugId: string, newStatus: BugStatus) {
    const bug = bugs.find((b) => b.id === bugId)
    if (!bug) return

    setBugs((prev) => prev.map((b) => (b.id === bugId ? { ...b, status: newStatus } : b)))
    setSelectedBug((prev) => (prev?.id === bugId ? { ...prev, status: newStatus } : prev))

    const res = await fetch(`/api/bugs/${bugId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      setBugs((prev) => prev.map((b) => (b.id === bugId ? { ...b, status: bug.status } : b)))
      setSelectedBug((prev) => (prev?.id === bugId ? { ...prev, status: bug.status } : prev))
      toast.error('Fehler beim Speichern')
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex items-center gap-2">
            <IconBug size={20} />
            <h1 className="text-xl font-semibold">Bug-Reports</h1>
            <Badge variant="outline" className="ml-auto">
              {bugs.length} gesamt
            </Badge>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-24" />
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveBug(null)}
            >
              <div className="grid grid-cols-3 gap-4">
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
                    label={col.label}
                    bugs={bugsByStatus(col.id)}
                    onCardClick={setSelectedBug}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeBug && (
                  <div className="cursor-grabbing rounded-md border bg-background p-3 shadow-xl opacity-90">
                    <BugCardContent bug={activeBug} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </SidebarInset>

      {/* Detail Slide-over */}
      <Sheet open={!!selectedBug} onOpenChange={(o) => !o && setSelectedBug(null)}>
        <SheetContent className="w-[480px] overflow-y-auto">
          {selectedBug && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <IconBug size={16} />
                  Bug-Report
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Beschreibung</p>
                  <p className="mt-1 text-sm">{selectedBug.beschreibung}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Seite</p>
                  <a
                    href={selectedBug.seite_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-sm text-blue-500 hover:underline"
                  >
                    <IconExternalLink size={12} />
                    {selectedBug.seite_url}
                  </a>
                </div>

                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Melder</p>
                    <p className="mt-1 text-sm">{selectedBug.melder?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Rolle</p>
                    <p className="mt-1 text-sm">{selectedBug.melder_rolle}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Gemeldet</p>
                    <p className="mt-1 text-sm">
                      {formatDistanceToNow(new Date(selectedBug.created_at), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                  <Select
                    value={selectedBug.status}
                    onValueChange={(v) =>
                      handleStatusChange(selectedBug.id, v as BugStatus)
                    }
                  >
                    <SelectTrigger className="mt-1 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offen">Offen</SelectItem>
                      <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
                      <SelectItem value="erledigt">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedBug.screenshot_url && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                      Screenshot
                    </p>
                    <img
                      src={selectedBug.screenshot_url}
                      alt="Bug Screenshot"
                      className="w-full rounded-md border"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  )
}
