/**
 * Email adapter entry point (D-06)
 *
 * Default provider: Resend (official SDK, free tier, no domain setup needed for dev).
 * Fallback: SMTP via nodemailer (see smtp.js for activation instructions).
 *
 * To swap providers, change the import below to:
 *   export { sendEmail } from './smtp.js';
 *
 * Both providers export the same interface:
 *   sendEmail({ to: string, subject: string, html: string }): Promise<void>
 */

export { sendEmail } from './resend.js';
