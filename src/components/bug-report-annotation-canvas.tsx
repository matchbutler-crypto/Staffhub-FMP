'use client'

import * as React from 'react'
import {
  IconArrowUpRight,
  IconSquare,
  IconArrowBackUp,
  IconCheck,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'

type Tool = 'arrow' | 'rect'

interface Shape {
  tool: Tool
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Props {
  screenshotDataUrl: string
  onDone: (dataUrl: string) => void
  onSubmit: () => void
  onRetake: () => void
  submitting: boolean
}

export function AnnotationCanvas({ screenshotDataUrl, onDone, onSubmit, onRetake, submitting }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = React.useState<Tool>('arrow')
  const [shapes, setShapes] = React.useState<Shape[]>([])
  const [drawing, setDrawing] = React.useState(false)
  const [current, setCurrent] = React.useState<Omit<Shape, 'tool'> | null>(null)
  const [imageEl, setImageEl] = React.useState<HTMLImageElement | null>(null)
  const [done, setDone] = React.useState(false)

  // Bild laden
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => setImageEl(img)
    img.src = screenshotDataUrl
  }, [screenshotDataUrl])

  // Canvas neu zeichnen wenn shapes oder current sich ändert
  React.useEffect(() => {
    if (!canvasRef.current || !imageEl) return
    const ctx = canvasRef.current.getContext('2d')!
    canvasRef.current.width = imageEl.naturalWidth
    canvasRef.current.height = imageEl.naturalHeight
    ctx.drawImage(imageEl, 0, 0)
    drawShapes(ctx, shapes)
    if (current) drawShapes(ctx, [{ ...current, tool }])
  }, [shapes, current, imageEl, tool])

  function drawShapes(ctx: CanvasRenderingContext2D, list: Shape[]) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    for (const s of list) {
      if (s.tool === 'rect') {
        ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1)
      } else {
        // Pfeil: Linie + Pfeilkopf
        const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
        const headLen = 16

        ctx.beginPath()
        ctx.moveTo(s.x1, s.y1)
        ctx.lineTo(s.x2, s.y2)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(s.x2, s.y2)
        ctx.lineTo(
          s.x2 - headLen * Math.cos(angle - Math.PI / 6),
          s.y2 - headLen * Math.sin(angle - Math.PI / 6)
        )
        ctx.moveTo(s.x2, s.y2)
        ctx.lineTo(
          s.x2 - headLen * Math.cos(angle + Math.PI / 6),
          s.y2 - headLen * Math.sin(angle + Math.PI / 6)
        )
        ctx.stroke()
      }
    }
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (done) return
    const { x, y } = getPos(e)
    setDrawing(true)
    setCurrent({ x1: x, y1: y, x2: x, y2: y })
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !current) return
    const { x, y } = getPos(e)
    setCurrent((c) => c ? { ...c, x2: x, y2: y } : c)
  }

  function onMouseUp() {
    if (!drawing || !current) return
    setShapes((prev) => [...prev, { ...current, tool }])
    setCurrent(null)
    setDrawing(false)
  }

  function undo() {
    setShapes((prev) => prev.slice(0, -1))
    setDone(false)
  }

  function handleDone() {
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    onDone(dataUrl)
    setDone(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1">
        <Button
          size="sm"
          variant={tool === 'arrow' ? 'default' : 'ghost'}
          onClick={() => setTool('arrow')}
          className="gap-1 h-7 px-2 text-xs"
        >
          <IconArrowUpRight size={14} /> Pfeil
        </Button>
        <Button
          size="sm"
          variant={tool === 'rect' ? 'default' : 'ghost'}
          onClick={() => setTool('rect')}
          className="gap-1 h-7 px-2 text-xs"
        >
          <IconSquare size={14} /> Rechteck
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={shapes.length === 0}
          className="gap-1 h-7 px-2 text-xs"
        >
          <IconArrowBackUp size={14} /> Undo
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetake}
            className="gap-1 h-7 px-2 text-xs"
          >
            <IconRefresh size={14} /> Neu aufnehmen
          </Button>
          {!done ? (
            <Button
              size="sm"
              onClick={handleDone}
              className="gap-1 h-7 px-2 text-xs"
            >
              <IconCheck size={14} /> Fertig
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
              className="gap-1 h-7 px-2 text-xs"
            >
              <IconSend size={14} />
              {submitting ? 'Senden…' : 'Absenden'}
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="overflow-auto rounded-md border bg-muted/20">
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="max-w-full cursor-crosshair"
          style={{ display: 'block' }}
        />
      </div>

      {done && (
        <p className="text-xs text-muted-foreground">
          Annotation gespeichert. Klicke „Absenden" um den Bug zu melden.
        </p>
      )}
    </div>
  )
}
