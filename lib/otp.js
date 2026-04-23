const crypto = require("crypto");
const env = require("../config/env");

const OTP_PATTERN = /^\d{6}$/;
const pendingChallenges = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePurpose(purpose) {
  const value = String(purpose || "login").trim().toLowerCase();

  if (value === "email") {
    return "login";
  }

  if (value === "password_reset") {
    return "recovery";
  }

  if (value === "signup" || value === "login" || value === "recovery") {
    return value;
  }

  return "login";
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getChallengeKey(email, purpose) {
  return `${normalizeEmail(email)}:${normalizePurpose(purpose)}`;
}

function getExpiresAtIso() {
  return new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000).toISOString();
}

function getResendAvailableAtIso() {
  return new Date(Date.now() + env.otpCooldownSeconds * 1000).toISOString();
}

function getOtpHash(code, email, purpose) {
  if (!env.otpHashSecret) {
    throw new Error("Missing OTP_HASH_SECRET.");
  }

  return crypto
    .createHmac("sha256", env.otpHashSecret)
    .update(`${normalizeEmail(email)}:${normalizePurpose(purpose)}:${code}`)
    .digest("hex");
}

function createOtpChallenge({ email, purpose = "login" }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPurpose = normalizePurpose(purpose);
  const key = getChallengeKey(normalizedEmail, normalizedPurpose);
  const existing = pendingChallenges.get(key);
  const now = Date.now();

  if (existing && existing.resendAvailableAt > now && existing.expiresAt > now) {
    const remainingSeconds = Math.max(1, Math.ceil((existing.resendAvailableAt - now) / 1000));
    const error = new Error(`Please wait ${remainingSeconds}s before requesting another code.`);
    error.code = "OTP_COOLDOWN";
    error.resendAvailableAt = new Date(existing.resendAvailableAt).toISOString();
    throw error;
  }

  const code = generateOtpCode();
  const createdAt = now;
  const expiresAt = now + env.otpExpiryMinutes * 60 * 1000;
  const resendAvailableAt = now + env.otpCooldownSeconds * 1000;

  const challenge = {
    email: normalizedEmail,
    purpose: normalizedPurpose,
    codeHash: getOtpHash(code, normalizedEmail, normalizedPurpose),
    createdAt,
    expiresAt,
    resendAvailableAt,
    attempts: 0,
    verifiedAt: null,
  };

  pendingChallenges.set(key, challenge);

  return {
    challenge,
    code,
    expiresAt: new Date(expiresAt).toISOString(),
    resendAvailableAt: new Date(resendAvailableAt).toISOString(),
  };
}

function getOtpChallenge(email, purpose = "login") {
  const key = getChallengeKey(email, purpose);
  const challenge = pendingChallenges.get(key);

  if (!challenge) {
    return null;
  }

  if (challenge.expiresAt <= Date.now()) {
    pendingChallenges.delete(key);
    return null;
  }

  return challenge;
}

function verifyOtpChallenge({ email, purpose = "login", token }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPurpose = normalizePurpose(purpose);
  const key = getChallengeKey(normalizedEmail, normalizedPurpose);
  const challenge = getOtpChallenge(normalizedEmail, normalizedPurpose);

  if (!challenge) {
    return { ok: false, message: "OTP code has expired. Please request a new one." };
  }

  const code = String(token || "").trim();

  if (!OTP_PATTERN.test(code)) {
    return { ok: false, message: "OTP must be 6 digits." };
  }

  const expectedHash = getOtpHash(code, normalizedEmail, normalizedPurpose);

  if (expectedHash !== challenge.codeHash) {
    challenge.attempts += 1;

    if (challenge.attempts >= env.otpMaxAttempts) {
      pendingChallenges.delete(key);
      return { ok: false, message: "Too many invalid attempts. Request a new code." };
    }

    pendingChallenges.set(key, challenge);
    return { ok: false, message: "Invalid OTP. Please try again." };
  }

  challenge.verifiedAt = Date.now();

  if (normalizedPurpose !== "recovery") {
    pendingChallenges.delete(key);
  } else {
    pendingChallenges.set(key, challenge);
  }

  return {
    ok: true,
    challenge,
  };
}

function consumeRecoveryChallenge(email, token) {
  const challenge = getOtpChallenge(email, "recovery");

  if (!challenge) {
    return { ok: false, message: "OTP code has expired. Please request a new one." };
  }

  if (!challenge.verifiedAt) {
    const verification = verifyOtpChallenge({ email, purpose: "recovery", token });
    if (!verification.ok) {
      return verification;
    }
  } else {
    const code = String(token || "").trim();
    const expectedHash = getOtpHash(code, email, "recovery");
    if (expectedHash !== challenge.codeHash) {
      return { ok: false, message: "Invalid OTP. Please try again." };
    }
  }

  return {
    ok: true,
    challenge,
  };
}

function clearOtpChallenge(email, purpose = "login") {
  pendingChallenges.delete(getChallengeKey(email, purpose));
}

module.exports = {
  OTP_PATTERN,
  clearOtpChallenge,
  consumeRecoveryChallenge,
  createOtpChallenge,
  getExpiresAtIso,
  getOtpChallenge,
  normalizeEmail,
  normalizePurpose,
  verifyOtpChallenge,
};
