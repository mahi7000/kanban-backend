/**
 * Utility Helpers
 *
 * Shared functions used across the application.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Build a standardised API response object.
 *
 * @param {boolean} success
 * @param {*}       data
 * @param {string}  message
 * @param {*}       [errors]
 * @returns {{ success, data, message, errors }}
 */
const apiResponse = (success, data = null, message = '', errors = null) => ({
  success,
  data,
  message,
  errors,
});

/**
 * Build a standardised paginated response.
 *
 * @param {Array}  items      - Array of result items for the current page
 * @param {number} total      - Total record count across all pages
 * @param {number} page       - Current page (1-based)
 * @param {number} limit      - Records per page
 */
const paginatedResponse = (items, total, page, limit) => ({
  items,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

/**
 * Extract pagination parameters from a query object.
 * Clamps page to ≥ 1 and limit between 1 and 100.
 *
 * @param {{ page?, limit? }} query
 * @returns {{ page, limit, offset }}
 */
const getPaginationParams = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Generate a cryptographically sufficient invitation token.
 * Uses two UUIDs concatenated, then strips hyphens for a compact string.
 *
 * @returns {string} 64-character hex token
 */
const generateInviteToken = () =>
  `${uuidv4()}${uuidv4()}`.replace(/-/g, '');

/**
 * Return a Date object `hours` hours from now.
 *
 * @param {number} hours
 * @returns {Date}
 */
const hoursFromNow = (hours) => {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
};

/**
 * Safely parse a JSON string, returning a fallback on failure.
 *
 * @param {string} str
 * @param {*}      [fallback=null]
 */
const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Strip undefined / null fields from an object.
 * Useful for building partial UPDATE payloads.
 *
 * @param {Object} obj
 * @returns {Object}
 */
const cleanObject = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  );

/**
 * Map CSV column headers to the database task schema.
 * Headers are case-insensitive and whitespace-trimmed.
 */
const CSV_HEADER_MAP = {
  week: 'week',
  day: 'day',
  date: 'date',
  assignee: 'assignee_name',
  email: 'assignee_email',
  side: 'side',
  status: 'status',
  title: 'title',
  epic: 'epic',
  priority: 'priority',
  estimatehours: 'estimate_hours',
  repo: 'repository',
  branch: 'branch',
  dependencies: 'dependencies',
  goal: 'goal',
  fullprompt: 'full_prompt',
};

/**
 * Normalise a raw CSV row object (with arbitrary header casing) to the
 * canonical field names expected by the task schema.
 *
 * @param {Object} row - Raw CSV row
 * @returns {Object}   - Normalised row
 */
const normaliseCsvRow = (row) => {
  const normalised = {};
  for (const [key, value] of Object.entries(row)) {
    const normKey = key.trim().toLowerCase().replace(/\s+/g, '');
    const mapped = CSV_HEADER_MAP[normKey];
    if (mapped) {
      normalised[mapped] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return normalised;
};

/**
 * Map a CSV status value to the internal task status column value.
 *
 * @param {string} csvStatus
 * @returns {string}
 */
const mapCsvStatus = (csvStatus) => {
  if (!csvStatus) return 'todo';
  const s = csvStatus.toLowerCase().trim();
  const map = {
    'to do': 'todo',
    todo: 'todo',
    'in progress': 'in_progress',
    inprogress: 'in_progress',
    review: 'review',
    done: 'done',
    completed: 'done',
  };
  return map[s] || 'todo';
};

module.exports = {
  apiResponse,
  paginatedResponse,
  getPaginationParams,
  generateInviteToken,
  hoursFromNow,
  safeJsonParse,
  cleanObject,
  normaliseCsvRow,
  mapCsvStatus,
  CSV_HEADER_MAP,
};
