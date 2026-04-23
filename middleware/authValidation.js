const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const OTP_PATTERN = /^\d{6}$/;
const MIN_PASSWORD_LENGTH = 6;
const ALLOWED_OTP_TYPES = new Set(["email", "login", "signup", "recovery", "password_reset"]);

function respondWithValidationError(res, message, field) {
  return res.status(400).json({
    status: "error",
    message,
    field,
  });
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateEmailBody(req, res, next) {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return respondWithValidationError(res, "Email is required.", "email");
  }

  if (!EMAIL_PATTERN.test(email)) {
    return respondWithValidationError(res, "Enter a valid email address.", "email");
  }

  req.body.email = email;
  return next();
}

function validateLoginBody(req, res, next) {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";

  if (!email) {
    return respondWithValidationError(res, "Email is required.", "email");
  }

  if (!EMAIL_PATTERN.test(email)) {
    return respondWithValidationError(res, "Enter a valid email address.", "email");
  }

  if (!password) {
    return respondWithValidationError(res, "Password is required.", "password");
  }

  req.body.email = email;
  req.body.password = password;
  return next();
}

function validateOtpBody(req, res, next) {
  const email = normalizeEmail(req.body?.email);
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const rawPurpose =
    typeof req.body?.purpose === "string"
      ? req.body.purpose.trim()
      : typeof req.body?.type === "string"
        ? req.body.type.trim()
        : "login";
  const type = rawPurpose === "password_reset" ? "recovery" : rawPurpose;

  if (!email) {
    return respondWithValidationError(res, "Email is required.", "email");
  }

  if (!EMAIL_PATTERN.test(email)) {
    return respondWithValidationError(res, "Enter a valid email address.", "email");
  }

  if (!token) {
    return respondWithValidationError(res, "OTP token is required.", "token");
  }

  if (!OTP_PATTERN.test(token)) {
    return respondWithValidationError(res, "OTP must be 6 digits.", "token");
  }

  if (!ALLOWED_OTP_TYPES.has(type)) {
    return respondWithValidationError(
      res,
      "OTP purpose must be login, signup, recovery, or email.",
      "purpose",
    );
  }

  req.body.email = email;
  req.body.token = token;
  req.body.purpose = type === "email" ? "login" : type;
  return next();
}

function validatePasswordBody(req, res, next) {
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";

  if (!password) {
    return respondWithValidationError(res, "Password is required.", "password");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return respondWithValidationError(
      res,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      "password",
    );
  }

  req.body.password = password;
  return next();
}

function validateRegisterBody(req, res, next) {
  const body = req.body || {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!name) {
    return respondWithValidationError(res, "Full name is required.", "name");
  }

  if (!email) {
    return respondWithValidationError(res, "Email is required.", "email");
  }

  if (!EMAIL_PATTERN.test(email)) {
    return respondWithValidationError(res, "Enter a valid email address.", "email");
  }

  if (!password) {
    return respondWithValidationError(res, "Password is required.", "password");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return respondWithValidationError(
      res,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      "password",
    );
  }

  req.body = {
    name,
    email,
    password,
  };
  return next();
}

module.exports = {
  validateEmailBody,
  validateLoginBody,
  validateOtpBody,
  validatePasswordBody,
  validateRegisterBody,
};
