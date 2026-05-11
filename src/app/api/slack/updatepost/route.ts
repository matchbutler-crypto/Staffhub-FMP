import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  getWebhookUrl,
  type SlackWorkspace,
  type SlackChannel,
} from '@/lib/slack-webhooks'

// ── Input Schema ──────────────────────────────────────────────────────────────

const bodySchema = z.object({
  workspace: z.enum(['freelance', 'partner']),
  channel: z.enum(['testing', 'germany', 'global']),
})

// ── Updatepost Block Builder (AppScript-faithful) ─────────────────────────────
// Format: Header ":eyes: UPDATE DD/MM/YYYY", Divider, then one section per vacancy.
// Status mapping: Offen→NEW, In Auswahl/Besetzt→OPEN, Geschlossen→~titel~ | CLOSED
// Slack block limit is 50 — keep 2 for header+divider → max 48 lines per message.

const CHUNK_SIZE = 48

function buildUpdateBlocks(lines: string[], updateDate: string): object[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:eyes: UPDATE ${updateDate}`,
      },
    },
    { type: 'divider' },
    ...lines.map((line) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: line },
    })),
  ]
}

function statusToLine(titel: string, status: string): string {
  if (status === 'Offen') return `${titel} | NEW`
  if (status === 'In Auswahl' || status === 'Besetzt') return `${titel} | OPEN`
  if (status === 'Geschlossen') return `~${titel}~ | CLOSED`
  return `${titel} | ${status.toUpperCase()}`
}

// ── POST /api/slack/updatepost ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('rolle, aktiv')
    .eq('id', user.id)
    .single()

  if (!userProfile?.aktiv) {
    return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  }
  if (userProfile.rolle !== 'Staffhub Manager' && userProfile.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // ── Input validation ────────────────────────────────────────────────────────
  let body: { workspace: SlackWorkspace; channel: SlackChannel }
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Ungültige Eingabe: workspace und channel erforderlich' }, { status: 400 })
  }

  const { workspace, channel } = body

  // ── Webhook URL ─────────────────────────────────────────────────────────────
  const webhookUrl = getWebhookUrl('update', workspace, channel)
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Webhook-URL nicht konfiguriert für diese Kombination.' },
      { status: 503 }
    )
  }

  // ── Alle relevanten Vakanzen laden ─────────────────────────────────────────
  const { data: vakanzen, error: vakanzError } = await supabase
    .from('vakanzen')
    .select('id, titel, status, budget_intern')
    .in('status', ['Offen', 'In Auswahl', 'Besetzt', 'Geschlossen'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (vakanzError) {
    return NextResponse.json({ error: 'Fehler beim Laden der Vakanzen' }, { status: 500 })
  }

  if (!vakanzen || vakanzen.length === 0) {
    return NextResponse.json({ error: 'Keine Vakanzen für Updatepost vorhanden.' }, { status: 422 })
  }

  // ── Sortieren: NEU → OPEN → CLOSED ─────────────────────────────────────────
  const statusOrder: Record<string, number> = {
    Offen: 0,
    'In Auswahl': 1,
    Besetzt: 2,
    Geschlossen: 3,
  }
  const sorted = [...vakanzen].sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  )

  // ── Zeilen bauen ────────────────────────────────────────────────────────────
  const lines = sorted.map((v) => statusToLine(v.titel, v.status))

  // ── In Chunks à 48 Zeilen aufteilen und senden ─────────────────────────────
  const now = new Date()
  const updateDate = now.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  let slackOk = true
  let errorMsg: string | null = null
  let messagesSent = 0

  for (let start = 0; start < lines.length; start += CHUNK_SIZE) {
    const chunk = lines.slice(start, start + CHUNK_SIZE)
    const blocks = buildUpdateBlocks(chunk, updateDate)

    try {
      const slackRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })
      const slackBody = await slackRes.text()

      if (slackRes.ok && slackBody === 'ok') {
        messagesSent++
      } else {
        slackOk = false
        errorMsg = `HTTP ${slackRes.status}: ${slackBody}`
        break
      }
    } catch (err) {
      slackOk = false
      errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      break
    }
  }

  // ── Log-Eintrag ─────────────────────────────────────────────────────────────
  await supabase.from('slack_post_log').insert({
    vakanz_id: null,
    post_type: 'update',
    workspace,
    channel,
    status: slackOk ? 'success' : 'error',
    error_msg: errorMsg,
    posted_by: user.id,
  })

  if (!slackOk) {
    return NextResponse.json(
      { error: `Slack-Fehler: ${errorMsg}` },
      { status: 502 }
    )
  }

  return NextResponse.json({
    success: true,
    vakanzen_count: vakanzen.length,
    messages_sent: messagesSent,
  })
}
