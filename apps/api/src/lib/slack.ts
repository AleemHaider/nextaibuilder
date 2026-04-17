// FIR-66 — Slack workspace invitation via Bot API

/**
 * Send a Slack workspace invitation to the given email address.
 * Uses the undocumented users.admin.invite endpoint via the Bot token.
 * Throws if the Slack API responds with ok:false.
 */
export async function sendSlackInvite(email: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    throw new Error('[Slack] SLACK_BOT_TOKEN is not configured')
  }

  const response = await fetch('https://slack.com/api/users.admin.invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email,
      token,
      set_active: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`[Slack] HTTP ${response.status} from Slack API`)
  }

  const body = (await response.json()) as { ok: boolean; error?: string }

  if (!body.ok) {
    throw new Error(`[Slack] Invite failed: ${body.error ?? 'unknown error'}`)
  }
}
