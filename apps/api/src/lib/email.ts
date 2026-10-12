// PBA-134 — Nodemailer transport + branded HTML email templates
import nodemailer from 'nodemailer'

// ── Transport ──────────────────────────────────────────────────────────────

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
})

/**
 * Send a single email via the configured SMTP transport.
 * Throws on delivery failure — callers must handle or use fire-and-forget with .catch().
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@productbuilderacademy.com',
    to,
    subject,
    html,
  })
}

// ── Shared layout wrapper ──────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Product Builder Academy</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f3f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;">

          <!-- Header / Logo -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <!-- Logomark: base64 PNG (works in Gmail, Outlook, Apple Mail) -->
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="data:image/png;base64,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" width="64" height="70" alt="PBA" style="display:block;border:0;" />
                  </td>
                  <!-- Wordmark -->
                  <td style="vertical-align:middle;">
                    <div style="font-size:20px;font-weight:700;color:#1a2744;letter-spacing:-0.5px;line-height:1.1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Product Builder</div>
                    <div style="font-size:10px;font-weight:700;color:#4a9ad4;letter-spacing:0.2em;text-transform:uppercase;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Academy</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px 40px 32px;border:1px solid rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:13px;color:#717182;line-height:1.6;">
              &copy; ${new Date().getFullYear()} Product Builder Academy. All rights reserved.<br />
              You are receiving this email because you are enrolled in a PBA cohort.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── nextaibuilder layout wrapper ─────────────────────────────────────────────
// Separate brand from the PBA layout() above — nextaibuilder (sdk.nextaibuilder.com)
// is a distinct product/brand from Product Builder Academy, sharing this codebase
// but not its identity. Text wordmark instead of an embedded logo image, matching
// how the brand already renders in the site footer.

function nextaibuilderLayout(content: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>nextaibuilder</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f3f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f3f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;">

          <!-- Header / Wordmark -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#1a2744;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">nextaibuilder</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px 40px 32px;border:1px solid rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:13px;color:#717182;line-height:1.6;">
              &copy; ${new Date().getFullYear()} nextaibuilder. All rights reserved.<br />
              ${footerNote}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function nextaibuilderCtaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#ff6347;border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#1a2744;line-height:1.3;">${text}</h1>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;color:#3d3d4d;line-height:1.6;">${text}</p>`
}

function stepPill(stepTitle: string): string {
  return `<div style="display:inline-block;background-color:#edf4fb;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:600;color:#4a9ad4;margin:8px 0 20px;">${stepTitle}</div>`
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#ff8c5a;border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:24px 0;" />`
}

// ── Email templates ────────────────────────────────────────────────────────

/**
 * Sent when a student's step submission is approved.
 */
