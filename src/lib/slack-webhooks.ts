// ── Slack Webhook URL Configuration ──────────────────────────────────────────
// URLs werden ausschließlich über Umgebungsvariablen gesetzt (nie im Code).
//
// Naming-Konvention:
//   SLACK_{DETAIL|UPDATE}_{FREELANCE|PARTNER}_{TESTING|GERMANY|GLOBAL}
//
// Beispiel (.env.local oder Vercel Environment Variables):
//   SLACK_DETAIL_FREELANCE_TESTING=https://hooks.slack.com/services/...
//   SLACK_UPDATE_PARTNER_GERMANY=https://hooks.slack.com/services/...

export type SlackWorkspace = 'freelance' | 'partner'
export type SlackChannel = 'testing' | 'germany' | 'global' | 'premiumpartner'
export type SlackPostType = 'detail' | 'update'

// ── URL resolver ──────────────────────────────────────────────────────────────

export function getWebhookUrl(
  postType: SlackPostType,
  workspace: SlackWorkspace,
  channel: SlackChannel
): string | null {
  const envKey = `SLACK_${postType.toUpperCase()}_${workspace.toUpperCase()}_${channel.toUpperCase()}`
  return process.env[envKey] ?? null
}

// ── Channel display helpers ───────────────────────────────────────────────────

export const WORKSPACE_LABELS: Record<SlackWorkspace, string> = {
  freelance: 'Freelance',
  partner: 'Partner',
}

export const CHANNEL_LABELS: Record<SlackChannel, string> = {
  testing: 'Testing',
  germany: 'Germany',
  global: 'Global',
  premiumpartner: 'Premium Partner',
}
