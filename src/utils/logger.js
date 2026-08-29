/**
 * Winston Logger Configuration
 *
 * Provides a structured logger with:
 *  - Console transport (colourised in development)
 *  - File transport: combined.log  (all levels)
 *  - File transport: error.log     (errors only)
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started');
 *   logger.error('Something went wrong', { error });
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors, json } = format;

// Human-readable format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // print stack traces for Error objects
    json()
  ),
  transports: [
    // Write error-level logs to error.log
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
    }),
    // Write all logs to combined.log
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
    }),
  ],
  // Prevent unhandled exceptions from crashing silently
  exceptionHandlers: [
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    }),
  ],
});

// In non-production environments, also print pretty logs to stdout
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat
      ),
    })
  );
}

// Ensure log directory exists (Winston won't create it automatically)
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