export function stepApprovedTemplate(firstName: string, stepTitle: string): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  return layout(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background-color:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">&#10003;</div>
    </div>
    ${heading(`Great work, ${firstName}!`)}
    ${paragraph('Your submission has been reviewed and <strong style="color:#1a2744;">approved</strong>. You\'ve completed:')}
    ${stepPill(stepTitle)}
    ${paragraph('Keep up the momentum — your next step is waiting. Every step you complete brings you closer to becoming a product builder.')}
    ${ctaButton('Continue to Dashboard', `${appUrl}/dashboard`)}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">If you have any questions, reply to this email or reach out to your cohort facilitator.</span>')}
  `)
}

/**
 * Sent when a student's step submission is rejected.
 */
export function stepRejectedTemplate(
  firstName: string,
  stepTitle: string,
  feedback: string,
): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  return layout(`
    ${heading(`Hi ${firstName}, your submission needs a revision`)}
    ${paragraph('Your submission for the following step has been reviewed:')}
    ${stepPill(stepTitle)}
    <div style="background-color:#fff8f6;border-left:4px solid #ff8c5a;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#717182;text-transform:uppercase;letter-spacing:0.05em;">Reviewer Feedback</p>
      <p style="margin:0;font-size:15px;color:#3d3d4d;line-height:1.6;">${feedback}</p>
    </div>
    ${paragraph('Take another look at the requirements, make the necessary changes, and re-submit when you\'re ready. You\'ve got this!')}
    ${ctaButton('Re-submit Screenshot', `${appUrl}/dashboard`)}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">Need help? Reach out to your cohort facilitator — we\'re here to support you.</span>')}
  `)
}

/**
 * Sent immediately after a student creates their account.
 */
export function welcomeTemplate(firstName: string): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  return layout(`
    ${heading(`Welcome to Product Builder Academy, ${firstName}!`)}
    ${paragraph('You\'ve taken the first step toward becoming a product builder. We\'re excited to have you on board.')}
    ${paragraph('Here\'s what to expect on your journey:')}
    <ul style="margin:0 0 20px;padding-left:20px;color:#3d3d4d;font-size:15px;line-height:2;">
      <li>Guided setup steps to configure your builder toolkit</li>
      <li>Screenshot validations to verify your progress</li>
      <li>Badges and certificates as you hit milestones</li>
      <li>Cohort support from your facilitator and fellow builders</li>
    </ul>
    ${ctaButton('Go to Dashboard', `${appUrl}/dashboard`)}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">Questions? Reply to this email or contact your cohort facilitator.</span>')}
  `)
}

/**
 * Sent to students who have been inactive for 3–6 days.
 */
export function nudgeTemplate(firstName: string, daysSinceLastActive: number): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  const dayText = daysSinceLastActive === 1 ? '1 day' : `${daysSinceLastActive} days`
  return layout(`
    ${heading(`Hey ${firstName}, we miss you!`)}
    ${paragraph(`It looks like you haven't logged in for <strong style="color:#1a2744;">${dayText}</strong>. Consistency is key to becoming a product builder — even 15 minutes a day adds up.`)}
    ${paragraph('Pick up right where you left off. Your progress is saved and your cohort is waiting for you.')}
    ${ctaButton('Jump Back In', `${appUrl}/dashboard`)}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">If you\'re facing any challenges, reach out to your cohort facilitator — we\'re here to help.</span>')}
  `)
}

// ── Admin auth email templates (PBA-247) ──────────────────────────────────

/**
 * Sent to an admin when they attempt to log in with 2FA enabled, or as SUPER_ADMIN.
 * Displays a 6-digit OTP code that expires in 10 minutes.
 */
export function adminOtpEmailTemplate(code: string, firstName: string): string {
  return layout(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background-color:#edf4fb;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">&#128274;</div>
    </div>
    ${heading(`Your verification code, ${firstName}`)}
    ${paragraph('Use the code below to complete your admin sign-in. This code expires in <strong style="color:#1a2744;">10 minutes</strong> and can only be used once.')}
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background-color:#f3f3f5;border-radius:12px;padding:20px 40px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:0.25em;color:#1a2744;font-family:monospace;">${code}</span>
      </div>
    </div>
    ${paragraph('<span style="color:#717182;font-size:14px;">If you did not attempt to sign in, please change your password immediately and contact your system administrator.</span>')}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">For security, never share this code with anyone.</span>')}
  `)
}

/**
 * Sent to a newly created sub-admin to invite them to set their password.
 */
export function adminSetPasswordTemplate(firstName: string, setPasswordUrl: string): string {
  return layout(`
    ${heading(`Welcome to the admin panel, ${firstName}!`)}
    ${paragraph('Your admin account for <strong style="color:#1a2744;">Product Builder Academy</strong> has been created. To get started, set a password for your account using the button below.')}
    ${paragraph('This invitation link expires in <strong style="color:#1a2744;">24 hours</strong>.')}
    ${ctaButton('Set Your Password', setPasswordUrl)}
    ${divider()}
    <p style="margin:0 0 8px;font-size:13px;color:#717182;line-height:1.6;">Or copy and paste this link into your browser:</p>
    <p style="margin:0;font-size:13px;color:#4a9ad4;word-break:break-all;">${setPasswordUrl}</p>
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">If you did not expect this invitation, you can safely ignore this email.</span>')}
  `)
}

/**
 * Sent to an admin who has requested a password reset.
 */
