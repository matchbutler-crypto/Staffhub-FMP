'use client'

import * as React from 'react'

export interface Annotation {
  x: number      // percentage 0-100
  y: number      // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
}

interface AnnotationCanvasProps {
  annotations: Annotation[]
  onChange: (annotations: Annotation[]) => void
  className?: string
}

export function AnnotationCanvas({ annotations, onChange, className }: AnnotationCanvasProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = React.useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)

  function getRelativePos(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    const pos = getRelativePos(e)
    setDrawing({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing) return
    const pos = getRelativePos(e)
    setDrawing((d) => d ? { ...d, currentX: pos.x, currentY: pos.y } : null)
  }

  function onMouseUp() {
    if (!drawing) return
    const x = Math.min(drawing.startX, drawing.currentX)
    const y = Math.min(drawing.startY, drawing.currentY)
    const width = Math.abs(drawing.currentX - drawing.startX)
    const height = Math.abs(drawing.currentY - drawing.startY)
    if (width > 1 && height > 1) {
      onChange([...annotations, { x, y, width, height }])
    }
    setDrawing(null)
  }

  const preview = drawing ? {
    x: Math.min(drawing.startX, drawing.currentX),
    y: Math.min(drawing.startY, drawing.currentY),
    width: Math.abs(drawing.currentX - drawing.startX),
    height: Math.abs(drawing.currentY - drawing.startY),
  } : null

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 cursor-crosshair select-none ${className ?? ''}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {annotations.map((a, i) => (
        <div
          key={i}
          className="absolute border-2 border-red-500 bg-red-500/10"
          style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%` }}
          onClick={(e) => {
            e.stopPropagation()
            onChange(annotations.filter((_, idx) => idx !== i))
          }}
        />
      ))}
      {preview && (
        <div
          className="absolute border-2 border-red-500 bg-red-500/10 pointer-events-none"
          style={{ left: `${preview.x}%`, top: `${preview.y}%`, width: `${preview.width}%`, height: `${preview.height}%` }}
        />
      )}
    </div>
  )
}
