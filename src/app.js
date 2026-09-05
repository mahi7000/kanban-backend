/**
 * Kanban Backend — Express Application
 *
 * Configures middleware, mounts all route groups, and starts the HTTP server.
 *
 * Startup order:
 *  1. Load environment variables
 *  2. Initialise logger
 *  3. Verify Supabase connectivity (optional — non-blocking)
 *  4. Configure Express with security & utility middleware
 *  5. Mount API routes
 *  6. Register error handlers
 *  7. Start listening
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { apiResponse } = require('./utils/helpers');
const { verifyEmailConnection, transporter } = require('./config/email');

// Route modules
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const { projectMemberRouter, invitationRouter } = require('./routes/member.routes');
const { projectBoardRouter, boardRouter } = require('./routes/board.routes');
const { boardTaskRouter, taskRouter } = require('./routes/task.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────────────────────────────────────

// Helmet sets various HTTP security headers
app.use(helmet());

// CORS — allow the configured frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, curl, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Global rate limiter (looser than auth-specific limiter)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api', globalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Request Parsing & Logging
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger — "dev" in development, "combined" in production
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.http(message.trim()) },
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Kanban API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// GET /api/health/email — live SMTP diagnostics (no secrets exposed)
app.get('/api/health/email', async (req, res) => {
  const credsConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const sendgridConfigured = !!process.env.SENDGRID_API_KEY;
  const brevoConfigured = !!process.env.BREVO_API_KEY;
  const provider = resendConfigured
    ? 'resend'
    : sendgridConfigured
      ? 'sendgrid'
      : brevoConfigured
        ? 'brevo'
        : credsConfigured
          ? 'smtp'
          : 'none';
  const details = {
    provider,
    credsConfigured,
    resendConfigured,
    sendgridConfigured,
    brevoConfigured,
    transportMode:
      provider === 'resend' || provider === 'sendgrid' || provider === 'brevo'
        ? `${provider} (HTTPS API)`
        : credsConfigured
          ? 'smtp'
          : 'jsonTransport (dev — emails NOT actually sent)',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || '587',
    secure: process.env.EMAIL_PORT === '465',
    from: process.env.EMAIL_FROM || `"Kanban App" <${process.env.EMAIL_USER}>`,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  };
  if (credsConfigured && !resendConfigured && !sendgridConfigured && !brevoConfigured) {
    const started = Date.now();
    try {
      await transporter.verify();
      details.verify = { status: 'ok', tookMs: Date.now() - started };
    } catch (error) {
      details.verify = { status: 'error', message: error.message, tookMs: Date.now() - started };
    }
  }
  res.status(200).json(apiResponse(true, details, 'Email configuration diagnostics'));
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/auth',         authRoutes);
app.use('/api/projects',     projectRoutes);
app.use('/api/invitations',  invitationRouter);

// Project-nested sub-resources
app.use('/api/projects/:id/members', projectMemberRouter);
app.use('/api/projects/:projectId/boards', projectBoardRouter);

// Standalone resource routes
app.use('/api/boards',  boardRouter);
app.use('/api/boards/:boardId/tasks', boardTaskRouter);
app.use('/api/tasks',   taskRouter);

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json(
    apiResponse(false, null, `Route ${req.method} ${req.originalUrl} not found`)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // CORS errors
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json(apiResponse(false, null, err.message));
  }

  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json(apiResponse(false, null, 'Invalid JSON in request body'));
  }

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected error occurred'
      : err.message;

  return res.status(statusCode).json(apiResponse(false, null, message));
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────

const startServer = async () => {
  // Verify email connectivity (non-blocking — server starts regardless)
  verifyEmailConnection().catch(() => {});

  app.listen(PORT, () => {
    logger.info(`🚀 Kanban API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    logger.info(`📚 Health check: http://localhost:${PORT}/health`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });
}

module.exports = app; // exported for testing
