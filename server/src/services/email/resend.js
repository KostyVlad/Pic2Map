/**
 * Resend email provider (D-06)
 *
 * Wraps the official resend SDK v6. The SDK's emails.send() returns { data, error }
 * and does NOT throw on API errors — we must check the error field and throw if set.
 *
 * If RESEND_API_KEY is empty, the Resend constructor still works but API calls will
 * be rejected. The route-level try/catch catches that and keeps the 200 contract.
 *
 * Usage: import { sendEmail } from './resend.js'
 *        sendEmail({ to, subject, html })
 *
 * To swap to SMTP: in index.js change the export to point to smtp.js instead.
 */

import { Resend } from 'resend';
import config from '../../config.js';

// Lazily constructed on first send. The resend SDK v6 throws "Missing API key"
// when `new Resend('')` is called, so we must NOT construct it at import time —
// otherwise importing this module (or app.js) crashes whenever RESEND_API_KEY is
// unset, taking down server startup and the test harness. Constructing inside
// sendEmail keeps the empty-key guard below as the real gate.
let resendClient = null;

/**
 * sendEmail — send a transactional email via Resend.
 *
 * @param {{ to: string, subject: string, html: string }} opts
 * @throws {Error} if Resend returns a truthy error field, or if RESEND_API_KEY is not configured
 */
export async function sendEmail({ to, subject, html }) {
  if (!config.RESEND_API_KEY) {
    // Log clearly rather than crashing — the route-level catch will handle this.
    throw new Error('Email not configured: RESEND_API_KEY is not set. Add it to server/.env to enable password-reset emails.');
  }

  if (!resendClient) {
    resendClient = new Resend(config.RESEND_API_KEY);
  }

  const { data, error } = await resendClient.emails.send({
    from: config.MAIL_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    // Resend returns structured errors — surface them for server-side logging
    throw new Error(`Resend email error: ${error.message || JSON.stringify(error)}`);
  }

  return data;
}
