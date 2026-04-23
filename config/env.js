const path = require("path");

try {
  // Load backend-local env vars when dotenv is installed.
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch (_error) {
  // Allow the module graph to load even before backend dependencies are installed.
}

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  apiUrl: process.env.API_URL || "http://localhost:5000",
  otpHashSecret: process.env.OTP_HASH_SECRET || "",
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  otpCooldownSeconds: Number(process.env.OTP_COOLDOWN_SECONDS || 60),
  supabaseUrl:
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    "",
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    "",
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    "",
  emailProvider: (process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase(),
  emailFromName: process.env.EMAIL_FROM_NAME || "Chuka University App",
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
};

module.exports = env;
