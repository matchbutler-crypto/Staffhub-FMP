'use client'

import { useUser } from '@/context/user-context'
import type { FeatureKey } from '@/lib/features'

export function useFeatures() {
  const { user } = useUser()

  function enabled(key: FeatureKey): boolean {
    if (!user) return false
    if (user.rolle !== 'Agentur') return true
    return user.features?.[key] === true
  }

  return { enabled }
}
