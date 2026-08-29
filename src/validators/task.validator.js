/**
 * Task Validators
 *
 * express-validator chains for board and task routes.
 */

const { body, param, query } = require('express-validator');

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];

/** POST /api/boards/:boardId/tasks */
const createTaskValidator = [
  param('boardId').isUUID().withMessage('Invalid board ID'),
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required')
    .isLength({ max: 500 }).withMessage('Title must be at most 500 characters'),
  body('status')
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Description must be at most 5000 characters'),
  body('priority')
    .optional()
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`),
  body('assignee_id')
    .optional()
    .isUUID().withMessage('assignee_id must be a valid UUID'),
  body('estimate_hours')
    .optional()
    .isFloat({ min: 0, max: 9999 }).withMessage('estimate_hours must be a positive number'),
  body('week')
    .optional()
    .isInt({ min: 1 }).withMessage('week must be a positive integer'),
  body('position')
    .optional()
    .isInt({ min: 0 }).withMessage('position must be a non-negative integer'),
];

/** PUT /api/tasks/:id */
const updateTaskValidator = [
  param('id').isUUID().withMessage('Invalid task ID'),
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Task title cannot be empty')
    .isLength({ max: 500 }).withMessage('Title must be at most 500 characters'),
  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  body('priority')
    .optional()
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`),
  body('assignee_id')
    .optional({ nullable: true })
    .isUUID().withMessage('assignee_id must be a valid UUID'),
  body('estimate_hours')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 9999 }).withMessage('estimate_hours must be a positive number'),
];

/** PATCH /api/tasks/:id/status */
const updateTaskStatusValidator = [
  param('id').isUUID().withMessage('Invalid task ID'),
  body('status')
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
];

/** PATCH /api/tasks/:id/position */
const updateTaskPositionValidator = [
  param('id').isUUID().withMessage('Invalid task ID'),
  body('position')
    .isInt({ min: 0 }).withMessage('position must be a non-negative integer'),
  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
];

/** Board validators */
const createBoardValidator = [
  param('projectId').isUUID().withMessage('Invalid project ID'),
  body('name')
    .trim()
    .notEmpty().withMessage('Board name is required')
    .isLength({ max: 255 }).withMessage('Board name must be at most 255 characters'),
  body('column_order')
    .optional()
    .isArray().withMessage('column_order must be an array'),
  body('settings')
    .optional()
    .isObject().withMessage('Settings must be a JSON object'),
];

const updateBoardValidator = [
  param('id').isUUID().withMessage('Invalid board ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Board name cannot be empty')
    .isLength({ max: 255 }).withMessage('Board name must be at most 255 characters'),
  body('column_order')
    .optional()
    .isArray().withMessage('column_order must be an array'),
  body('settings')
    .optional()
    .isObject().withMessage('Settings must be a JSON object'),
];

module.exports = {
  createTaskValidator,
  updateTaskValidator,
  updateTaskStatusValidator,
  updateTaskPositionValidator,
  createBoardValidator,
  updateBoardValidator,
  VALID_STATUSES,
  VALID_PRIORITIES,
};
