/**
 * Auth Controller
 *
 * Handles HTTP for:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 *   POST /api/auth/logout
 */

const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const { apiResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    const user = await authService.register(email, password, full_name);

    // Fire-and-forget welcome email — don't block the response on it
    emailService
      .sendWelcomeEmail({ email, fullName: full_name })
      .catch((err) => logger.warn('Welcome email failed', { error: err.message }));

    return res.status(201).json(
      apiResponse(true, { user: { id: user.id, email: user.email } }, 'Registration successful.')
    );
  } catch (error) {
    logger.error('Register error', { error: error.message });

    // Surface common Supabase auth errors as 409
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      return res.status(409).json(apiResponse(false, null, 'An account with this email already exists.'));
    }
    return res.status(400).json(apiResponse(false, null, error.message));
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, session } = await authService.login(email, password);

    return res.status(200).json(
      apiResponse(
        true,
        {
          user: {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name,
          },
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
        'Login successful'
      )
    );
  } catch (error) {
    logger.warn('Login error', { error: error.message });
    // Return 401 for bad credentials regardless of the exact Supabase error
    return res.status(401).json(apiResponse(false, null, 'Invalid email or password'));
  }
};

/**
 * GET /api/auth/me
 * Requires: authenticate middleware (sets req.user)
 */
const getMe = async (req, res) => {
  try {
    const { id, email, user_metadata, created_at } = req.user;

    return res.status(200).json(
      apiResponse(
        true,
        {
          id,
          email,
          full_name: user_metadata?.full_name || '',
          created_at,
        },
        'User profile retrieved'
      )
    );
  } catch (error) {
    logger.error('GetMe error', { error: error.message });
    return res.status(500).json(apiResponse(false, null, 'Failed to retrieve user profile'));
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const redirectTo = `${process.env.FRONTEND_URL}/reset-password`;

    await authService.sendPasswordReset(email, redirectTo);

    // Always return success to prevent email enumeration
    return res.status(200).json(
      apiResponse(true, null, 'If an account with that email exists, a password reset link has been sent.')
    );
  } catch (error) {
    logger.warn('Forgot-password error', { error: error.message });
    // Still return 200 to prevent email enumeration
    return res.status(200).json(
      apiResponse(true, null, 'If an account with that email exists, a password reset link has been sent.')
    );
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { access_token, new_password }
 */
const resetPassword = async (req, res) => {
  try {
    const { access_token, new_password } = req.body;
    await authService.resetPassword(access_token, new_password);

    return res.status(200).json(apiResponse(true, null, 'Password reset successful. You can now log in.'));
  } catch (error) {
    logger.warn('Reset-password error', { error: error.message });
    return res.status(400).json(apiResponse(false, null, error.message));
  }
};

/**
 * POST /api/auth/logout
 * Requires: authenticate middleware
 */
const logout = async (req, res) => {
  try {
    await authService.logout(req.token);
    return res.status(200).json(apiResponse(true, null, 'Logged out successfully'));
  } catch (error) {
    logger.warn('Logout error', { error: error.message });
    // Still return success — client-side token disposal is the key step
    return res.status(200).json(apiResponse(true, null, 'Logged out successfully'));
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword, logout };