export function adminPasswordResetTemplate(firstName: string, resetUrl: string): string {
  return layout(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background-color:#fff3f0;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">&#128273;</div>
    </div>
    ${heading(`Reset your password, ${firstName}`)}
    ${paragraph('We received a request to reset the password for your Product Builder Academy admin account. Click the button below to choose a new password.')}
    ${paragraph('This link expires in <strong style="color:#1a2744;">1 hour</strong>.')}
    ${ctaButton('Reset My Password', resetUrl)}
    ${divider()}
    <p style="margin:0 0 8px;font-size:13px;color:#717182;line-height:1.6;">Or copy and paste this link into your browser:</p>
    <p style="margin:0;font-size:13px;color:#4a9ad4;word-break:break-all;">${resetUrl}</p>
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</span>')}
  `)
}

/**
 * Sent to a newly invited student to complete registration via Google sign-in.
 * PBA-282 / PBA-338
 */
export function studentInviteTemplate(
  firstName: string,
  cohortName: string,
  setPasswordUrl: string,
): string {
  return layout(`
    ${heading(`Welcome, ${firstName}!`)}
    ${paragraph(`You've been invited to join <strong style="color:#1a2744;">Product Builder Academy</strong> as part of the <strong style="color:#1a2744;">${cohortName}</strong> cohort.`)}
    ${paragraph('To get started, sign in with your Google account to activate your account. This link expires in <strong style="color:#1a2744;">24 hours</strong>.')}
    ${ctaButton('Complete Registration with Google', setPasswordUrl)}
    ${divider()}
    <p style="margin:0 0 8px;font-size:13px;color:#717182;line-height:1.6;">Or copy and paste this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:13px;color:#4a9ad4;word-break:break-all;">${setPasswordUrl}</p>
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">If you did not expect this invitation, you can safely ignore this email.</span>')}
  `)
}

/**
 * Used by the admin broadcast/individual-message feature (admin Messages page).
 */
export function broadcastMessageTemplate(subject: string, bodyText: string): string {
  const bodyHtml = bodyText
    .split('\n')
    .map((line) => `<p style="margin:0 0 12px;font-size:16px;color:#3d3d4d;line-height:1.6;">${line || '&nbsp;'}</p>`)
    .join('')
  return layout(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#1a2744;line-height:1.3;">${subject}</h1>
    ${bodyHtml}
  `)
}

/**
 * PBA-394 — Sent to SUPER_ADMIN users when the HUMAN_REVIEW submission backlog
 * exceeds the configured threshold (default: 10).
 */
export function humanReviewAlertTemplate(count: number, threshold: number): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  return layout(`
    <div style="background-color:#fff3f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <span style="font-size:13px;font-weight:700;color:#d73027;text-transform:uppercase;letter-spacing:0.08em;">&#9888; Admin Action Required</span>
    </div>
    ${heading('Human Review Backlog Alert')}
    ${paragraph(`The HUMAN_REVIEW submission backlog has reached <strong style="color:#1a2744;">${count} submissions</strong>, which meets or exceeds the alert threshold of <strong style="color:#1a2744;">${threshold}</strong>.`)}
    ${paragraph('These submissions could not be automatically validated by the AI system and require manual review by an admin.')}
    ${ctaButton('Review Submissions', `${appUrl}/admin/submissions`)}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">This alert is sent at most once per hour. The threshold can be adjusted via the <code>HUMAN_REVIEW_ALERT_THRESHOLD</code> environment variable.</span>')}
  `)
}

/**
 * sdk.nextaibuilder.com — sent to staff when a new physical-course admission
 * application comes in via the public admission form.
 */
