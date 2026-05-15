import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'StaffHub FMP <noreply@staffhub.digital>'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'E-Mail konnte nicht gesendet werden')
  }

  return { id: data.id }
}

// ── Vorgefertigte E-Mail-Templates ────────────────────────────────────────────

export function reminderTemplate(params: {
  empfaengerName: string
  betreff: string
  nachricht: string
  ctaText?: string
  ctaUrl?: string
}): string {
  const { empfaengerName, betreff, nachricht, ctaText, ctaUrl } = params
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${betreff}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Staffhub FMP</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Hallo ${empfaengerName},</p>
            <p style="margin:0 0 24px;font-size:16px;color:#18181b;line-height:1.6;">${nachricht}</p>
            ${ctaText && ctaUrl ? `
            <a href="${ctaUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">${ctaText}</a>
            ` : ''}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">Diese E-Mail wurde automatisch von Staffhub FMP versandt. Bitte nicht auf diese E-Mail antworten.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
