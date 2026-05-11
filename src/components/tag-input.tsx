'use client'

import * as React from 'react'
import { IconX } from '@tabler/icons-react'

interface TagInputProps {
  value: string[]
  onChange: (v: string[]) => void
  error?: string
  placeholder?: string
  maxTags?: number
}

export function TagInput({
  value,
  onChange,
  error,
  placeholder = 'Tag eingeben, Enter drücken',
  maxTags = 20,
}: TagInputProps) {
  const [input, setInput] = React.useState('')

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const trimmed = input.trim()
      if (!value.includes(trimmed) && value.length < maxTags) {
        onChange([...value, trimmed])
      }
      setInput('')
    }
    if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={`flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs focus-within:ring-1 focus-within:ring-ring ${
          error ? 'border-destructive' : 'border-input'
        }`}
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
          placeholder={value.length === 0 ? placeholder : ''}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
