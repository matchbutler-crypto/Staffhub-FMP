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

// ── Slack Block Builder (AppScript-faithful format) ───────────────────────────

function buildDetailBlocks(
  vakanz: {
    id: string
    titel: string
    rolle: string
    beschreibung: string
    skills: string[]
    erfahrungslevel: string
    startdatum: string
    enddatum?: string | null
    auslastung: number
    arbeitsmodell: string
    standort?: string | null
    branche: string
    teamgroesse?: number | null
    budget_intern?: number | null
  },
  workspace: SlackWorkspace
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const vakanzUrl = `${appUrl}/vakanzen/${vakanz.id}`

  const jobType = workspace === 'partner' ? 'Partner' : 'Freelance'

  const startFormatiert = vakanz.startdatum
    ? new Date(vakanz.startdatum).toLocaleDateString('de-DE')
    : '–'

  let details =
    '*Job Details* \n' +
    ` *Working Location*: ${vakanz.standort ?? '–'}` +
    `\n *Workmode:* ${vakanz.arbeitsmodell}` +
    `\n *Remote Ratio:* ${vakanz.auslastung} %` +
    `\n *Required Skills:* ${vakanz.skills?.join(', ') || '–'}` +
    `\n *Relevant Working Experience:* ${vakanz.erfahrungslevel}` +
    `\n *Industry:* ${vakanz.branche}` +
    `\n *Project Context:* ${vakanz.beschreibung}` +
    `\n *Project Stack:* ${vakanz.skills?.join(', ') || '–'}` +
    `\n *Team Size:* ${vakanz.teamgroesse ?? '–'}` +
    `\n *Job Type:* ${jobType}` +
    `\n *Start date:* ${startFormatiert}` +
    `\n *End date:* ${vakanz.enddatum ? new Date(vakanz.enddatum).toLocaleDateString('de-DE') : '–'}` +
    `\n *Project Language:* –`

  if (workspace === 'partner' && vakanz.budget_intern != null) {
    details += `\n *Rate:* ${vakanz.budget_intern} €`
  }

  const ctaText =
    `@channel If your profile matches the vacancy, submit your CV directly: ${vakanzUrl}\n\n\n\n\n GOOD LUCK :V:\n\n\n\n\n`

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:mega:  ${vakanz.titel} | NEW`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Job Role* \n${vakanz.rolle}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Job Description & Requirements* \n ${vakanz.beschreibung}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: details,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ctaText,
      },
    },
    { type: 'divider' },
  ]
}

// ── POST /api/vakanzen/[id]/slack ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('rolle, aktiv, name')
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
  const webhookUrl = getWebhookUrl('detail', workspace, channel)
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Webhook-URL nicht konfiguriert für diese Kombination.' },
      { status: 503 }
    )
  }

  // ── Vakanz laden ────────────────────────────────────────────────────────────
  const { data: vakanz, error: vakanzError } = await supabase
    .from('vakanzen')
    .select('id, titel, rolle, beschreibung, skills, erfahrungslevel, startdatum, enddatum, auslastung, arbeitsmodell, standort, branche, teamgroesse, budget_intern')
    .eq('id', id)
    .single()

  if (vakanzError || !vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }

  // ── Slack-Nachricht senden ──────────────────────────────────────────────────
  const blocks = buildDetailBlocks(vakanz, workspace)
  let slackOk = false
  let errorMsg: string | null = null

  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    const slackBody = await slackRes.text()

    if (slackRes.ok && slackBody === 'ok') {
      slackOk = true
    } else {
      errorMsg = `HTTP ${slackRes.status}: ${slackBody}`
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler'
  }

  // ── DB-Updates ──────────────────────────────────────────────────────────────
  if (slackOk) {
    const now = new Date().toISOString()
    await supabase
      .from('vakanzen')
      .update({
        slack_ts: String(Date.now() / 1000), // legacy field kept
        slack_detail_posted_at: now,
      })
      .eq('id', id)
  }

  // ── Log-Eintrag ─────────────────────────────────────────────────────────────
  await supabase.from('slack_post_log').insert({
    vakanz_id: id,
    post_type: 'detail',
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
    slack_detail_posted_at: new Date().toISOString(),
  })
}
