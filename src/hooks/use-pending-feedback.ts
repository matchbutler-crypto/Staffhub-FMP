'use client'

import { useEffect, useState } from 'react'

export function usePendingFeedback() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchCount() {
      try {
        const res = await fetch('/api/feedback/pending-count')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setCount(data.count ?? 0)
      } catch {
        // ignore
      }
    }

    fetchCount()

    function handleFocus() {
      fetchCount()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return count
}
