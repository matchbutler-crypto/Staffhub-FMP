import { createAdminClient } from '@/lib/supabase/admin'

interface LogVakanzHistorieOptions {
  vakanzId: string
  text: string
  typ?: 'system' | 'manuell'
  erstelltVon?: string | null
}

export async function logVakanzHistorie({
  vakanzId,
  text,
  typ = 'system',
  erstelltVon = null,
}: LogVakanzHistorieOptions): Promise<void> {
  const admin = createAdminClient()
  await admin.from('vakanz_historie').insert({
    vakanz_id: vakanzId,
    text,
    typ,
    erstellt_von: erstelltVon,
  })
}
