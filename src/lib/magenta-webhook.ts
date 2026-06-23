import { createHmac } from 'crypto'

export type RessourceSnapshot = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(' ')
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

async function sendWebhook(payload: unknown): Promise<void> {
  const url = process.env.MAGENTA_WEBHOOK_URL
  const secret = process.env.MAGENTA_WEBHOOK_SECRET
  if (!url || !secret) return

  const body = JSON.stringify(payload)
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-staffhub-signature': sig },
    body,
  })

  if (!res.ok) {
    console.error(`MagentaOS webhook HTTP ${res.status} für event "${(payload as { event?: string }).event}"`)
  }
}

export async function sendProfileProposed(vakanzId: string, ressource: RessourceSnapshot): Promise<void> {
  const { firstName, lastName } = splitName(ressource.name)
  await sendWebhook({
    event: 'profile.proposed',
    vakanzId,
    profile: { id: ressource.id, firstName, lastName, email: ressource.email, phone: ressource.phone },
  })
}

export async function sendProfileUpdated(
  vakanzId: string,
  ressource: RessourceSnapshot,
  status: 'BOOKED' | 'UNAVAILABLE'
): Promise<void> {
  const { firstName, lastName } = splitName(ressource.name)
  await sendWebhook({
    event: 'profile.updated',
    vakanzId,
    profile: { id: ressource.id, status, firstName, lastName },
  })
}
