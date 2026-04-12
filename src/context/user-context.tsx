'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Rolle = 'Admin' | 'Staffhub Manager' | 'Agentur'

export interface UserProfile {
  id: string
  name: string
  email: string
  rolle: Rolle
  agentur_id: string | null
  aktiv: boolean
}

interface UserContextValue {
  user: UserProfile | null
  loading: boolean
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true })

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      setUser(null)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, rolle, agentur_id, aktiv')
      .eq('id', authUser.id)
      .single()

    setUser(profile as UserProfile | null)
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadProfile()
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
