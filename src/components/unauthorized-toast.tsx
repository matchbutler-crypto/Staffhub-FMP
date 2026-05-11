'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

function UnauthorizedToastInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (searchParams.get('unauthorized') === '1') {
      toast.error('Keine Berechtigung für diesen Bereich.')
      router.replace(pathname)
    }
  }, [searchParams, router, pathname])

  return null
}

export function UnauthorizedToast() {
  return (
    <Suspense>
      <UnauthorizedToastInner />
    </Suspense>
  )
}
