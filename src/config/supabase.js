/**
 * Supabase Client Configuration
 *
 * Exports two Supabase clients:
 *  - `supabase`      → uses the ANON key (respects Row Level Security)
 *  - `supabaseAdmin` → uses the SERVICE ROLE key (bypasses RLS, server-side only)
 *
 * Never expose the service role key to the client.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set in .env'
  );
}

/**
 * Public client — respects Row Level Security policies.
 * Use for operations that should be scoped to the authenticated user.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false, // server-side: no browser session persistence
  },
});

/**
 * Admin client — bypasses RLS.
 * Use for privileged server-side operations only (e.g. sending invitations,
 * looking up users by email). NEVER expose this client to untrusted code paths.
 */
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase, supabaseAdmin };
