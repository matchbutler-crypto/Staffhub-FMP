// ── Slack Webhook URL Configuration ──────────────────────────────────────────
// Hardcoded defaults from Detailpost.rtf (can be overridden via ENV vars).
// ENV-var naming: SLACK_{DETAIL|UPDATE}_{FREELANCE|PARTNER}_{TESTING|GERMANY|GLOBAL}

export type SlackWorkspace = 'freelance' | 'partner'
export type SlackChannel = 'testing' | 'germany' | 'global'
export type SlackPostType = 'detail' | 'update'

// ── Default webhook URLs (source: Detailpost.rtf) ─────────────────────────────

const DETAIL_DEFAULTS: Record<SlackWorkspace, Record<SlackChannel, string>> = {
  freelance: {
    testing: 'https://hooks.slack.com/services/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',
    germany: 'https://hooks.slack.com/services/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',
    global:  'https://hooks.slack.com/services/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',
  },
  partner: {
    testing: 'https://hooks.slack.com/services/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',
    germany: 'https://hooks.slack.com/services/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',
    global:  'https://hooks.slack.com/services/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',
  },
}

const UPDATE_DEFAULTS: Record<SlackWorkspace, Record<SlackChannel, string>> = {
  freelance: {
    testing: 'https://hooks.slack.com/services/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',
    germany: 'https://hooks.slack.com/services/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',
    global:  'https://hooks.slack.com/services/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',
  },
  partner: {
    testing: 'https://hooks.slack.com/services/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',
    germany: 'https://hooks.slack.com/services/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',
    global:  'https://hooks.slack.com/services/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',
  },
}

// ── URL resolver ──────────────────────────────────────────────────────────────

/**
 * Returns the webhook URL for the given post type, workspace, and channel.
 * ENV vars take precedence over hardcoded defaults.
 * Returns null if neither ENV var nor default is available (should not happen).
 */
export function getWebhookUrl(
  postType: SlackPostType,
  workspace: SlackWorkspace,
  channel: SlackChannel
): string | null {
  const envKey = `SLACK_${postType.toUpperCase()}_${workspace.toUpperCase()}_${channel.toUpperCase()}`
  const envValue = process.env[envKey]
  if (envValue) return envValue

  const defaults = postType === 'detail' ? DETAIL_DEFAULTS : UPDATE_DEFAULTS
  return defaults[workspace]?.[channel] ?? null
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
}
