const nodemailer = require("nodemailer");
const env = require("../config/env");

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost || "smtp.gmail.com",
    port: env.smtpPort || 587,
    secure: Boolean(env.smtpSecure),
    requireTLS: true,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    tls: {
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

function getPurposeCopy(purpose) {
  const normalized = String(purpose || "login").trim().toLowerCase();

  if (normalized === "signup") {
    return {
      label: "registration",
      subject: "Your Chuka University registration code",
      headline: "Registration verification code",
      intro: "Use this code to complete your Chuka University registration.",
    };
  }

  if (normalized === "recovery") {
    return {
      label: "password reset",
      subject: "Your Chuka University password reset code",
      headline: "Password reset code",
      intro: "Use this code to reset your Chuka University password securely.",
    };
  }

  return {
    label: "login",
    subject: "Your Chuka University login code",
    headline: "Login verification code",
    intro: "Use this code to finish signing in to your Chuka University account.",
  };
}

function buildEmailContent({ email, code, expiresInMinutes, purpose }) {
  const copy = getPurposeCopy(purpose);

  return {
    subject: copy.subject,
    text: `Your ${copy.label} code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 8px; color: #0b3d2e;">Chuka University App</h2>
        <p style="line-height: 1.6; color: #1A1A1A;">${copy.intro}</p>
        <div style="margin: 24px 0; border-radius: 16px; padding: 18px 20px; background: #eef7ef; border: 1px solid #b7e2b7;">
          <div style="font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #0b3d2e;">${code}</div>
        </div>
        <p style="line-height: 1.6; color: #4f6655;">This code expires in ${expiresInMinutes} minutes. If you did not request it, ignore this email.</p>
        <p style="line-height: 1.6; color: #7b8f82; font-size: 12px;">Requested for: ${email}</p>
      </div>
    `,
  };
}

async function sendOtpEmail({ email, code, expiresInMinutes, purpose }) {
  const provider = String(env.emailProvider || "smtp").trim().toLowerCase();
  const content = buildEmailContent({ email, code, expiresInMinutes, purpose });

  if (provider === "console" || (!env.smtpHost && !env.smtpUser && !env.smtpPass)) {
    console.log(`[OTP:${purpose || "login"}] ${email} -> ${code}`);
    return;
  }

  if (provider !== "smtp") {
    if (String(env.nodeEnv || "").trim().toLowerCase() !== "production") {
      console.warn(`Unknown EMAIL_PROVIDER="${provider}". Falling back to SMTP/console behavior.`);
    }
  }

  const transporter = createSmtpTransporter();

  await transporter.sendMail({
    from: `"${env.emailFromName || "Chuka University App"}" <${env.emailFromAddress || env.smtpUser}>`,
    replyTo: env.emailFromAddress || env.smtpUser,
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

module.exports = {
  sendOtpEmail,
};