export function admissionNotificationTemplate(fields: {
  fullName: string
  email: string
  phone: string
  track: '6-month' | '1-year'
  message: string | null
}): string {
  // Hardcoded, not FRONTEND_URL — that var points at the main PBA app, which
  // doesn't have an /admin route at all. The admin portal for sdk admissions
  // is only ever reachable on the sdk subdomain.
  const adminUrl = 'https://sdk.nextaibuilder.com/admin/admissions'
  const trackLabel = fields.track === '6-month' ? '6-Month Track' : '1-Year Track'
  return nextaibuilderLayout(`
    <div style="background-color:#e8f4fd;border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <span style="font-size:13px;font-weight:700;color:#4a9ad4;text-transform:uppercase;letter-spacing:0.08em;">New Admission Application</span>
    </div>
    ${heading('New Agentic AI Engineer applicant')}
    ${paragraph(`<strong style="color:#1a2744;">${fields.fullName}</strong> applied to the <strong style="color:#1a2744;">${trackLabel}</strong> from the sdk.nextaibuilder.com landing page.`)}
    ${paragraph(`<strong style="color:#1a2744;">Email:</strong> ${fields.email}<br/><strong style="color:#1a2744;">Phone:</strong> ${fields.phone}`)}
    ${fields.message ? paragraph(`<strong style="color:#1a2744;">Message:</strong><br/>${fields.message}`) : ''}
    ${nextaibuilderCtaButton('Review in Admin', adminUrl)}
  `, 'You are receiving this because you are an admin for the Agentic AI Engineer program.')
}

/**
 * Sent to the applicant immediately after they submit the sdk.nextaibuilder.com
 * admission form — confirms receipt and sets expectations for what happens next.
 * Fire-and-forget from the admissions route; a delivery failure here must never
 * fail the applicant's submission.
 */
export function admissionWelcomeTemplate(fields: {
  fullName: string
  track: '6-month' | '1-year'
}): string {
  const trackLabel = fields.track === '6-month' ? '6-Month Track' : '1-Year Track'
  const firstName = fields.fullName.trim().split(/\s+/)[0] || fields.fullName
  return nextaibuilderLayout(`
    <div style="background-color:#e8f4fd;border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <span style="font-size:13px;font-weight:700;color:#4a9ad4;text-transform:uppercase;letter-spacing:0.08em;">Application Received</span>
    </div>
    ${heading(`Welcome, ${firstName}!`)}
    ${paragraph(`Thanks for applying to the <strong style="color:#1a2744;">Agentic AI Engineer</strong> program — we've received your application for the <strong style="color:#1a2744;">${trackLabel}</strong>.`)}
    ${paragraph(`Applications are reviewed on a rolling basis. Our admissions team will reach out to you by email or phone with next steps, including your cohort dates and setup details.`)}
    ${divider()}
    ${paragraph(`This is an in-person program based at our studio in Sadiqabad, Punjab:<br/><strong style="color:#1a2744;">Plaza No. 11, Al-Haram City, Near New Bus Stand, Sadiqabad, Punjab, Pakistan</strong>`)}
    ${paragraph(`Questions in the meantime? Message us on WhatsApp any time.`)}
    ${nextaibuilderCtaButton('Chat on WhatsApp', 'https://wa.me/923456655181')}
  `, "You're receiving this because you applied for the Agentic AI Engineer program at sdk.nextaibuilder.com.")
}

/**
 * Sent by a coach manually triggering a nudge for a student (PBA-358).
 */
export function coachNudgeTemplate(firstName: string): string {
  return `Hi ${firstName}, your coach wanted to check in and encourage you to keep making progress on your Product Builder Academy setup. Log in and complete your next step when you get a chance!`
}

/**
 * Sent to students who are at risk of missing a cohort deadline.
 */
export function urgencyTemplate(firstName: string, deadline: string): string {
  const appUrl = process.env.FRONTEND_URL ?? 'https://app.productbuilderacademy.com'
  return layout(`
    <div style="background-color:#fff3f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <span style="font-size:13px;font-weight:700;color:#d73027;text-transform:uppercase;letter-spacing:0.08em;">&#9888; Action Required</span>
    </div>
    ${heading(`${firstName}, your cohort deadline is approaching`)}
    ${paragraph(`Your cohort ends on <strong style="color:#1a2744;">${deadline}</strong>. To earn your certificate and complete the program, you\'ll need to finish all required setup steps before then.`)}
    ${paragraph('Log in now, review your remaining steps, and submit — our facilitators are reviewing submissions daily.')}
    ${ctaButton('Complete My Steps Now', `${appUrl}/dashboard`)}
    ${divider()}
    ${paragraph('<span style="color:#717182;font-size:14px;">Need more time or have extenuating circumstances? Contact your cohort facilitator as soon as possible.</span>')}
  `)
}
