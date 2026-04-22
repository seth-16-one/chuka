import { createClient, type Session, type User } from "npm:@supabase/supabase-js@2";

type SuccessPayload = {
  status: "ok";
  message: string;
  session?: Session | null;
  user?: User | null;
  email?: string;
  data?: unknown;
};

type ErrorPayload = {
  status: "error";
  message: string;
  field?: string;
  error?: string;
};

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const OTP_PATTERN = /^\d{6}$/;
const MIN_PASSWORD_LENGTH = 6;
type OtpPurpose = "login" | "signup" | "recovery";
const ALLOWED_OTP_TYPES = new Set<OtpPurpose>(["login", "signup", "recovery"]);
const OTP_COOLDOWN_SECONDS = Number(Deno.env.get("OTP_COOLDOWN_SECONDS") ?? "60");
const OTP_EXPIRY_MINUTES = Number(Deno.env.get("OTP_EXPIRY_MINUTES") ?? "10");
const OTP_MAX_ATTEMPTS = Number(Deno.env.get("OTP_MAX_ATTEMPTS") ?? "5");
const OTP_HASH_SECRET = Deno.env.get("OTP_HASH_SECRET") ?? "change-me";
const EMAIL_PROVIDER = (Deno.env.get("EMAIL_PROVIDER") ?? "").toLowerCase();
const EMAIL_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") ?? "Chuka University";
const EMAIL_FROM_ADDRESS = Deno.env.get("EMAIL_FROM_ADDRESS") ?? "no-reply@chuka.local";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_SECURE = (Deno.env.get("SMTP_SECURE") ?? "false").toLowerCase() === "true";
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? Deno.env.get("API_URL") ?? "";

const TABLES = {
  announcements: { primaryKey: "id", orderBy: "published_at", orderDirection: "desc" },
  chat_messages: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  chat_room_members: { primaryKey: "id", orderBy: "joined_at", orderDirection: "desc" },
  chat_rooms: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  email_otp_challenges: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  finance_accounts: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  finance_transactions: { primaryKey: "id", orderBy: "transaction_date", orderDirection: "desc" },
  login_otp_sessions: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  notes: { primaryKey: "id", orderBy: "uploaded_at", orderDirection: "desc" },
  otp_verifications: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  profiles: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  registration: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  revision_faculties: { primaryKey: "id", orderBy: "sort_order", orderDirection: "asc" },
  revision_materials: { primaryKey: "id", orderBy: "updated_at", orderDirection: "desc" },
  revision_subjects: { primaryKey: "id", orderBy: "sort_order", orderDirection: "asc" },
  revision_units: { primaryKey: "id", orderBy: "sort_order", orderDirection: "asc" },
  staff_materials: { primaryKey: "id", orderBy: "uploaded_at", orderDirection: "desc" },
  student_documents: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
  student_finance_status: { primaryKey: "user_id", orderBy: "updated_at", orderDirection: "desc" },
  suggested_highlights: { primaryKey: "id", orderBy: "position", orderDirection: "asc" },
  timetable_entries: { primaryKey: "id", orderBy: "day_order", orderDirection: "asc" },
  users: { primaryKey: "id", orderBy: "created_at", orderDirection: "desc" },
} as const;

const env = {
  port: Number(Deno.env.get("PORT") ?? "8000"),
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ?? "",
  supabaseAnonKey:
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? "",
  supabaseServiceRoleKey:
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") ??
    "",
  apiUrl: Deno.env.get("API_URL") ?? "",
};

function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function createAuthClient(extraHeaders: Record<string, string> = {}) {
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

function createSupabaseAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase admin configuration is missing.");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function isAllowedTable(name: string) {
  return name in TABLES;
}

function getTableConfig(name: string) {
  return TABLES[name as keyof typeof TABLES] ?? null;
}

function listAllowedTables() {
  return Object.keys(TABLES);
}

