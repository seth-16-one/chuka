const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");

function createSupabaseAdminClient() {
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;

  if (!env.supabaseUrl || !key) {
    throw new Error("Supabase configuration is missing.");
  }

  return createClient(env.supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createSupabaseAuthClient() {
  const key = env.supabaseAnonKey || env.supabaseServiceRoleKey;

  if (!env.supabaseUrl || !key) {
    throw new Error("Supabase configuration is missing.");
  }

  return createClient(env.supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

module.exports = {
  createSupabaseAdminClient,
  createSupabaseAuthClient,
};
