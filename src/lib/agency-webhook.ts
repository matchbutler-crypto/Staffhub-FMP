// src/lib/agency-webhook.ts
import { createHmac } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const INTERNAL_TO_API: Record<string, string> = {
  'Gespielt':           'SUBMITTED',
  'Interview geplant':  'INTERVIEW',
  'Zugesagt':           'RESERVED',
  'Beauftragt':         'BOOKED',
  'Abgelehnt':          'REJECTED',
  'Abgesagt':           'WITHDRAWN',
  'Zurückgezogen':      'WITHDRAWN',
}

export function mapSubmissionStatus(internal: string): string {
  return INTERNAL_TO_API[internal] ?? 'SUBMITTED'
}

async function sendToAgency(url: string, secret: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload)
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-staffhub-signature': sig },
    body,
  })
  if (!res.ok) {
    console.error(`Agency webhook HTTP ${res.status} for event "${(payload as { event?: string }).event}"`)
  }
}

async function loadAllAgencyWebhooks(): Promise<{ url: string; secret: string }[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('agenturen')
    .select('agency_webhook_url, agency_webhook_secret')
    .not('agency_webhook_url', 'is', null)
    .not('agency_webhook_secret', 'is', null)
  return (data ?? []).map((a) => ({
    url: a.agency_webhook_url as string,
    secret: a.agency_webhook_secret as string,
  }))
}

async function loadAgencyWebhook(agenturId: string): Promise<{ url: string; secret: string } | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('agenturen')
    .select('agency_webhook_url, agency_webhook_secret')
    .eq('id', agenturId)
    .not('agency_webhook_url', 'is', null)
    .not('agency_webhook_secret', 'is', null)
    .single()
  if (!data) return null
  return { url: data.agency_webhook_url as string, secret: data.agency_webhook_secret as string }
}

// Broadcast an alle Agenturen mit Webhook
export async function sendPositionPublished(vakanzId: string, position: Record<string, unknown>): Promise<void> {
  const hooks = await loadAllAgencyWebhooks()
  await Promise.all(hooks.map((h) => sendToAgency(h.url, h.secret, { event: 'position.published', position })))
}

export async function sendPositionClosed(vakanzId: string, reason: 'FILLED' | 'CANCELLED'): Promise<void> {
  const hooks = await loadAllAgencyWebhooks()
  await Promise.all(hooks.map((h) => sendToAgency(h.url, h.secret, { event: 'position.closed', positionId: vakanzId, reason })))
}

// Nur an die Agentur der Ressource
export async function sendSubmissionStatusChanged(opts: {
  vakanzId: string
  profileId: string
  externalRef: string | null
  internalStatus: string
  agenturId: string
}): Promise<void> {
  const hook = await loadAgencyWebhook(opts.agenturId)
  if (!hook) return
  await sendToAgency(hook.url, hook.secret, {
    event: 'submission.status_changed',
    positionId: opts.vakanzId,
    profileId: opts.profileId,
    externalRef: opts.externalRef,
    status: mapSubmissionStatus(opts.internalStatus),
    updatedAt: new Date().toISOString(),
  })
}