function jsonResponse(body: SuccessPayload | ErrorPayload, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

function sendSuccess(message: string, payload: Omit<SuccessPayload, "status" | "message"> = {}) {
  return jsonResponse({
    status: "ok",
    message,
    ...payload,
  });
}

function sendError(message: string, status = 400, extra: Omit<ErrorPayload, "status" | "message"> = {}) {
  return jsonResponse(
    {
      status: "error",
      message,
      ...extra,
    },
    { status },
  );
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeTableName(value: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateEmailBody(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);

  if (!email) {
    return { error: sendError("Email is required.", 400, { field: "email" }) };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: sendError("Enter a valid email address.", 400, { field: "email" }) };
  }

  return { email };
}

function validateLoginBody(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!email) {
    return { error: sendError("Email is required.", 400, { field: "email" }) };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: sendError("Enter a valid email address.", 400, { field: "email" }) };
  }

  if (!password) {
    return { error: sendError("Password is required.", 400, { field: "password" }) };
  }

  return { email, password };
}

function validateSendOtpBody(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const purpose = normalizePurpose(body.purpose);

  if (!email) {
    return { error: sendError("Email is required.", 400, { field: "email" }) };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: sendError("Enter a valid email address.", 400, { field: "email" }) };
  }

  return { email, purpose };
}

function validateVerifyOtpBody(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const purpose = normalizePurpose(body.purpose);

  if (!email) {
    return { error: sendError("Email is required.", 400, { field: "email" }) };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: sendError("Enter a valid email address.", 400, { field: "email" }) };
  }

  if (!token) {
    return { error: sendError("OTP token is required.", 400, { field: "token" }) };
  }

  if (!OTP_PATTERN.test(token)) {
    return { error: sendError("OTP must be 6 digits.", 400, { field: "token" }) };
  }

  return { email, token, purpose };
}

function validateRecoveryPasswordBody(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!email) {
    return { error: sendError("Email is required.", 400, { field: "email" }) };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: sendError("Enter a valid email address.", 400, { field: "email" }) };
  }

  if (!token) {
    return { error: sendError("OTP token is required.", 400, { field: "token" }) };
  }

  if (!OTP_PATTERN.test(token)) {
    return { error: sendError("OTP must be 6 digits.", 400, { field: "token" }) };
  }

  if (!password) {
    return { error: sendError("Password is required.", 400, { field: "password" }) };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: sendError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400, {
        field: "password",
      }),
    };
  }

  return { email, token, password };
}

function validatePasswordBody(body: Record<string, unknown>) {
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!password) {
    return { error: sendError("Password is required.", 400, { field: "password" }) };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: sendError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400, {
        field: "password",
      }),
    };
  }

  return { password };
}

function validateRegisterBody(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!name) {
    return { error: sendError("Full name is required.", 400, { field: "name" }) };
  }

  if (!email) {
    return { error: sendError("Email is required.", 400, { field: "email" }) };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: sendError("Enter a valid email address.", 400, { field: "email" }) };
  }

  if (!password) {
    return { error: sendError("Password is required.", 400, { field: "password" }) };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: sendError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400, {
        field: "password",
      }),
    };
  }

  return { name, email, password };
}

function normalizePurpose(value: unknown): OtpPurpose {
  return value === "signup" || value === "recovery" || value === "login" ? value : "login";
}

function getCooldownSecondsRemaining(createdAt: string | null | undefined) {
  if (!createdAt) {
    return 0;
  }

  const sentAt = Date.parse(createdAt);

  if (!Number.isFinite(sentAt)) {
    return 0;
  }

  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, OTP_COOLDOWN_SECONDS - elapsed);
}

function generateOtpCode() {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(digits).padStart(6, "0");
}

