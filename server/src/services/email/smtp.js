/**
 * SMTP email provider — documented fallback for Resend (D-06)
 *
 * nodemailer is NOT installed in this phase. This stub exports the same
 * sendEmail({ to, subject, html }) interface as resend.js so that
 * index.js can switch providers with a single line change.
 *
 * To activate SMTP:
 *  1. Install nodemailer: cd server && npm install nodemailer
 *  2. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in server/.env
 *  3. In index.js, change: export { sendEmail } from './smtp.js'
 *
 * Example nodemailer implementation (fill in when activating):
 *
 *   import nodemailer from 'nodemailer';
 *   import config from '../../config.js';
 *
 *   const transport = nodemailer.createTransport({
 *     host: config.SMTP_HOST,
 *     port: Number(config.SMTP_PORT) || 587,
 *     secure: false,   // true for 465, false for other ports
 *     auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
 *   });
 *
 *   export async function sendEmail({ to, subject, html }) {
 *     await transport.sendMail({ from: config.MAIL_FROM, to, subject, html });
 *   }
 */

/**
 * sendEmail stub — throws with a clear message until nodemailer is wired up.
 *
 * @param {{ to: string, subject: string, html: string }} _opts
 * @throws {Error} always — nodemailer is not configured in this phase
 */
// eslint-disable-next-line no-unused-vars
export async function sendEmail(_opts) {
  throw new Error(
    'SMTP provider not configured. ' +
    'Install nodemailer, set SMTP_HOST/PORT/USER/PASS in server/.env, ' +
    'and implement this function per the comments in smtp.js.'
  );
}
