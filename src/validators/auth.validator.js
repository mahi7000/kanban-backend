/**
 * Auth Validators
 *
 * express-validator chains for authentication routes.
 */

const { body } = require('express-validator');

/** POST /api/auth/register */
const registerValidator = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('full_name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Full name must be at most 100 characters'),
];

/** POST /api/auth/login */
const loginValidator = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
];

/** POST /api/auth/forgot-password */
const forgotPasswordValidator = [
  body('email')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

/** POST /api/auth/reset-password */
const resetPasswordValidator = [
  body('access_token')
    .notEmpty().withMessage('Access token is required'),
  body('new_password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
