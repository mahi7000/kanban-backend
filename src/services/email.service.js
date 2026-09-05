/**
 * Email Service
 *
 * Provides typed email-sending functions for common application events.
 * Uses the Nodemailer transporter from config/email.js.
 *
 * All functions return a Promise; callers should try/catch and log failures
 * rather than letting email errors propagate to the HTTP response.
 */

const { transporter } = require('../config/email');
const logger = require('../utils/logger');

const FROM_ADDRESS = process.env.EMAIL_FROM || `"Kanban App" <${process.env.EMAIL_USER}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send via Resend HTTP API (preferred in production — works over HTTPS 443,
 * unlike SMTP which cloud hosts like Render often cannot reach).
 */
const sendResend = async ({ from, to, subject, html, text }) => {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Resend API error (${response.status}): ${JSON.stringify(data)}`);
    }
    logger.info('Email sent via Resend', { id: data.id, to });
    return data;
  } catch (error) {
    logger.error('Failed to send email via Resend', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send via SendGrid HTTP API (no domain required — works over HTTPS 443).
 */
const parseFrom = (from) => {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim() || undefined, email: match[2] };
  }
  return { email: from };
};

const sendSendGrid = async ({ from, to, subject, html, text }) => {
  try {
    const sender = parseFrom(from);
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: sender,
        subject,
        content: [
          { type: 'text/plain', value: text || '' },
          { type: 'text/html', value: html || '' },
        ],
      }),
    });
    if (!response.ok) {
      const data = await response.text();
      throw new Error(`SendGrid API error (${response.status}): ${data}`);
    }
    logger.info('Email sent via SendGrid', { to, subject });
    return { status: 'sent' };
  } catch (error) {
    logger.error('Failed to send email via SendGrid', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send via Brevo HTTP API (no domain required — works over HTTPS 443).
 */
const sendBrevo = async ({ from, to, subject, html, text }) => {
  try {
    const sender = parseFrom(from);
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html || '',
        textContent: text || '',
      }),
    });
    if (!response.ok) {
      const data = await response.text();
      throw new Error(`Brevo API error (${response.status}): ${data}`);
    }
    const result = await response.json();
    logger.info('Email sent via Brevo', { to, subject, messageId: result.messageId });
    return { status: 'sent' };
  } catch (error) {
    logger.error('Failed to send email via Brevo', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Internal helper — routes to the configured provider and wraps sending with logging.
 *
 * @param {import('nodemailer').SendMailOptions} options
 */
const send = async (options) => {
  // HTTPS API providers (work from any host, including Render)
  if (process.env.RESEND_API_KEY) {
    return sendResend({ from: FROM_ADDRESS, ...options });
  }
  if (process.env.SENDGRID_API_KEY) {
    return sendSendGrid({ from: FROM_ADDRESS, ...options });
  }
  if (process.env.BREVO_API_KEY) {
    return sendBrevo({ from: FROM_ADDRESS, ...options });
  }

  // Fallback: SMTP via Nodemailer
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn(
      `Email NOT sent to ${options.to}: no email provider configured ` +
        '(set RESEND_API_KEY, SENDGRID_API_KEY, or EMAIL_USER/EMAIL_PASS).'
    );
    return null;
  }
  try {
    const info = await transporter.sendMail({ from: FROM_ADDRESS, ...options });
    logger.info('Email sent', { messageId: info.messageId, to: options.to });
    return info;
  } catch (error) {
    logger.error('Failed to send email', { to: options.to, subject: options.subject, error: error.message });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

/**
 * Send a project invitation email.
 *
 * @param {{ email, inviterName, projectName, inviteToken, role }} params
 */
const sendProjectInvitation = async ({ email, inviterName, projectName, inviteToken, role }) => {
  const acceptUrl = `${FRONTEND_URL}/invitations/accept?token=${inviteToken}`;
  const declineUrl = `${FRONTEND_URL}/invitations/decline?token=${inviteToken}`;

  await send({
    to: email,
    subject: `${inviterName} invited you to join "${projectName}" on Kanban App`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1a1a2e; margin-bottom: 8px;">You're invited! 🎉</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          <strong>${inviterName}</strong> has invited you to collaborate on the project
          <strong>"${projectName}"</strong> as a <strong>${role}</strong>.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${acceptUrl}" style="background:#4f46e5;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:12px;">
            Accept Invitation
          </a>
          <a href="${declineUrl}" style="background:#e5e7eb;color:#374151;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Decline
          </a>
        </div>
        <p style="color:#aaa;font-size:13px;">
          This invitation expires in 72 hours. If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `,
    text: `${inviterName} invited you to join "${projectName}" on Kanban App as ${role}.\n\nAccept: ${acceptUrl}\nDecline: ${declineUrl}`,
  });
};

/**
 * Send a welcome email to a newly registered user.
 *
 * @param {{ email, fullName }} params
 */
const sendWelcomeEmail = async ({ email, fullName }) => {
  await send({
    to: email,
    subject: 'Welcome to Kanban App! 🚀',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1a1a2e;">Welcome, ${fullName || 'there'}! 👋</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          Your account has been created. Start by creating your first project and inviting your team.
        </p>
        <div style="margin: 32px 0;">
          <a href="${FRONTEND_URL}/dashboard" style="background:#4f46e5;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
    `,
    text: `Welcome to Kanban App, ${fullName || 'there'}! Visit ${FRONTEND_URL}/dashboard to get started.`,
  });
};

/**
 * Send a task assignment notification.
 *
 * @param {{ email, assigneeName, taskTitle, boardName, projectName, taskId }} params
 */
const sendTaskAssignmentNotification = async ({ email, assigneeName, taskTitle, boardName, projectName, taskId }) => {
  const taskUrl = `${FRONTEND_URL}/tasks/${taskId}`;

  await send({
    to: email,
    subject: `You've been assigned a task: "${taskTitle}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1a1a2e;">New Task Assigned 📋</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          Hi <strong>${assigneeName}</strong>, you've been assigned a new task in <strong>${projectName}</strong>.
        </p>
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;color:#374151;"><strong>Task:</strong> ${taskTitle}</p>
          <p style="margin:8px 0 0;color:#374151;"><strong>Board:</strong> ${boardName}</p>
        </div>
        <a href="${taskUrl}" style="background:#4f46e5;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
          View Task
        </a>
      </div>
    `,
    text: `Hi ${assigneeName},\n\nYou've been assigned the task "${taskTitle}" on board "${boardName}" in project "${projectName}".\n\nView it here: ${taskUrl}`,
  });
};

/**
 * Send a password reset email (fallback — Supabase usually handles this natively).
 *
 * @param {{ email, resetUrl }} params
 */
const sendPasswordResetEmail = async ({ email, resetUrl }) => {
  await send({
    to: email,
    subject: 'Reset your Kanban App password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1a1a2e;">Password Reset Request 🔑</h1>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          We received a request to reset the password for your account. Click below to choose a new password.
        </p>
        <div style="margin: 32px 0;">
          <a href="${resetUrl}" style="background:#4f46e5;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Reset Password
          </a>
        </div>
        <p style="color:#aaa;font-size:13px;">
          This link expires in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    `,
    text: `Click here to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
};

module.exports = {
  sendProjectInvitation,
  sendWelcomeEmail,
  sendTaskAssignmentNotification,
  sendPasswordResetEmail,
};
