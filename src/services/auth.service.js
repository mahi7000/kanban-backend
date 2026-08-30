/**
 * Authentication Service
 *
 * Wraps Supabase Auth methods so controllers stay thin.
 * All Supabase errors are re-thrown with a normalised message.
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Register a new user with email and password.
 * Optionally stores a full_name in user_metadata.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} [full_name]
 */
const register = async (email, password, full_name) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Confirm the email immediately so no verification email is required
    user_metadata: { full_name: full_name || '' },
  });

  if (error) {
    logger.warn('Registration failed', { email, error: error.message });
    throw new Error(error.message);
  }

  return data.user;
};

/**
 * Sign in with email and password.
 * Returns { user, session } on success.
 *
 * @param {string} email
 * @param {string} password
 */
const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logger.warn('Login failed', { email, error: error.message });
    throw new Error(error.message);
  }

  return data; // { user, session }
};

/**
 * Retrieve the authenticated user from a JWT access token.
 *
 * @param {string} accessToken
 */
const getUserFromToken = async (accessToken) => {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return user;
};

/**
 * Sign out a user by invalidating their session.
 * Supabase manages session state server-side; this is a no-op for stateless JWTs
 * but can be wired up to a token blocklist if needed.
 *
 * @param {string} accessToken
 */
const logout = async (accessToken) => {
  // For Supabase JWTs the server cannot truly invalidate them before expiry.
  // We signal the client to discard the token. For added security, consider
  // maintaining a server-side blocklist (Redis, etc.).
  const { error } = await supabase.auth.admin?.signOut?.(accessToken) || {};
  // Silently ignore — client-side token removal is the primary logout mechanism
};

/**
 * Trigger a Supabase password-reset email.
 *
 * @param {string} email
 * @param {string} redirectTo - URL the user is redirected to after clicking the link
 */
const sendPasswordReset = async (email, redirectTo) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    logger.warn('Password reset request failed', { email, error: error.message });
    throw new Error(error.message);
  }
};

/**
 * Update the user's password using a valid recovery access token.
 *
 * @param {string} accessToken - The token from the reset email link
 * @param {string} newPassword
 */
const resetPassword = async (accessToken, newPassword) => {
  // Create a client scoped to this token
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user) throw new Error('Invalid or expired reset token');

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (error) {
    logger.warn('Password reset update failed', { userId: user.id, error: error.message });
    throw new Error(error.message);
  }

  return user;
};

/**
 * Look up a user by email using the admin client.
 * Returns null if the user does not exist.
 *
 * @param {string} email
 */
const getUserByEmail = async (email) => {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email === email) || null;
};

module.exports = {
  register,
  login,
  logout,
  getUserFromToken,
  sendPasswordReset,
  resetPassword,
  getUserByEmail,
};
