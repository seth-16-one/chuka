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
const ALLOWED_OTP_TYPES = new Set(["email", "recovery"]);

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

function validateOtpBody(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "email";

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

  if (!ALLOWED_OTP_TYPES.has(type)) {
    return { error: sendError("OTP type must be email or recovery.", 400, { field: "type" }) };
  }

  return { email, token, type: type as "email" | "recovery" };
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
  const parsed = validateEmailBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const client = createAuthClient();
  const { data, error } = await client.auth.signInWithOtp({
    email: parsed.email,
  });

  if (error) {
    return sendError(error.message || "Failed to send OTP.", 400);
  }

  return sendSuccess("OTP sent successfully.", {
    user: data.user ?? null,
  });
}

async function verifyOtp(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateOtpBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const client = createAuthClient();
  const { data, error } = await client.auth.verifyOtp({
    email: parsed.email,
    token: parsed.token,
    type: parsed.type,
  });

  if (error) {
    return sendError(error.message || "OTP verification failed.", 400);
  }

  return sendSuccess("OTP verified successfully.", {
    session: data.session,
    user: data.user,
  });
}

async function resetPassword(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const body = await readJsonBody(request);
  const parsed = validateEmailBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const client = createAuthClient();
  const { error } = await client.auth.resetPasswordForEmail(parsed.email);

  if (error) {
    return sendError(error.message || "Failed to send reset OTP.", 400);
  }

  return sendSuccess("Reset OTP sent successfully.", {
    email: parsed.email,
  });
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

  const client = createAuthClient();
  const { data, error } = await client.auth.signUp({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    return sendError(error.message || "Registration failed.", 400);
  }

  if (data.user?.id) {
    const adminClient = createSupabaseAdminClient();
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

  return sendSuccess("Registration created successfully.", {
    session: data.session,
    user: data.user,
  });
}

async function updatePassword(request: Request) {
  if (!hasSupabaseConfig()) {
    return sendError("Supabase configuration is missing.", 500);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!accessToken) {
    return sendError("Missing access token.", 401);
  }

  const body = await readJsonBody(request);
  const parsed = validatePasswordBody(body);

  if ("error" in parsed) {
    return parsed.error;
  }

  const client = createAuthClient({
    Authorization: `Bearer ${accessToken}`,
  });

  const { data, error } = await client.auth.updateUser({
    password: parsed.password,
  });

  if (error) {
    return sendError(error.message || "Failed to update password.", 400);
  }

  return sendSuccess("Password updated successfully.", {
    user: data.user,
  });
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
