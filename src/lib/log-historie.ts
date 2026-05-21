import { createClient } from '@/lib/supabase/server'

interface LogHistorieOptions {
  ressourceId: string
  text: string
  typ?: 'system' | 'manuell'
  linkId?: string | null
  erstelltVon?: string | null
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function logHistorie({
  ressourceId,
  text,
  typ = 'system',
  linkId = null,
  erstelltVon = null,
  supabase,
}: LogHistorieOptions): Promise<void> {
  await supabase.from('ressource_historie').insert({
    ressource_id: ressourceId,
    text,
    typ,
    link_id: linkId,
    erstellt_von: erstelltVon,
  })
}
