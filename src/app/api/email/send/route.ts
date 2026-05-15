import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, reminderTemplate } from '@/lib/email'

const sendSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().min(1).max(200),
  // Either provide raw html or use the built-in reminder template
  html: z.string().optional(),
  template: z.enum(['reminder']).optional(),
  templateParams: z.object({
    empfaengerName: z.string(),
    betreff: z.string(),
    nachricht: z.string(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().url().optional(),
  }).optional(),
}).refine(
  (d) => d.html || (d.template && d.templateParams),
  { message: 'Entweder html oder template + templateParams angeben', path: ['html'] }
)

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()
  if (!profile?.aktiv || profile.rolle !== 'Admin') return null
  return user
}

// ── POST /api/email/send ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminUser = await requireAdmin(supabase)
  if (!adminUser) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'E-Mail nicht konfiguriert: RESEND_API_KEY fehlt' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { to, subject, html, template, templateParams } = parsed.data

  let finalHtml: string
  if (html) {
    finalHtml = html
  } else if (template === 'reminder' && templateParams) {
    finalHtml = reminderTemplate({ ...templateParams, betreff: subject })
  } else {
    return NextResponse.json({ error: 'Kein E-Mail-Inhalt angegeben' }, { status: 400 })
  }

  try {
    const result = await sendEmail({ to, subject, html: finalHtml })
    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
