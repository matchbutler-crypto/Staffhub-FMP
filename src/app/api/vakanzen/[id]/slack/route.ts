import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── POST /api/vakanzen/[id]/slack ─────────────────────────────────────────────
// Sendet eine Vakanz als formatierte Slack-Nachricht via Incoming Webhook.

function buildSlackBlocks(v: {
  titel: string
  rolle: string
  beschreibung: string
  skills: string[]
  erfahrungslevel: string
  startdatum: string
  auslastung_stunden: number
  arbeitsmodell: string
  standort?: string | null
}) {
  const beschreibungKurz = v.beschreibung?.length > 300
    ? v.beschreibung.slice(0, 297) + '…'
    : (v.beschreibung ?? '')

  const startFormatiert = v.startdatum
    ? new Date(v.startdatum).toLocaleDateString('de-DE')
    : '–'

  return {
    text: `Neue Vakanz: ${v.titel}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🆕 Neue Vakanz: ${v.titel}`, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: beschreibungKurz || '_Keine Beschreibung_' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Rolle:*\n${v.rolle}` },
          { type: 'mrkdwn', text: `*Level:*\n${v.erfahrungslevel}` },
          { type: 'mrkdwn', text: `*Skills:*\n${v.skills?.join(', ') || '–'}` },
          { type: 'mrkdwn', text: `*Arbeitsmodell:*\n${v.arbeitsmodell}${v.standort ? ` · ${v.standort}` : ''}` },
          { type: 'mrkdwn', text: `*Startdatum:*\n${startFormatiert}` },
          { type: 'mrkdwn', text: `*Auslastung:*\n${v.auslastung_stunden} h/Woche` },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Gepostet von Staffhub FMP · ${new Date().toLocaleDateString('de-DE')}`,
          },
        ],
      },
    ],
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rolle, aktiv').eq('id', user.id).single()
  if (!profile?.aktiv) return NextResponse.json({ error: 'Account deaktiviert' }, { status: 403 })
  if (profile.rolle !== 'Staffhub Manager' && profile.rolle !== 'Admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Webhook URL
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'SLACK_WEBHOOK_URL nicht konfiguriert. Bitte in .env.local setzen.' },
      { status: 503 }
    )
  }

  // Vakanz laden
  const { data: vakanz, error: vakanzError } = await supabase
    .from('vakanzen')
    .select('titel, rolle, beschreibung, skills, erfahrungslevel, startdatum, auslastung_stunden, arbeitsmodell, standort, slack_ts')
    .eq('id', id)
    .single()

  if (vakanzError || !vakanz) {
    return NextResponse.json({ error: 'Vakanz nicht gefunden' }, { status: 404 })
  }

  // Slack-Nachricht bauen und senden
  const payload = buildSlackBlocks(vakanz as Parameters<typeof buildSlackBlocks>[0])

  let slackRes: Response
  try {
    slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Slack nicht erreichbar: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}` },
      { status: 502 }
    )
  }

  const slackBody = await slackRes.text()
  if (!slackRes.ok || slackBody !== 'ok') {
    return NextResponse.json(
      { error: `Slack-Fehler (HTTP ${slackRes.status}): ${slackBody}` },
      { status: 502 }
    )
  }

  // slack_ts mit aktuellem Timestamp speichern (Webhook gibt keinen ts zurück)
  const slackTs = String(Date.now() / 1000)
  await supabase
    .from('vakanzen')
    .update({ slack_ts: slackTs })
    .eq('id', id)

  return NextResponse.json({ success: true, slack_ts: slackTs })
}
