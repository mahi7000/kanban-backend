/**
 * Nodemailer Transporter Configuration
 *
 * Creates and verifies a reusable SMTP transporter used by email.service.js.
 * Uses Gmail SMTP by default; swap EMAIL_HOST/PORT/USER/PASS for other providers.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_PORT === '465', // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Graceful degradation: if email creds are missing, log a warning instead of crashing
  ...((!process.env.EMAIL_USER || !process.env.EMAIL_PASS) && {
    jsonTransport: true, // Logs email to stdout (useful in dev without real SMTP)
  }),
});

/**
 * Verify SMTP connection on startup.
 * Logs a warning on failure instead of crashing the process,
 * so the API remains usable even without email configured.
 */
const verifyEmailConnection = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('EMAIL_USER or EMAIL_PASS not set. Email will be logged to console (dev mode).');
    return;
  }
  try {
    await transporter.verify();
    logger.info('SMTP connection verified successfully');
  } catch (error) {
    logger.warn(`SMTP connection failed: ${error.message}. Check EMAIL_* env vars.`);
  }
};

module.exports = { transporter, verifyEmailConnection };
