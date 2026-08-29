/**
 * Request Validation Middleware
 *
 * Uses express-validator's `validationResult` to check for validation
 * errors produced by validators and respond with a structured error body.
 *
 * Usage:
 *   router.post('/register', [...validators], validate, controller.register);
 */

const { validationResult } = require('express-validator');
const { apiResponse } = require('../utils/helpers');

/**
 * validate — reads accumulated express-validator errors and short-circuits
 * the request with a 422 response if any exist.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return res
      .status(422)
      .json(
        apiResponse(false, null, 'Validation failed', formattedErrors)
      );
  }
  next();
};

module.exports = { validate };
