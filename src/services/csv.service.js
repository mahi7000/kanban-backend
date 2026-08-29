/**
 * CSV Service
 *
 * Parses a CSV buffer (from multer's MemoryStorage) into an array of
 * normalised task objects ready to be inserted into the database.
 *
 * Expected CSV format:
 *   Week, Day, Date, Assignee, Email, Side, Status, Title, Epic, Priority,
 *   EstimateHours, Repo, Branch, Dependencies, Goal, FullPrompt
 */

const { parse } = require('csv-parse');
const { normaliseCsvRow, mapCsvStatus } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Parse a CSV buffer and return structured result.
 *
 * @param {Buffer} buffer   - File buffer from multer
 * @param {string} boardId  - Target board ID
 * @param {string} createdBy - ID of the user performing the import
 *
 * @returns {Promise<{
 *   valid: Array,
 *   invalid: Array<{ row: number, data: Object, errors: string[] }>,
 *   total: number
 * }>}
 */
const parseCsvBuffer = async (buffer, boardId, createdBy) => {
  return new Promise((resolve, reject) => {
    const records = [];

    parse(buffer, {
      columns: true,           // Use first row as column names
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
      .on('data', (row) => records.push(row))
      .on('error', (err) => reject(err))
      .on('end', () => {
        const valid = [];
        const invalid = [];

        records.forEach((rawRow, index) => {
          const rowNumber = index + 2; // +2 because row 1 is the header
          const row = normaliseCsvRow(rawRow);
          const errors = validateCsvRow(row, rowNumber);

          if (errors.length > 0) {
            invalid.push({ row: rowNumber, data: row, errors });
            return;
          }

          valid.push(buildTaskFromCsvRow(row, boardId, createdBy));
        });

        logger.info('CSV parsed', { total: records.length, valid: valid.length, invalid: invalid.length });

        resolve({ valid, invalid, total: records.length });
      });
  });
};

/**
 * Validate a normalised CSV row. Returns an array of error messages.
 *
 * @param {Object} row
 * @param {number} rowNumber
 * @returns {string[]}
 */
const validateCsvRow = (row, rowNumber) => {
  const errors = [];

  if (!row.title || row.title.trim() === '') {
    errors.push('Title is required');
  } else if (row.title.length > 500) {
    errors.push('Title must be at most 500 characters');
  }

  if (row.estimate_hours !== undefined && row.estimate_hours !== '') {
    const hours = parseFloat(row.estimate_hours);
    if (isNaN(hours) || hours < 0) {
      errors.push('EstimateHours must be a non-negative number');
    }
  }

  if (row.week !== undefined && row.week !== '') {
    const week = parseInt(row.week, 10);
    if (isNaN(week) || week < 1) {
      errors.push('Week must be a positive integer');
    }
  }

  return errors;
};

/**
 * Convert a normalised CSV row into a task insert object.
 *
 * @param {Object} row      - Normalised row
 * @param {string} boardId
 * @param {string} createdBy
 * @returns {Object}        - Task insert payload
 */
const buildTaskFromCsvRow = (row, boardId, createdBy) => ({
  board_id: boardId,
  title: row.title,
  description: row.goal || null,
  status: mapCsvStatus(row.status),
  priority: normalisePriority(row.priority),
  epic: row.epic || null,
  estimate_hours: row.estimate_hours ? parseFloat(row.estimate_hours) : null,
  repository: row.repository || null,
  branch: row.branch || null,
  dependencies: row.dependencies || null,
  goal: row.goal || null,
  full_prompt: row.full_prompt || null,
  week: row.week ? parseInt(row.week, 10) : null,
  day: row.day || null,
  date: parseDate(row.date),
  side: row.side || null,
  metadata: {
    assignee_name: row.assignee_name || null,
    assignee_email: row.assignee_email || null,
  },
  created_by: createdBy,
  position: 0,
});

/**
 * Normalise priority strings to lowercase internal values.
 */
const normalisePriority = (priority) => {
  if (!priority) return 'medium';
  const p = priority.toLowerCase().trim();
  const map = { high: 'high', medium: 'medium', low: 'low', critical: 'critical' };
  return map[p] || 'medium';
};

/**
 * Attempt to parse a date string to ISO format. Returns null on failure.
 *
 * @param {string} dateStr - e.g. "Jul 22", "2024-07-22"
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    // Try adding current year for partial dates like "Jul 22"
    const withYear = new Date(`${dateStr} ${new Date().getFullYear()}`);
    if (!isNaN(withYear.getTime())) return withYear.toISOString().split('T')[0];
  } catch {
    // ignore
  }
  return null;
};

module.exports = { parseCsvBuffer };
