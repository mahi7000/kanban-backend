/**
 * Project Validators
 *
 * express-validator chains for project and member routes.
 */

const { body, param } = require('express-validator');

/** POST /api/projects */
const createProjectValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Project name is required')
    .isLength({ max: 255 }).withMessage('Project name must be at most 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'completed']).withMessage('Status must be active, archived, or completed'),
  body('settings')
    .optional()
    .isObject().withMessage('Settings must be a JSON object'),
];

/** PUT /api/projects/:id */
const updateProjectValidator = [
  param('id').isUUID().withMessage('Invalid project ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Project name cannot be empty')
    .isLength({ max: 255 }).withMessage('Project name must be at most 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'completed']).withMessage('Invalid status value'),
  body('settings')
    .optional()
    .isObject().withMessage('Settings must be a JSON object'),
];

/** POST /api/projects/:id/invite */
const inviteMemberValidator = [
  param('id').isUUID().withMessage('Invalid project ID'),
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['member', 'admin']).withMessage('Role must be member or admin'),
];

/** PUT /api/projects/:id/members/:userId */
const updateMemberRoleValidator = [
  param('id').isUUID().withMessage('Invalid project ID'),
  param('userId').isUUID().withMessage('Invalid user ID'),
  body('role')
    .isIn(['member', 'admin', 'owner']).withMessage('Role must be member, admin, or owner'),
];

module.exports = {
  createProjectValidator,
  updateProjectValidator,
  inviteMemberValidator,
  updateMemberRoleValidator,
};
