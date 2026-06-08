import nodemailer from 'nodemailer';
import { hasSmtpConfig } from './env.js';

function resetHtml({ username, link }) {
  return `<p>Hi ${username},</p><p>Use this secure link to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`;
}

function verifyHtml({ username, link }) {
  return `<p>Hi ${username},</p><p>Verify your email address for Social Media MVP:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`;
}

export function createEmailService(config) {
  const enabled = hasSmtpConfig(config);
  const transporter = enabled
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: { user: config.smtp.user, pass: config.smtp.pass }
      })
    : null;

  async function sendMail(message) {
    if (!enabled) {
      return { sent: false, reason: 'SMTP is not configured; dev_token returned for local testing.' };
    }
    await transporter.sendMail({ from: config.smtp.from, ...message });
    return { sent: true };
  }

  return {
    enabled,
    async sendPasswordReset(user, token) {
      const link = `${config.publicUrl}/reset-password?token=${encodeURIComponent(token)}`;
      return sendMail({
        to: user.email,
        subject: 'Reset your Social Media MVP password',
        text: `Reset your password: ${link}`,
        html: resetHtml({ username: user.username, link })
      });
    },
    async sendEmailVerification(user, token) {
      const link = `${config.publicUrl}/verify-email?token=${encodeURIComponent(token)}`;
      return sendMail({
        to: user.email,
        subject: 'Verify your Social Media MVP email',
        text: `Verify your email: ${link}`,
        html: verifyHtml({ username: user.username, link })
      });
    }
  };
}
