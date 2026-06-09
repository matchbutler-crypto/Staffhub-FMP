'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { getWikiPageBySlug } from '@/lib/wiki'

export function useTour() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tourSlug = searchParams.get('tour')

  useEffect(() => {
    if (!tourSlug) return

    const page = getWikiPageBySlug(tourSlug)
    if (!page?.tour || page.tour.length === 0) return

    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Weiter',
      prevBtnText: 'Zurück',
      doneBtnText: 'Fertig',
      progressText: '{{current}} von {{total}}',
      onDestroyed: () => {
        const url = new URL(window.location.href)
        url.searchParams.delete('tour')
        router.replace(url.pathname, { scroll: false })
      },
      steps: page.tour.map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
        },
      })),
    })

    const timer = setTimeout(() => driverObj.drive(), 300)
    return () => {
      clearTimeout(timer)
      driverObj.destroy()
    }
  }, [tourSlug, router])
}