async function sha256Base64(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const array = new Uint8Array(digest);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function hashOtp(email: string, purpose: string, code: string) {
  return sha256Base64(`${OTP_HASH_SECRET}:${email}:${purpose}:${code}`);
}

async function hashToken(token: string) {
  return sha256Base64(`${OTP_HASH_SECRET}:${token}`);
}

function buildOtpSubject(purpose: OtpPurpose) {
  if (purpose === "signup") return "Verify your Chuka account";
  if (purpose === "recovery") return "Reset your Chuka password";
  return "Your Chuka login code";
}

function buildOtpIntro(purpose: OtpPurpose) {
  if (purpose === "signup") return "Use this code to verify your new Chuka account.";
  if (purpose === "recovery") return "Use this code to confirm your password reset.";
  return "Use this code to finish signing in.";
}

function buildOtpEmailHtml(params: {
  code: string;
  purpose: OtpPurpose;
  expiryMinutes: number;
}) {
  const { code, purpose, expiryMinutes } = params;
  const label = purpose === "signup" ? "Account verification" : purpose === "recovery" ? "Password reset" : "Login verification";
  const logoSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
      <rect width="88" height="88" rx="24" fill="#0b3d2e"/>
      <circle cx="44" cy="44" r="28" fill="#5ff0c2"/>
      <text x="44" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0b3d2e">C</text>
    </svg>
  `);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#07120d;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(180deg,#0b3d2e 0%,#062416 100%);border:1px solid rgba(255,255,255,0.08);border-radius:28px;overflow:hidden;">
        <div style="padding:32px 28px 18px;text-align:center;background:rgba(255,255,255,0.02);">
          <img src="data:image/svg+xml;utf8,${logoSvg}" alt="Chuka logo" width="72" height="72" style="display:block;margin:0 auto 16px;" />
          <div style="color:#f4fff8;font-size:28px;font-weight:800;line-height:1.1;">Chuka University</div>
          <div style="color:#a7d8c7;font-size:14px;margin-top:8px;">${label}</div>
        </div>
        <div style="padding:28px;">
          <div style="color:#f4fff8;font-size:18px;font-weight:700;margin-bottom:10px;">${buildOtpIntro(purpose)}</div>
          <div style="color:#cfe4d4;font-size:14px;line-height:1.7;margin-bottom:24px;">
            Enter the six-digit code below in the app to continue. It expires in ${expiryMinutes} minutes.
          </div>
          <div style="letter-spacing:10px;text-align:center;font-size:34px;font-weight:800;color:#5ff0c2;background:#062416;border:1px solid rgba(95,240,194,0.35);border-radius:18px;padding:18px 14px;margin:0 auto 24px;max-width:320px;">
            ${code}
          </div>
          <div style="color:#8fb8aa;font-size:12px;line-height:1.6;text-align:center;">
            If you did not request this, you can safely ignore this email.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

type SmtpSendParams = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  html: string;
};

function encodeBase64Utf8(value: string) {
  return btoa(value);
}

function buildSmtpMessage(params: Pick<SmtpSendParams, "from" | "to" | "subject" | "html">) {
  const body = params.html
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");

  return [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
}

async function readSmtpResponse(conn: Deno.Conn) {
  const decoder = new TextDecoder();
  let buffer = "";
  const lines: string[] = [];
  let code = 0;

  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      lines.push(line);

      const match = line.match(/^(\d{3})([-\s])/);
      if (match) {
        code = Number(match[1]);
        if (match[2] === " ") {
          return { code, lines, text: lines.join("\n") };
        }
      } else if (code && /^\d{3} /.test(line)) {
        return { code, lines, text: lines.join("\n") };
      }
      continue;
    }

    const chunk = new Uint8Array(1024);
    const read = await conn.read(chunk);

    if (read === null) {
      if (buffer.length > 0) {
        lines.push(buffer);
      }
      return { code, lines, text: lines.join("\n") };
    }

    buffer += decoder.decode(chunk.subarray(0, read), { stream: true });
  }
}

async function writeSmtpLine(conn: Deno.Conn, line: string) {
  await conn.write(new TextEncoder().encode(`${line}\r\n`));
}

async function sendSmtpMessage(params: SmtpSendParams) {
  let conn: Deno.Conn | Deno.TlsConn;

  if (params.secure) {
    conn = await Deno.connectTls({ hostname: params.host, port: params.port });
  } else {
    conn = await Deno.connect({ hostname: params.host, port: params.port });
  }

  try {
    let response = await readSmtpResponse(conn);
    if (response.code >= 400) {
      throw new Error(`SMTP greeting failed: ${response.text}`);
    }

    const ehloHost = APP_BASE_URL || "localhost";
    await writeSmtpLine(conn, `EHLO ${ehloHost}`);
    response = await readSmtpResponse(conn);

    if (!params.secure && response.text.includes("STARTTLS")) {
      await writeSmtpLine(conn, "STARTTLS");
      response = await readSmtpResponse(conn);
      if (response.code !== 220) {
        throw new Error(`SMTP STARTTLS failed: ${response.text}`);
      }

      conn = await Deno.startTls(conn as Deno.Conn, { hostname: params.host });
      await writeSmtpLine(conn, `EHLO ${ehloHost}`);
      response = await readSmtpResponse(conn);
    }

    await writeSmtpLine(conn, "AUTH LOGIN");
    response = await readSmtpResponse(conn);
    if (response.code !== 334) {
      throw new Error(`SMTP AUTH LOGIN was rejected: ${response.text}`);
    }

    await writeSmtpLine(conn, encodeBase64Utf8(params.username));
    response = await readSmtpResponse(conn);
    if (response.code !== 334) {
      throw new Error(`SMTP username was rejected: ${response.text}`);
    }

    await writeSmtpLine(conn, encodeBase64Utf8(params.password));
    response = await readSmtpResponse(conn);
    if (response.code !== 235) {
      throw new Error(`SMTP authentication failed: ${response.text}`);
    }

    await writeSmtpLine(conn, `MAIL FROM:<${EMAIL_FROM_ADDRESS}>`);
    response = await readSmtpResponse(conn);
    if (response.code !== 250) {
      throw new Error(`SMTP MAIL FROM failed: ${response.text}`);
    }

    await writeSmtpLine(conn, `RCPT TO:<${params.to}>`);
    response = await readSmtpResponse(conn);
    if (response.code !== 250 && response.code !== 251) {
      throw new Error(`SMTP RCPT TO failed: ${response.text}`);
    }

    await writeSmtpLine(conn, "DATA");
    response = await readSmtpResponse(conn);
    if (response.code !== 354) {
      throw new Error(`SMTP DATA was rejected: ${response.text}`);
    }

    await conn.write(new TextEncoder().encode(`${buildSmtpMessage(params)}\r\n.\r\n`));
    response = await readSmtpResponse(conn);
    if (response.code !== 250) {
      throw new Error(`SMTP message send failed: ${response.text}`);
    }

    await writeSmtpLine(conn, "QUIT");
  } finally {
    conn.close();
  }
}

async function sendOtpEmail(to: string, subject: string, html: string) {
  const from = `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`;

  if (EMAIL_PROVIDER === "smtp") {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
    }

    await sendSmtpMessage({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      username: SMTP_USER,
      password: SMTP_PASS,
      from,
      to,
      subject,
      html,
    });

    return;
  }

  if (RESEND_API_KEY && EMAIL_PROVIDER !== "sendgrid") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Resend failed: ${text}`);
    }

    return;
  }

  if (EMAIL_PROVIDER === "sendgrid" || SENDGRID_API_KEY) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid failed: ${text}`);
    }

    return;
  }

  throw new Error("No email provider configured. Set EMAIL_PROVIDER=smtp, RESEND_API_KEY, or SENDGRID_API_KEY.");
}

async function storeOtpChallenge(params: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}) {
  const { email, purpose, code } = params;
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60_000);
  const codeHash = await hashOtp(email, purpose, code);

  const record = {
    id: crypto.randomUUID(),
    email,
    purpose,
    code_hash: codeHash,
    attempts: 0,
    max_attempts: OTP_MAX_ATTEMPTS,
    used_at: null,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data, error } = await supabase.from("otp_verifications").insert(record).select("*").single();

  if (error) {
    throw error;
  }

  return {
    challenge: data,
    expiresAt,
  };
}

async function findLatestOtpChallenge(email: string, purpose: OtpPurpose) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("otp_verifications")
    .select("*")
    .eq("email", email)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function enforceOtpCooldown(email: string, purpose: OtpPurpose) {
  const latest = await findLatestOtpChallenge(email, purpose);
  const retryAfterSeconds = getCooldownSecondsRemaining(latest?.created_at as string | null | undefined);

  if (retryAfterSeconds > 0) {
    return {
      error: sendError("Please wait before requesting another OTP.", 429, {
        field: "email",
        error: "OTP_COOLDOWN",
      }),
      retryAfterSeconds,
    };
  }

  return { latest, retryAfterSeconds: 0 };
}

async function markOtpUsed(id: string, extra: Record<string, unknown> = {}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("otp_verifications").update({
    used_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  }).eq("id", id);

  if (error) {
    throw error;
  }
}

async function incrementOtpAttempts(id: string, attempts: number) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("otp_verifications")
    .update({
      attempts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

function getOtpChallengeState(challenge: Record<string, unknown> | null) {
  if (!challenge) {
    return { exists: false, valid: false, expired: true, used: true, attemptsExceeded: false };
  }

  const now = Date.now();
  const expiresAt = typeof challenge.expires_at === "string" ? Date.parse(challenge.expires_at) : NaN;
  const attempts = Number(challenge.attempts ?? 0);
  const maxAttempts = Number(challenge.max_attempts ?? OTP_MAX_ATTEMPTS);
  const usedAt = challenge.used_at ? String(challenge.used_at) : "";

  return {
    exists: true,
    valid: Boolean(challenge.code_hash) && Boolean(challenge.email) && Boolean(challenge.purpose),
    expired: Number.isFinite(expiresAt) ? now > expiresAt : true,
    used: Boolean(usedAt),
    attemptsExceeded: attempts >= maxAttempts,
    attempts,
    maxAttempts,
  };
}

async function verifyStoredOtpChallenge(params: {
  email: string;
  purpose: OtpPurpose;
  token: string;
}) {
  const { email, purpose, token } = params;
  const challenge = await findLatestOtpChallenge(email, purpose);
  const state = getOtpChallengeState(challenge);

  if (!state.exists || !state.valid) {
    return { error: sendError("OTP challenge not found.", 404, { field: "token" }) };
  }

  if (state.used) {
    return { error: sendError("This OTP has already been used.", 400, { field: "token" }) };
  }

  if (state.expired) {
    return { error: sendError("This OTP has expired. Please request a new code.", 400, { field: "token" }) };
  }

  if (state.attemptsExceeded) {
    return {
      error: sendError(
        "Too many invalid OTP attempts. Please request a new code.",
        429,
        { field: "token" },
      ),
    };
  }

  const expected = await hashOtp(email, purpose, token);

  if (expected !== challenge.code_hash) {
    await incrementOtpAttempts(String(challenge.id), state.attempts + 1);
    return { error: sendError("Invalid OTP. Please try again.", 400, { field: "token" }) };
  }

  await markOtpUsed(String(challenge.id));

  return { challenge };
}

async function requireSupabaseUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    return { error: sendError("Authorization bearer token is required.", 401) };
  }

  try {
    const client = createAuthClient();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data?.user) {
      return { error: sendError("Invalid or expired session.", 401) };
    }

    return { token, user: data.user };
  } catch (authError) {
    return {
      error: sendError(
        authError instanceof Error ? authError.message : "Invalid session.",
        401,
      ),
    };
  }
}

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function getOrderQuery(query: any, config: { orderBy?: string; orderDirection?: string } | null) {
  if (!config?.orderBy) {
    return query;
  }

  return query.order(config.orderBy, { ascending: config.orderDirection !== "desc" });
}

async function login(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateLoginBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const client = createAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    return sendError(error.message || "Failed to sign in.", 400);
  }

  return sendSuccess("Signed in successfully.", {
    session: data.session,
    user: data.user,
  });
}

async function sendOtp(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateSendOtpBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const cooldown = await enforceOtpCooldown(parsed.email, parsed.purpose);

  if ("error" in cooldown) {
    return cooldown.error;
  }

  const code = generateOtpCode();

  try {
    const { expiresAt } = await storeOtpChallenge({
      email: parsed.email,
      purpose: parsed.purpose,
      code,
    });

    await sendOtpEmail(
      parsed.email,
      buildOtpSubject(parsed.purpose),
      buildOtpEmailHtml({
        code,
        purpose: parsed.purpose,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    );

    return sendSuccess("OTP sent successfully.", {
      email: parsed.email,
      data: {
        purpose: parsed.purpose,
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        retryAfterSeconds: OTP_COOLDOWN_SECONDS,
        resendAvailableAt: new Date(Date.now() + OTP_COOLDOWN_SECONDS * 1000).toISOString(),
      },
    });
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : "Failed to send OTP.",
      400,
    );
  }
}

async function verifyOtp(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateVerifyOtpBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  try {
    const result = await verifyStoredOtpChallenge({
      email: parsed.email,
      purpose: parsed.purpose,
      token: parsed.token,
    });

    if ("error" in result) {
      return result.error;
    }

    return sendSuccess("OTP verified successfully.", {
      email: parsed.email,
      data: {
        purpose: parsed.purpose,
      },
    });
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : "OTP verification failed.",
      400,
    );
  }
}

async function resetPassword(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateSendOtpBody({ ...body, purpose: "recovery" });

  if ("error" in parsed) {
    return parsed.error;
  }

  const cooldown = await enforceOtpCooldown(parsed.email, "recovery");

  if ("error" in cooldown) {
    return cooldown.error;
  }

  const code = generateOtpCode();

  try {
    const { expiresAt } = await storeOtpChallenge({
      email: parsed.email,
      purpose: "recovery",
      code,
    });

    await sendOtpEmail(
      parsed.email,
      buildOtpSubject("recovery"),
      buildOtpEmailHtml({
        code,
        purpose: "recovery",
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    );

    return sendSuccess("Reset OTP sent successfully.", {
      email: parsed.email,
      data: {
        purpose: "recovery",
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        retryAfterSeconds: OTP_COOLDOWN_SECONDS,
        resendAvailableAt: new Date(Date.now() + OTP_COOLDOWN_SECONDS * 1000).toISOString(),
      },
    });
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : "Failed to send reset OTP.",
      400,
    );
  }
}

async function register(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateRegisterBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      name: parsed.name,
    },
  });

  if (error) {
    return sendError(error.message || "Registration failed.", 400);
  }

  if (data.user?.id) {
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: data.user.id,
      full_name: parsed.name,
      email: parsed.email,
      role: "student",
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return sendError(profileError.message || "Registration profile could not be created.", 500);
    }
  }

  const client = createAuthClient();
  const { data: sessionData, error: sessionError } = await client.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (sessionError) {
    return sendError(sessionError.message || "Registration completed, but session could not be created.", 400);
  }

  return sendSuccess("Registration created successfully.", {
    session: sessionData.session,
    user: sessionData.user ?? data.user,
  });
}

async function updatePassword(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateRecoveryPasswordBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const verification = await verifyStoredOtpChallenge({
    email: parsed.email,
    purpose: "recovery",
    token: parsed.token,
  });

  if ("error" in verification) {
    return verification.error;
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    if (usersError) {
      return sendError(usersError.message || "Unable to locate account.", 400);
    }

    const user = users.users.find((entry) => entry.email?.toLowerCase() === parsed.email);

    if (!user?.id) {
      return sendError("No account found for this email address.", 404, { field: "email" });
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(user.id, {
      password: parsed.password,
    });

    if (error) {
      return sendError(error.message || "Failed to update password.", 400);
    }

    return sendSuccess("Password updated successfully.", {
      user: data.user,
      email: parsed.email,
    });
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : "Failed to update password.",
      400,
    );
  }
}

async function listRecords(request: Request, table: string) {
  const auth = await requireSupabaseUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!isAllowedTable(table)) {
    return sendError(`Unknown table: ${table}`, 404);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const config = getTableConfig(table);
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "100") || 100, 500);
    const offset = Math.max(Number(url.searchParams.get("offset") || "0") || 0, 0);
    let query = supabase.from(table).select("*");
    query = getOrderQuery(query, config);
    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return jsonResponse({
      status: "ok",
      message: `${table} records loaded successfully.`,
      data,
      meta: {
        table,
        allowedTables: listAllowedTables(),
        limit,
        offset,
      },
    } as SuccessPayload);
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : `Failed to load ${table}.`,
      500,
    );
  }
}

async function getRecord(request: Request, table: string, id: string) {
  const auth = await requireSupabaseUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!isAllowedTable(table)) {
    return sendError(`Unknown table: ${table}`, 404);
  }

  const config = getTableConfig(table);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from(table).select("*").eq(config.primaryKey, id).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return sendError(`${table} record not found.`, 404);
    }

    return jsonResponse({
      status: "ok",
      message: `${table} record loaded successfully.`,
      data,
    } as SuccessPayload);
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : `Failed to load ${table} record.`,
      500,
    );
  }
}

async function createRecord(request: Request, table: string) {
  const auth = await requireSupabaseUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!isAllowedTable(table)) {
    return sendError(`Unknown table: ${table}`, 404);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const payload = await readJsonBody(request);
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();

    if (error) {
      throw error;
    }

    return jsonResponse(
      {
        status: "ok",
        message: `${table} record created successfully.`,
        data,
      } as SuccessPayload,
      { status: 201 },
    );
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : `Failed to create ${table} record.`,
      500,
    );
  }
}

async function updateRecord(request: Request, table: string, id: string) {
  const auth = await requireSupabaseUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!isAllowedTable(table)) {
    return sendError(`Unknown table: ${table}`, 404);
  }

  const config = getTableConfig(table);

  try {
    const supabase = createSupabaseAdminClient();
    const payload = await readJsonBody(request);
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq(config.primaryKey, id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return sendError(`${table} record not found.`, 404);
    }

    return jsonResponse({
      status: "ok",
      message: `${table} record updated successfully.`,
      data,
    } as SuccessPayload);
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : `Failed to update ${table} record.`,
      500,
    );
  }
}

async function deleteRecord(request: Request, table: string, id: string) {
  const auth = await requireSupabaseUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!isAllowedTable(table)) {
    return sendError(`Unknown table: ${table}`, 404);
  }

  const config = getTableConfig(table);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq(config.primaryKey, id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return sendError(`${table} record not found.`, 404);
    }

    return jsonResponse({
      status: "ok",
      message: `${table} record deleted successfully.`,
      data,
    } as SuccessPayload);
  } catch (error) {
    return sendError(
      error instanceof Error ? error.message : `Failed to delete ${table} record.`,
      500,
    );
  }
}

function createHealthResponse() {
  return jsonResponse({
    status: "ok",
    message: "Backend running",
    data: {
      service: "chuka-backend",
      timestamp: new Date().toISOString(),
      apiUrl: env.apiUrl || undefined,
    },
  } as SuccessPayload);
}

async function handler(request: Request) {
  const url = new URL(request.url);
  const headers = corsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  let response: Response;

  if (request.method === "GET" && url.pathname === "/") {
    response = jsonResponse(
      {
        status: "ok",
        message: "Chuka backend API is running",
        data: {
          service: "chuka-backend",
          timestamp: new Date().toISOString(),
          apiUrl: env.apiUrl || undefined,
        },
      } as SuccessPayload,
      { headers },
    );
  } else if (request.method === "GET" && url.pathname === "/api/health") {
    response = createHealthResponse();
  } else if (request.method === "POST" && url.pathname === "/api/auth/login") {
    response = await login(request);
  } else if (request.method === "POST" && url.pathname === "/api/auth/otp") {
    response = await sendOtp(request);
  } else if (request.method === "POST" && url.pathname === "/api/auth/verify") {
    response = await verifyOtp(request);
  } else if (request.method === "POST" && url.pathname === "/api/auth/reset") {
    response = await resetPassword(request);
  } else if (request.method === "POST" && url.pathname === "/api/auth/register") {
    response = await register(request);
  } else if (request.method === "POST" && url.pathname === "/api/auth/password") {
    response = await updatePassword(request);
  } else if (url.pathname === "/api/data" && request.method === "GET") {
    const auth = await requireSupabaseUser(request);
    response = "error" in auth
      ? auth.error
      : jsonResponse({
          status: "ok",
          message: "Data API is running",
        } as SuccessPayload);
  } else if (url.pathname.startsWith("/api/data/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const table = normalizeTableName(parts[2] ?? null);
    const id = parts[3] ?? "";

    if (request.method === "GET" && parts.length === 3) {
      response = await listRecords(request, table);
    } else if (request.method === "GET" && parts.length === 4) {
      response = await getRecord(request, table, id);
    } else if (request.method === "POST" && parts.length === 3) {
      response = await createRecord(request, table);
    } else if (request.method === "PATCH" && parts.length === 4) {
      response = await updateRecord(request, table, id);
    } else if (request.method === "DELETE" && parts.length === 4) {
      response = await deleteRecord(request, table, id);
    } else {
      response = sendError(`Cannot ${request.method} ${url.pathname}`, 404);
    }
  } else {
    response = sendError(`Cannot ${request.method} ${url.pathname}`, 404);
  }

  response.headers.set("Access-Control-Allow-Origin", headers["Access-Control-Allow-Origin"]);
  response.headers.set("Access-Control-Allow-Methods", headers["Access-Control-Allow-Methods"]);
  response.headers.set("Access-Control-Allow-Headers", headers["Access-Control-Allow-Headers"]);
  return response;
}

if (import.meta.main) {
  Deno.serve(handler);
}
