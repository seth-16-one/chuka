const path = require("path");

try {
  // Load backend-local env vars when dotenv is installed.
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch (_error) {
  // Allow the module graph to load even before backend dependencies are installed.
}

const env = {
  port: process.env.PORT || 5000,
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
  apiUrl: process.env.API_URL || "http://localhost:5000",
};

module.exports = env;
