const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const { createSupabaseAdminClient } = require("../lib/supabaseAdmin");

function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function createAuthClient(extraHeaders = {}) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: extraHeaders,
    },
  });
}


function sendSuccess(res, message, payload = {}) {
  return res.status(200).json({
    status: "ok",
    message,
    ...payload,
  });
}

async function login(req, res) {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase configuration is missing.",
      });
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: req.body.email,
      password: req.body.password,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "Failed to sign in.",
      });
    }

    return sendSuccess(res, "Signed in successfully.", {
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Unable to sign in.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function sendOtp(req, res) {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase configuration is missing.",
      });
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.signInWithOtp({
      email: req.body.email,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "Failed to send OTP.",
      });
    }

    return sendSuccess(res, "OTP sent successfully.", {
      user: data.user ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Unable to send OTP.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function verifyOtp(req, res) {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase configuration is missing.",
      });
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.verifyOtp({
      email: req.body.email,
      token: req.body.token,
      type: req.body.type,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "OTP verification failed.",
      });
    }

    return sendSuccess(res, "OTP verified successfully.", {
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Unable to verify OTP.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function resetPassword(req, res) {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase configuration is missing.",
      });
    }

    const client = createAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(req.body.email);

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "Failed to send reset OTP.",
      });
    }

    return sendSuccess(res, "Reset OTP sent successfully.", {
      email: req.body.email,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Unable to send reset OTP.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function register(req, res) {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase configuration is missing.",
      });
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.signUp({
      email: req.body.email,
      password: req.body.password,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "Registration failed.",
      });
    }

    if (data.user?.id) {
      const adminClient = createSupabaseAdminClient();
      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: data.user.id,
        full_name: req.body.name,
        email: req.body.email,
        role: "student",
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        return res.status(500).json({
          status: "error",
          message: profileError.message || "Registration profile could not be created.",
        });
      }
    }

    return sendSuccess(res, "Registration created successfully.", {
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Unable to register user.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function updatePassword(req, res) {
  try {
    if (!hasSupabaseConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase configuration is missing.",
      });
    }

    const client = createAuthClient({
      Authorization: `Bearer ${req.accessToken}`,
    });

    const { data, error } = await client.auth.updateUser({
      password: req.body.password,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "Failed to update password.",
      });
    }

    return sendSuccess(res, "Password updated successfully.", {
      user: data.user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Unable to update password.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

module.exports = {
  login,
  sendOtp,
  verifyOtp,
  resetPassword,
  register,
  updatePassword,
};
