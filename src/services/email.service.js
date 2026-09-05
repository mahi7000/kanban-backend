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
 * Internal helper — wraps transporter.sendMail with logging.
 *
 * @param {import('nodemailer').SendMailOptions} options
 */
const send = async (options) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn(
      `Email NOT sent to ${options.to}: EMAIL_USER/EMAIL_PASS not set. ` +
        'Nodemailer is in dev (jsonTransport) mode; set SMTP env vars in production.'
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
