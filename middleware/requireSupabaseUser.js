const { createSupabaseAuthClient } = require("../lib/supabaseAdmin");

async function requireSupabaseUser(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Authorization bearer token is required.",
    });
  }

  try {
    const client = createSupabaseAuthClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired session.",
      });
    }

    req.accessToken = token;
    req.supabaseUser = data.user;
    return next();
  } catch (authError) {
    return res.status(401).json({
      status: "error",
      message: authError instanceof Error ? authError.message : "Invalid session.",
    });
  }
}

module.exports = { requireSupabaseUser };
