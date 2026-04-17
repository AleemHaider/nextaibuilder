// Slack incoming webhook notifier
// Fire-and-forget — never throws, silently no-ops if SLACK_ERROR_WEBHOOK_URL is not set.

type Severity = 'error' | 'fatal'

const COLORS: Record<Severity, string> = {
  error: '#ff8c5a',
  fatal: '#d73027',
}

const ICONS: Record<Severity, string> = {
  error: '🔴',
  fatal: '💀',
}

interface SlackAlertOptions {
  severity: Severity
  title: string
  message: string
  stack?: string
  context?: string
}

export async function sendSlackAlert(opts: SlackAlertOptions): Promise<void> {
  const webhookUrl = process.env.SLACK_ERROR_WEBHOOK_URL
  if (!webhookUrl) return

  const { severity, title, message, stack, context } = opts
  const truncatedStack = stack ? stack.slice(0, 1500) : undefined

  const fields = [
    { type: 'mrkdwn', text: `*Environment*\n\`${process.env.NODE_ENV ?? 'unknown'}\`` },
    { type: 'mrkdwn', text: `*Time*\n\`${new Date().toISOString()}\`` },
    ...(context ? [{ type: 'mrkdwn', text: `*Context*\n\`${context}\`` }] : []),
  ]

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${ICONS[severity]} *${title}*\n\`\`\`${message}\`\`\``,
      },
    },
    { type: 'section', fields },
    ...(truncatedStack
      ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Stack*\n\`\`\`${truncatedStack}\`\`\`` } }]
      : []),
  ]

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{ color: COLORS[severity], blocks }],
      }),
    })
  } catch (err) {
    console.error('[slack] Failed to send alert:', err)
  }
}
