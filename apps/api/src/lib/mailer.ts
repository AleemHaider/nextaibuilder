// FIR-68 — Nodemailer transporter singleton + sendEmail helper
// Re-exports the existing sendEmail from email.ts for use by notification worker.
// This avoids duplicating the transport setup that already exists in email.ts.

export { sendEmail } from './email.js'
