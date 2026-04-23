const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const { createSupabaseAdminClient } = require("../lib/supabaseAdmin");
const {
  clearOtpChallenge,
  createOtpChallenge,
  consumeRecoveryChallenge,
  normalizePurpose,
  verifyOtpChallenge,
} = require("../lib/otp");
const { sendOtpEmail } = require("../lib/mailer");

function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function hasSupabaseAdminConfig() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
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
    if (!env.otpHashSecret) {
      return res.status(500).json({
        status: "error",
        message: "OTP configuration is missing.",
      });
    }

    const purpose = normalizePurpose(req.body.purpose);
    const { code, resendAvailableAt } = createOtpChallenge({
      email: req.body.email,
      purpose,
    });

    await sendOtpEmail({
      email: req.body.email,
      code,
      expiresInMinutes: env.otpExpiryMinutes,
      purpose,
    });

    return sendSuccess(res, "OTP sent successfully.", {
      email: req.body.email,
      data: {
        resendAvailableAt,
      },
    });
  } catch (error) {
    if (error?.code === "OTP_COOLDOWN") {
      return res.status(429).json({
        status: "error",
        message: error.message || "Please wait before requesting another OTP.",
        data: {
          resendAvailableAt: error.resendAvailableAt,
        },
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Unable to send OTP.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function verifyOtp(req, res) {
  try {
    if (!env.otpHashSecret) {
      return res.status(500).json({
        status: "error",
        message: "OTP configuration is missing.",
      });
    }

    const result = verifyOtpChallenge({
      email: req.body.email,
      token: req.body.token,
      purpose: req.body.purpose,
    });

    if (!result.ok) {
      return res.status(400).json({
        status: "error",
        message: result.message || "OTP verification failed.",
      });
    }

    return sendSuccess(res, "OTP verified successfully.", {
      email: req.body.email,
      purpose: req.body.purpose,
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
    if (!env.otpHashSecret) {
      return res.status(500).json({
        status: "error",
        message: "OTP configuration is missing.",
      });
    }

    const { code, resendAvailableAt } = createOtpChallenge({
      email: req.body.email,
      purpose: "recovery",
    });

    await sendOtpEmail({
      email: req.body.email,
      code,
      expiresInMinutes: env.otpExpiryMinutes,
      purpose: "recovery",
    });

    return sendSuccess(res, "Reset OTP sent successfully.", {
      email: req.body.email,
      data: {
        resendAvailableAt,
      },
    });
  } catch (error) {
    if (error?.code === "OTP_COOLDOWN") {
      return res.status(429).json({
        status: "error",
        message: error.message || "Please wait before requesting another OTP.",
        data: {
          resendAvailableAt: error.resendAvailableAt,
        },
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Unable to send reset OTP.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function register(req, res) {
  try {
    if (!hasSupabaseAdminConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase service role configuration is missing.",
      });
    }

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.auth.admin.createUser({
      email: req.body.email,
      password: req.body.password,
      email_confirm: true,
      user_metadata: {
        full_name: req.body.name,
        role: "student",
      },
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.message || "Registration failed.",
      });
    }

    if (data.user?.id) {
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

    const client = createAuthClient();
    const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
      email: req.body.email,
      password: req.body.password,
    });

    if (signInError) {
      return res.status(400).json({
        status: "error",
        message: signInError.message || "Unable to create session.",
      });
    }

    return sendSuccess(res, "Registration created successfully.", {
      session: sessionData.session,
      user: sessionData.user,
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
    if (!env.otpHashSecret) {
      return res.status(500).json({
        status: "error",
        message: "OTP configuration is missing.",
      });
    }

    if (!hasSupabaseAdminConfig()) {
      return res.status(500).json({
        status: "error",
        message: "Supabase service role configuration is missing.",
      });
    }

    const result = consumeRecoveryChallenge(req.body.email, req.body.token);

    if (!result.ok) {
      return res.status(400).json({
        status: "error",
        message: result.message || "OTP verification failed.",
      });
    }

    clearOtpChallenge(req.body.email, "recovery");

    const adminClient = createSupabaseAdminClient();
    const { data: usersResponse, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return res.status(400).json({
        status: "error",
        message: listError.message || "Failed to locate user.",
      });
    }

    const matchedUser = usersResponse?.users?.find(
      (user) => String(user.email || "").trim().toLowerCase() === req.body.email,
    );

    if (!matchedUser?.id) {
      return res.status(404).json({
        status: "error",
        message: "No account was found for this email address.",
      });
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(matchedUser.id, {
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
