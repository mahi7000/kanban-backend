/**
 * Auth Middleware
 *
 * Verifies the Supabase JWT included in the Authorization header.
 * On success, attaches `req.user` with the decoded user payload.
 *
 * Usage:
 *   router.get('/protected', authenticate, handler);
 *
 * Optional (role-based):
 *   router.delete('/admin', authenticate, requireRole('admin'), handler);
 */

const { supabaseAdmin } = require('../config/supabase');
const { apiResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * authenticate — verifies the Bearer JWT and sets req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json(apiResponse(false, null, 'No token provided. Please log in.'));
    }

    const token = authHeader.split(' ')[1];

    // Use Supabase admin client to validate the JWT and retrieve user data
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid or expired token attempted', { error: error?.message });
      return res
        .status(401)
        .json(apiResponse(false, null, 'Invalid or expired token. Please log in again.'));
    }

    // Attach user object to request for downstream handlers
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    logger.error('Authentication middleware error', { error: err.message });
    return res
      .status(500)
      .json(apiResponse(false, null, 'Authentication error'));
  }
};

/**
 * requireRole — factory that returns a middleware checking req.user's role
 * against the provided list.
 *
 * Intended to be used AFTER `authenticate`.
 *
 * @param  {...string} roles - Allowed roles, e.g. 'owner', 'admin'
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json(apiResponse(false, null, 'Authentication required'));
  }

  // Role is stored as user_metadata.role by convention
  const userRole = req.user.user_metadata?.role;
  if (!roles.includes(userRole)) {
    return res
      .status(403)
      .json(apiResponse(false, null, 'Insufficient permissions'));
  }

  next();
};

/**
 * optionalAuthenticate — like authenticate but does NOT reject unauthenticated
 * requests. Useful for routes that have both public and authenticated behaviour.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // proceed without user
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (user) {
      req.user = user;
      req.token = token;
    }
  } catch {
    // Silently ignore errors in optional auth
  }
  next();
};

module.exports = { authenticate, requireRole, optionalAuthenticate };
